import PDFDocument from 'pdfkit';
import { getDatabase } from '../../config/database';
import { NotFoundError, ValidationError } from '../utils';
import { createLogger } from '../utils/logger';

const prisma = getDatabase();
const logger = createLogger('receipt-service');

// ── Brand tokens ──────────────────────────────────────────────────────────────
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

/**
 * Draw text at an absolute position and immediately reset PDFKit's internal
 * cursor to 1 so it can never drift past the page height and trigger
 * an automatic page addition.
 */
function txt(
  doc: PDFKit.PDFDocument,
  str: string,
  x: number,
  y: number,
  opts: PDFKit.Mixins.TextOptions & { color?: string; font?: string; size?: number } = {}
) {
  const { color, font, size, ...rest } = opts;
  if (font)  doc.font(font);
  if (size)  doc.fontSize(size);
  if (color) doc.fillColor(color as any);
  doc.text(str, x, y, { lineBreak: false, ...rest });
  // Reset cursor — PDFKit only auto-paginates when doc.y exceeds page height
  (doc as any).y = 1;
}

/**
 * Generates an on-demand PDF receipt for a completed transaction.
 */
export async function generateTransactionReceipt(
  transactionId: string,
  requesterId: string,
  requesterRole: 'CUSTOMER' | 'AGENT' | 'ADMIN'
): Promise<{ pdf: Buffer; filename: string; referenceNumber: string }> {
  logger.info('[generateReceipt] Generating receipt', { transactionId, requesterId, requesterRole });

  const client = prisma as any;

  const accessWhere = await buildAccessWhere(transactionId, requesterId, requesterRole);
  const transaction = await client.transaction.findFirst({
    where: accessWhere,
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

  // OutboundSettlement is not a Prisma relation on Transaction — fetch separately
  const outboundSettlement = await client.outboundSettlement.findFirst({
    where: { transactionId: transaction.id },
    select: { paymentMethod: true },
  }).catch(() => null);

  const personalInfoStep =
    transaction.steps.find((s: any) => s.step === 'PERSONAL_INFO') ??
    transaction.steps.find((s: any) => s.step === 'DOCUMENT_UPLOAD');
  const stepData           = (personalInfoStep?.data as any) ?? {};
  const beneficiaryDetails = stepData.beneficiaryDetails ?? null;
  const refundBankDetails  = stepData.refundBankDetails  ?? null;

  const firstName = transaction.user?.profile?.firstName ?? '';
  const lastName  = transaction.user?.profile?.lastName  ?? '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ') || 'Customer';
  const receiptNum = `RCP-${transaction.referenceNumber}`;

  // Prefer the outbound settlement payment method (set at actual disbursement time)
  // over transaction.disbursementMethod (set at approval time and may lag)
  const disbursementMethod =
    outboundSettlement?.paymentMethod
    ?? transaction.disbursementMethod
    ?? null;

  const pdf = await buildPdf({
    receiptNumber:      receiptNum,
    referenceNumber:    transaction.referenceNumber,
    fullName,
    email:              transaction.user?.email ?? '',
    phoneNumber:        transaction.user?.phoneNumber ?? '',
    type:               transaction.type,
    purpose:            transaction.purpose,
    currency:           transaction.currency,
    foreignAmount:      transaction.foreignAmount,
    nairaEquivalent:    transaction.nairaEquivalent,
    exchangeRate:       transaction.exchangeRate,
    disbursementMethod,
    completedAt:        transaction.updatedAt,
    beneficiaryDetails,
    refundBankDetails,
    cashPickup:         transaction.cashPickup ?? null,
  });

  const filename = `receipt-${transaction.referenceNumber}.pdf`;
  logger.info('[generateReceipt] Receipt generated', { transactionId, receiptNum });

  return { pdf, filename, referenceNumber: transaction.referenceNumber };
}

async function buildAccessWhere(transactionId: string, requesterId: string, role: string) {
  const idFilter = { OR: [{ id: transactionId }, { referenceNumber: transactionId }] };
  if (role === 'CUSTOMER') return { ...idFilter, userId: requesterId };
  if (role === 'AGENT') {
    // Agent.id ≠ User.id — resolve Agent record from the authenticated user's email
    const agentUser = await prisma.user.findUnique({ where: { id: requesterId }, select: { email: true } });
    const agent = agentUser
      ? await (prisma as any).agent.findUnique({ where: { email: agentUser.email }, select: { id: true } })
      : null;
    return { ...idFilter, createdByAgentId: agent?.id ?? '__not_found__' };
  }
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
    // autoFirstPage:true — exactly one page created up front, no more
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];

    doc.on('data',  (c: Buffer) => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = doc.page.width;   // 595.28
    const PH = doc.page.height;  // 841.89

    // ── Page & card geometry ──────────────────────────────────────────────────
    const CARD_X  = 28;
    const CARD_Y  = 28;
    const CARD_W  = PW - 56;
    const CARD_H  = PH - 56;
    const RADIUS  = 12;
    const PAD     = 24;           // inner horizontal padding
    const INNER_X = CARD_X + PAD;
    const INNER_W = CARD_W - PAD * 2;

    // ── Page background ───────────────────────────────────────────────────────
    doc.rect(0, 0, PW, PH).fill(PAGE_BG as any);

    // ── White card ────────────────────────────────────────────────────────────
    doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, RADIUS).fill(WHITE as any);

    // ── Orange header (top-rounded only) ─────────────────────────────────────
    const HEADER_H = 96;
    doc.save();
    doc.roundedRect(CARD_X, CARD_Y, CARD_W, HEADER_H + RADIUS, RADIUS).clip();
    doc.rect(CARD_X, CARD_Y + RADIUS, CARD_W, HEADER_H).fill(ORANGE as any);
    doc.roundedRect(CARD_X, CARD_Y, CARD_W, HEADER_H, RADIUS).fill(ORANGE as any);
    doc.restore();

    // Brand name
    txt(doc, 'SOCHATOA', INNER_X, CARD_Y + 22, { font: 'Helvetica-Bold', size: 18, color: WHITE });

    // "PAYMENT RECEIPT" label
    doc.fillOpacity(0.85);
    txt(doc, 'PAYMENT RECEIPT', INNER_X, CARD_Y + 46, {
      font: 'Helvetica', size: 8, color: WHITE, characterSpacing: 2,
    });
    doc.fillOpacity(1);

    // Receipt number + date — right-aligned, calculated manually
    doc.fillOpacity(0.85);
    const rCol = CARD_X + CARD_W - PAD;
    txt(doc, `No: ${data.receiptNumber}`, rCol - 160, CARD_Y + 22, {
      font: 'Helvetica', size: 7.5, color: WHITE, width: 160, align: 'right',
    });
    txt(doc, fmtDate(data.completedAt), rCol - 160, CARD_Y + 36, {
      font: 'Helvetica', size: 7.5, color: WHITE, width: 160, align: 'right',
    });
    doc.fillOpacity(1);

    // ── Body ─────────────────────────────────────────────────────────────────
    let y = CARD_Y + HEADER_H + 20;

    // Green success banner
    doc.rect(INNER_X, y, INNER_W, 36).fill(GREEN_BG as any);
    doc.rect(INNER_X, y, 3, 36).fill(GREEN_BAR as any);
    txt(doc, '\u2713  Transaction Completed Successfully', INNER_X + 12, y + 11, {
      font: 'Helvetica-Bold', size: 10, color: GREEN_TEXT,
    });
    y += 46;

    // Greeting
    txt(doc, 'Payment Receipt', INNER_X, y, { font: 'Helvetica-Bold', size: 15, color: DARK });
    y += 20;
    txt(doc, `Hi ${data.fullName} — your transaction is complete. Keep this as your official receipt.`,
      INNER_X, y, { font: 'Helvetica', size: 9, color: GREY, width: INNER_W });
    y += 22;

    // Amount highlight card
    doc.rect(INNER_X, y, INNER_W, 58).fill(CARD_BG as any);
    doc.strokeColor(LINE_GREY as any).rect(INNER_X, y, INNER_W, 58).stroke();

    txt(doc, 'AMOUNT DISBURSED', INNER_X + 14, y + 9, {
      font: 'Helvetica', size: 7.5, color: LABEL_GREY, characterSpacing: 1.2,
    });
    txt(doc, fmt(data.foreignAmount, data.currency), INNER_X + 14, y + 22, {
      font: 'Helvetica-Bold', size: 20, color: ORANGE,
    });
    if (data.nairaEquivalent) {
      const rate = data.exchangeRate
        ? ` @ \u20A6${parseFloat(String(data.exchangeRate)).toLocaleString()}`
        : '';
      txt(doc, `\u2248 ${fmt(data.nairaEquivalent, 'NGN')}${rate}`, INNER_X + 14, y + 44, {
        font: 'Helvetica', size: 7.5, color: LABEL_GREY,
      });
    }
    y += 68;

    // ── Transaction details table ─────────────────────────────────────────────
    const tableRows: [string, string][] = [
      ['REFERENCE',      data.referenceNumber],
      ['CUSTOMER',       data.fullName],
      ['TYPE',           fmtLabel(data.type)],
      ['PURPOSE',        data.purpose],
      ['METHOD',         data.disbursementMethod ? fmtLabel(data.disbursementMethod) : '—'],
      ['DATE',           fmtDate(data.completedAt)],
    ];
    if (data.email)       tableRows.push(['EMAIL', data.email]);
    if (data.phoneNumber) tableRows.push(['PHONE', data.phoneNumber]);

    y = drawTable(doc, INNER_X, y, INNER_W, tableRows);
    y += 12;

    // ── Beneficiary details ───────────────────────────────────────────────────
    if (data.beneficiaryDetails?.accountNumber) {
      const bRows: [string, string][] = [
        ['ACCOUNT NAME',   data.beneficiaryDetails.accountName   ?? '—'],
        ['ACCOUNT NUMBER', data.beneficiaryDetails.accountNumber],
        ['BANK',           data.beneficiaryDetails.bankName       ?? '—'],
      ];
      if (data.beneficiaryDetails.swiftCode) bRows.push(['SWIFT CODE', data.beneficiaryDetails.swiftCode]);
      if (data.beneficiaryDetails.iban)      bRows.push(['IBAN',       data.beneficiaryDetails.iban]);
      y = drawSection(doc, INNER_X, y, INNER_W, 'BENEFICIARY DETAILS', bRows);
      y += 12;
    }

    // ── Cash pickup ───────────────────────────────────────────────────────────
    if (data.cashPickup?.pickupLocation) {
      const pRows: [string, string][] = [
        ['LOCATION',     data.cashPickup.pickupLocation],
        ['STATE / CITY', `${data.cashPickup.pickupState ?? ''} / ${data.cashPickup.pickupCity ?? ''}`],
        ['PICKUP CODE',  data.cashPickup.pickupCode ?? '—'],
      ];
      if (data.cashPickup.recipientName) pRows.push(['RECIPIENT', data.cashPickup.recipientName]);
      y = drawSection(doc, INNER_X, y, INNER_W, 'CASH PICKUP DETAILS', pRows);
      y += 12;
    }

    // ── Refund bank details ───────────────────────────────────────────────────
    if (data.refundBankDetails?.accountNumber) {
      const rRows: [string, string][] = [
        ['ACCOUNT NAME',   data.refundBankDetails.accountName   ?? '—'],
        ['ACCOUNT NUMBER', data.refundBankDetails.accountNumber],
        ['BANK',           data.refundBankDetails.bankName       ?? '—'],
      ];
      y = drawSection(doc, INNER_X, y, INNER_W, 'REFUND BANK DETAILS', rRows);
    }

    // ── Footer (always pinned to card bottom) ─────────────────────────────────
    const FOOTER_H = 44;
    const FOOTER_Y = CARD_Y + CARD_H - FOOTER_H;

    doc.rect(CARD_X, FOOTER_Y, CARD_W, FOOTER_H).fill(PAGE_BG as any);
    doc.strokeColor(LINE_GREY as any)
      .moveTo(INNER_X, FOOTER_Y)
      .lineTo(CARD_X + CARD_W - PAD, FOOTER_Y)
      .stroke();

    txt(doc, 'SohCahToa \u2014 Licensed & Regulated by the Central Bank of Nigeria',
      CARD_X, FOOTER_Y + 9, { font: 'Helvetica', size: 7.5, color: LABEL_GREY, width: CARD_W, align: 'center' });
    txt(doc, 'support@sohcahtoabdc.com',
      CARD_X, FOOTER_Y + 23, { font: 'Helvetica', size: 7.5, color: LABEL_GREY, width: CARD_W, align: 'center' });

    doc.end();
  });
}

