import PDFDocument from 'pdfkit';
import { getDatabase } from '../../config/database';
import { NotFoundError, ValidationError } from '../utils';
import { createLogger } from '../utils/logger';

const prisma = getDatabase();
const logger = createLogger('receipt-service');

// ── Brand tokens (mirrors email templates) ────────────────────────────────────
const ORANGE     = '#F97316';
const DARK       = '#1a1a1a';
const GREY       = '#555555';
const LABEL_GREY = '#aaaaaa';
const LINE_GREY  = '#eeeeee';
const CARD_BG    = '#f9f9f9';
const PAGE_BG    = '#f4f4f4';
const GREEN_BG   = '#ecfdf5';
const GREEN_TEXT = '#065f46';
const GREEN_BAR  = '#10b981';
const WHITE      = '#ffffff';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(amount: any, currency: string): string {
  const n = parseFloat(String(amount ?? 0));
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtLabel(s: string): string {
  return s.replace(/_/g, ' ');
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function fill(doc: PDFKit.PDFDocument, hex: string) {
  doc.fillColor(hex as any);
}

function stroke(doc: PDFKit.PDFDocument, hex: string) {
  doc.strokeColor(hex as any);
}

/**
 * Generates an on-demand PDF receipt for a completed transaction.
 * Returns a Buffer — no storage required; generated fresh each time.
 */
export async function generateTransactionReceipt(
  transactionId: string,
  requesterId: string,
  requesterRole: 'CUSTOMER' | 'AGENT' | 'ADMIN'
): Promise<{ pdf: Buffer; filename: string; referenceNumber: string }> {
  logger.info('[generateReceipt] Generating receipt', { transactionId, requesterId, requesterRole });

  const client = prisma as any;

  const transaction = await client.transaction.findFirst({
    where: buildAccessWhere(transactionId, requesterId, requesterRole),
    include: {
      user: {
        select: {
          email: true,
          phoneNumber: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      steps: { orderBy: { createdAt: 'asc' } },
      cashPickup: true,
    },
  });

  if (!transaction) throw new NotFoundError('Transaction not found');

  if (transaction.status !== 'COMPLETED') {
    throw new ValidationError('Receipt is only available for completed transactions');
  }

  const personalInfoStep =
    transaction.steps.find((s: any) => s.step === 'PERSONAL_INFO') ??
    transaction.steps.find((s: any) => s.step === 'DOCUMENT_UPLOAD');
  const stepData          = (personalInfoStep?.data as any) ?? {};
  const beneficiaryDetails = stepData.beneficiaryDetails ?? null;
  const refundBankDetails  = stepData.refundBankDetails  ?? null;

  const firstName  = transaction.user?.profile?.firstName ?? '';
  const lastName   = transaction.user?.profile?.lastName  ?? '';
  const fullName   = [firstName, lastName].filter(Boolean).join(' ') || 'Customer';
  const receiptNum = `RCP-${transaction.referenceNumber}`;

  const pdf = await buildPdf({
    receiptNumber:    receiptNum,
    referenceNumber:  transaction.referenceNumber,
    fullName,
    email:            transaction.user?.email ?? '',
    phoneNumber:      transaction.user?.phoneNumber ?? '',
    type:             transaction.type,
    purpose:          transaction.purpose,
    currency:         transaction.currency,
    foreignAmount:    transaction.foreignAmount,
    nairaEquivalent:  transaction.nairaEquivalent,
    exchangeRate:     transaction.exchangeRate,
    disbursementMethod: transaction.disbursementMethod,
    completedAt:      transaction.updatedAt,
    beneficiaryDetails,
    refundBankDetails,
    cashPickup:       transaction.cashPickup ?? null,
  });

  const filename = `receipt-${transaction.referenceNumber}.pdf`;
  logger.info('[generateReceipt] Receipt generated', { transactionId, receiptNum });

  return { pdf, filename, referenceNumber: transaction.referenceNumber };
}

function buildAccessWhere(transactionId: string, requesterId: string, role: string) {
  const idFilter = { OR: [{ id: transactionId }, { referenceNumber: transactionId }] };
  if (role === 'CUSTOMER') return { ...idFilter, userId: requesterId };
  if (role === 'AGENT')    return { ...idFilter, createdByAgent: { userId: requesterId } };
  return idFilter;
}

interface ReceiptData {
  receiptNumber:      string;
  referenceNumber:    string;
  fullName:           string;
  email:              string;
  phoneNumber:        string;
  type:               string;
  purpose:            string;
  currency:           string;
  foreignAmount:      any;
  nairaEquivalent:    any;
  exchangeRate:       any;
  disbursementMethod: string | null;
  completedAt:        Date;
  beneficiaryDetails: any;
  refundBankDetails:  any;
  cashPickup:         any;
}

function buildPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW   = doc.page.width;   // 595.28
    const PH   = doc.page.height;  // 841.89
    const PAD  = 48;               // horizontal padding
    const CW   = PW - PAD * 2;    // content width

    // ── Page background ───────────────────────────────────────────────────────
    doc.rect(0, 0, PW, PH).fill(PAGE_BG as any);

    // ── White card ────────────────────────────────────────────────────────────
    const CARD_X  = 28;
    const CARD_Y  = 28;
    const CARD_W  = PW - 56;
    const CARD_H  = PH - 56;
    const RADIUS  = 12;

    doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, RADIUS).fill(WHITE as any);

    // ── Orange header ─────────────────────────────────────────────────────────
    const HEADER_H = 108;
    // Clip to card corners for top-round only
    doc.save();
    doc.roundedRect(CARD_X, CARD_Y, CARD_W, HEADER_H + RADIUS, RADIUS).clip();
    doc.rect(CARD_X, CARD_Y + RADIUS, CARD_W, HEADER_H).fill(ORANGE as any);
    doc.roundedRect(CARD_X, CARD_Y, CARD_W, HEADER_H, RADIUS).fill(ORANGE as any);
    doc.restore();

    // Brand name
    fill(doc, WHITE);
    doc.font('Helvetica-Bold').fontSize(20).text('SOCHATOA', PAD + CARD_X, CARD_Y + 28);
    (doc as any).y = 0;

    // "PAYMENT RECEIPT" label
    doc.font('Helvetica').fontSize(9)
      .fillOpacity(0.85)
      .text('PAYMENT RECEIPT', PAD + CARD_X, CARD_Y + 56, { characterSpacing: 2 });
    doc.fillOpacity(1);
    (doc as any).y = 0;

    // Receipt number + date (right-aligned)
    fill(doc, WHITE);
    doc.font('Helvetica').fontSize(8).fillOpacity(0.85);
    doc.text(`No: ${data.receiptNumber}`, CARD_X, CARD_Y + 28, { width: CARD_W - PAD, align: 'right' });
    doc.text(fmtDate(data.completedAt),   CARD_X, CARD_Y + 44, { width: CARD_W - PAD, align: 'right' });
    doc.fillOpacity(1);
    (doc as any).y = 0;

    // ── Body start ────────────────────────────────────────────────────────────
    let y = CARD_Y + HEADER_H + 32;

    // ── Green success banner ──────────────────────────────────────────────────
    doc.rect(CARD_X + PAD, y, CW, 44).fill(GREEN_BG as any);
    // Green left accent bar
    doc.rect(CARD_X + PAD, y, 4, 44).fill(GREEN_BAR as any);
    fill(doc, GREEN_TEXT);
    doc.font('Helvetica-Bold').fontSize(11)
      .text('\u2713  Transaction Completed Successfully', CARD_X + PAD + 16, y + 15);
    (doc as any).y = 0;

    y += 60;

    // ── Greeting ──────────────────────────────────────────────────────────────
    fill(doc, DARK);
    doc.font('Helvetica-Bold').fontSize(18)
      .text('Your Payment is Complete', CARD_X + PAD, y);
    (doc as any).y = 0;
    y += 26;
    fill(doc, GREY);
    doc.font('Helvetica').fontSize(10).lineGap(4)
      .text(`Hi ${data.fullName},`, CARD_X + PAD, y);
    (doc as any).y = 0;
    y += 16;
    doc.text('Your transaction has been completed successfully. Please keep this receipt.', CARD_X + PAD, y, { width: CW, lineBreak: false });
    (doc as any).y = 0;
    y += 40;

    // ── Amount highlight card ─────────────────────────────────────────────────
    doc.rect(CARD_X + PAD, y, CW, 70).fill(CARD_BG as any);
    stroke(doc, LINE_GREY);
    doc.roundedRect(CARD_X + PAD, y, CW, 70, 8).stroke();

    fill(doc, LABEL_GREY);
    doc.font('Helvetica').fontSize(8)
      .text('AMOUNT DISBURSED', CARD_X + PAD + 16, y + 12, { characterSpacing: 1.5 });
    (doc as any).y = 0;

    fill(doc, ORANGE);
    doc.font('Helvetica-Bold').fontSize(24)
      .text(fmt(data.foreignAmount, data.currency), CARD_X + PAD + 16, y + 26);
    (doc as any).y = 0;

    if (data.nairaEquivalent) {
      const rate = data.exchangeRate ? ` @ \u20A6${parseFloat(String(data.exchangeRate)).toLocaleString()}` : '';
      fill(doc, LABEL_GREY);
      doc.font('Helvetica').fontSize(8)
        .text(`\u2248 ${fmt(data.nairaEquivalent, 'NGN')}${rate}`, CARD_X + PAD + 16, y + 54);
      (doc as any).y = 0;
    }

    y += 86;

    // ── Transaction details table ─────────────────────────────────────────────
    const tableRows: [string, string][] = [
      ['TRANSACTION REFERENCE', data.referenceNumber],
      ['CUSTOMER NAME',         data.fullName],
      ['TRANSACTION TYPE',      fmtLabel(data.type)],
      ['PURPOSE',               data.purpose],
      ['DISBURSEMENT METHOD',   data.disbursementMethod ? fmtLabel(data.disbursementMethod) : '—'],
      ['DATE COMPLETED',        fmtDate(data.completedAt)],
    ];
    if (data.email)       tableRows.push(['EMAIL', data.email]);
    if (data.phoneNumber) tableRows.push(['PHONE', data.phoneNumber]);

    y = drawTable(doc, CARD_X + PAD, y, CW, tableRows);
    y += 20;

    // ── Beneficiary details ───────────────────────────────────────────────────
    if (data.beneficiaryDetails?.accountNumber) {
      const bRows: [string, string][] = [
        ['ACCOUNT NAME',   data.beneficiaryDetails.accountName   ?? '—'],
        ['ACCOUNT NUMBER', data.beneficiaryDetails.accountNumber],
        ['BANK',           data.beneficiaryDetails.bankName       ?? '—'],
      ];
      if (data.beneficiaryDetails.swiftCode) bRows.push(['SWIFT CODE', data.beneficiaryDetails.swiftCode]);
      if (data.beneficiaryDetails.iban)      bRows.push(['IBAN',       data.beneficiaryDetails.iban]);

      y = drawSection(doc, CARD_X + PAD, y, CW, 'BENEFICIARY DETAILS', bRows);
      y += 20;
    }

    // ── Cash pickup ───────────────────────────────────────────────────────────
    if (data.cashPickup?.pickupLocation) {
      const pRows: [string, string][] = [
        ['LOCATION',    data.cashPickup.pickupLocation],
        ['STATE / CITY', `${data.cashPickup.pickupState ?? ''} / ${data.cashPickup.pickupCity ?? ''}`],
        ['PICKUP CODE', data.cashPickup.pickupCode ?? '—'],
      ];
      if (data.cashPickup.recipientName) pRows.push(['RECIPIENT', data.cashPickup.recipientName]);

      y = drawSection(doc, CARD_X + PAD, y, CW, 'CASH PICKUP DETAILS', pRows);
      y += 20;
    }

    // ── Refund bank details ───────────────────────────────────────────────────
    if (data.refundBankDetails?.accountNumber) {
      const rRows: [string, string][] = [
        ['ACCOUNT NAME',   data.refundBankDetails.accountName   ?? '—'],
        ['ACCOUNT NUMBER', data.refundBankDetails.accountNumber],
        ['BANK',           data.refundBankDetails.bankName       ?? '—'],
      ];

      y = drawSection(doc, CARD_X + PAD, y, CW, 'REFUND BANK DETAILS', rRows);
      y += 20;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const FOOTER_H = 52;
    const FOOTER_Y = CARD_Y + CARD_H - FOOTER_H;

    doc.rect(CARD_X, FOOTER_Y, CARD_W, FOOTER_H).fill(PAGE_BG as any);

    // Divider line
    stroke(doc, LINE_GREY);
    doc.moveTo(CARD_X + PAD, FOOTER_Y).lineTo(CARD_X + CARD_W - PAD, FOOTER_Y).stroke();

    fill(doc, LABEL_GREY);
    doc.font('Helvetica').fontSize(8)
      .text('Sochatoa \u2014 Secure Foreign Exchange Platform', CARD_X, FOOTER_Y + 12, { width: CARD_W, align: 'center' });
    (doc as any).y = 0;
    doc.font('Helvetica').fontSize(8)
      .text('Need help? Contact us at support@sochatoa.com', CARD_X, FOOTER_Y + 26, { width: CARD_W, align: 'center' });
    (doc as any).y = 0;

    doc.end();
  });
}

// ── Draws a bordered table of [label, value] rows ────────────────────────────
function drawTable(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  rows: [string, string][]
): number {
  const ROW_H   = 30;
  const COL_L   = 180; // label column width
  const PADDING = 12;

  for (let i = 0; i < rows.length; i++) {
    const [label, value] = rows[i];
    const bg = i % 2 === 0 ? CARD_BG : WHITE;

    doc.rect(x, y, width, ROW_H).fill(bg as any);
    stroke(doc, LINE_GREY);
    doc.rect(x, y, width, ROW_H).stroke();

    fill(doc, LABEL_GREY);
    doc.font('Helvetica').fontSize(7.5)
      .text(label, x + PADDING, y + ROW_H / 2 - 4, { width: COL_L, lineBreak: false, characterSpacing: 0.8 });

    fill(doc, DARK);
    doc.font('Helvetica-Bold').fontSize(9)
      .text(value, x + COL_L + PADDING, y + ROW_H / 2 - 4.5, { width: width - COL_L - PADDING * 2, lineBreak: false });

    (doc as any).y = 0;
    y += ROW_H;
  }

  return y;
}

// ── Draws a titled section with its own table ─────────────────────────────────
function drawSection(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: [string, string][]
): number {
  fill(doc, DARK);
  doc.font('Helvetica-Bold').fontSize(9).text(title, x, y, { characterSpacing: 0.5, lineBreak: false });
  (doc as any).y = 0;
  y += 14;
  return drawTable(doc, x, y, width, rows);
}