// ── Table ─────────────────────────────────────────────────────────────────────
function drawTable(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  rows: [string, string][]
): number {
  const ROW_H  = 24;
  const COL_L  = 140;
  const PADH   = 10;

  for (let i = 0; i < rows.length; i++) {
    const [label, value] = rows[i];
    const bg = i % 2 === 0 ? CARD_BG : WHITE;

    doc.rect(x, y, width, ROW_H).fill(bg as any);
    doc.strokeColor(LINE_GREY as any).rect(x, y, width, ROW_H).stroke();

    txt(doc, label, x + PADH, y + ROW_H / 2 - 4, {
      font: 'Helvetica', size: 7, color: LABEL_GREY, characterSpacing: 0.6,
      width: COL_L - PADH, lineBreak: false,
    });
    txt(doc, value, x + COL_L + PADH, y + ROW_H / 2 - 4.5, {
      font: 'Helvetica-Bold', size: 8, color: DARK,
      width: width - COL_L - PADH * 2, lineBreak: false,
    });

    y += ROW_H;
  }

  return y;
}

// ── Section (title + table) ───────────────────────────────────────────────────
function drawSection(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: [string, string][]
): number {
  txt(doc, title, x, y, { font: 'Helvetica-Bold', size: 8, color: DARK, characterSpacing: 0.5 });
  y += 12;
  return drawTable(doc, x, y, width, rows);
}
