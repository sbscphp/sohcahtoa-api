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
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });
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
      prepaidCard: true,
    },
  });

  if (!transaction) throw new NotFoundError('Transaction not found');

  if (transaction.status !== 'COMPLETED') {
    throw new ValidationError('Receipt is only available for completed transactions');
  }

  // PickupStation — fetch address and phone using cashPickup.pickupLocationId
  const pickupStationInfo = transaction.cashPickup?.pickupLocationId
    ? await client.pickupStation.findUnique({
        where: { id: transaction.cashPickup.pickupLocationId },
        select: { address: true, phoneNumber: true },
      }).catch(() => null)
    : null;

  // OutboundSettlement is not a Prisma relation on Transaction — fetch separately
  const outboundSettlement = await client.outboundSettlement.findFirst({
    where: { transactionId: transaction.id },
    select: {
      paymentMethod: true,
      beneficiaryName: true,
      beneficiaryBank: true,
      beneficiaryAccount: true,
      beneficiarySwift: true,
      beneficiaryIban: true,
      paymentReference: true,
      amount: true,
      currency: true,
    },
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
    cashPickup:         transaction.cashPickup ? { ...transaction.cashPickup, pickupAddress: pickupStationInfo?.address ?? null, pickupPhone: pickupStationInfo?.phoneNumber ?? null } : null,
    prepaidCard:        transaction.prepaidCard ?? null,
    outboundSettlement: outboundSettlement ?? null,
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
  prepaidCard:        any;
  outboundSettlement: any;
}

function buildPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data',  (c: Buffer) => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = doc.page.width;   // 595.28
    const PH = doc.page.height;  // 841.89

    // ── Geometry ──────────────────────────────────────────────────────────────
    const CARD_X  = 22;
    const CARD_Y  = 22;
    const CARD_W  = PW - 44;        // 551.28
    const CARD_H  = PH - 44;        // 797.89
    const RADIUS  = 10;
    const PAD     = 18;
    const INNER_X = CARD_X + PAD;   // 40
    const INNER_W = CARD_W - PAD * 2; // 515.28

    // Two-column split: left = transaction info, right = payout details
    const COL_GAP = 12;
    const L_W     = Math.round(INNER_W * 0.44);   // ~227
    const R_X     = INNER_X + L_W + COL_GAP;
    const R_W     = INNER_W - L_W - COL_GAP;      // ~276

    // Fixed bottom zones
    const FOOTER_H = 34;
    const FOOTER_Y = CARD_Y + CARD_H - FOOTER_H;  // 785.89

    // ── Page background & card ────────────────────────────────────────────────
    doc.rect(0, 0, PW, PH).fill(PAGE_BG as any);
    doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, RADIUS).fill(WHITE as any);

    // ── Orange header ─────────────────────────────────────────────────────────
    const HEADER_H = 66;
    doc.save();
    doc.roundedRect(CARD_X, CARD_Y, CARD_W, HEADER_H + RADIUS, RADIUS).clip();
    doc.rect(CARD_X, CARD_Y + RADIUS, CARD_W, HEADER_H).fill(ORANGE as any);
    doc.roundedRect(CARD_X, CARD_Y, CARD_W, HEADER_H, RADIUS).fill(ORANGE as any);
    doc.restore();

    txt(doc, 'SOHCAHTOA', INNER_X, CARD_Y + 13, { font: 'Helvetica-Bold', size: 16, color: WHITE });
    doc.fillOpacity(0.85);
    txt(doc, 'PAYMENT RECEIPT', INNER_X, CARD_Y + 33, { font: 'Helvetica', size: 7.5, color: WHITE, characterSpacing: 2 });
    doc.fillOpacity(1);
    const rCol = CARD_X + CARD_W - PAD;
    doc.fillOpacity(0.85);
    txt(doc, `No: ${data.receiptNumber}`, rCol - 150, CARD_Y + 13, { font: 'Helvetica', size: 7.5, color: WHITE, width: 150, align: 'right' });
    txt(doc, fmtDate(data.completedAt),   rCol - 150, CARD_Y + 25, { font: 'Helvetica', size: 7.5, color: WHITE, width: 150, align: 'right' });
    doc.fillOpacity(1);

    // ── Body ──────────────────────────────────────────────────────────────────
    let y = CARD_Y + HEADER_H + 10;

    // Success banner — full width
    doc.rect(INNER_X, y, INNER_W, 22).fill(GREEN_BG as any);
    doc.rect(INNER_X, y, 3, 22).fill(GREEN_BAR as any);
    txt(doc, '\u2713  Transaction Completed Successfully', INNER_X + 10, y + 6, { font: 'Helvetica-Bold', size: 8.5, color: GREEN_TEXT });
    y += 28;

    // Amount card — full width
    const AMT_H = 44;
    doc.rect(INNER_X, y, INNER_W, AMT_H).fill(CARD_BG as any);
    doc.strokeColor(LINE_GREY as any).rect(INNER_X, y, INNER_W, AMT_H).stroke();
    txt(doc, 'AMOUNT DISBURSED', INNER_X + 12, y + 6, { font: 'Helvetica', size: 7, color: LABEL_GREY, characterSpacing: 1.2 });
    txt(doc, fmt(data.foreignAmount, data.currency), INNER_X + 12, y + 16, { font: 'Helvetica-Bold', size: 18, color: ORANGE });
    if (data.nairaEquivalent) {
      const rateStr = data.exchangeRate ? ` @ \u20A6${parseFloat(String(data.exchangeRate)).toLocaleString()}` : '';
      txt(doc, `\u2248 ${fmt(data.nairaEquivalent, 'NGN')}${rateStr}`, INNER_X + 12, y + 33, { font: 'Helvetica', size: 7, color: LABEL_GREY });
    }
    // Customer name on the right of the amount card
    txt(doc, data.fullName, rCol - 180, y + 16, { font: 'Helvetica-Bold', size: 10, color: DARK, width: 180, align: 'right' });
    txt(doc, data.email || data.phoneNumber || '', rCol - 180, y + 30, { font: 'Helvetica', size: 7, color: LABEL_GREY, width: 180, align: 'right' });
    y += AMT_H + 10;

    // ── Two-column content area ───────────────────────────────────────────────
    const colY = y;

    // LEFT: transaction details table
    const txRows: [string, string][] = [
      ['REFERENCE', data.referenceNumber],
      ['TYPE',      fmtLabel(data.type)],
      ['PURPOSE',   data.purpose],
      ['METHOD',    data.disbursementMethod ? fmtLabel(data.disbursementMethod) : '—'],
      ['DATE',      fmtDate(data.completedAt)],
      ['EMAIL',     data.email || '—'],
      ['PHONE',     data.phoneNumber || '—'],
    ];
    // Left column header label
    txt(doc, 'TRANSACTION DETAILS', INNER_X, colY, { font: 'Helvetica-Bold', size: 7.5, color: DARK, characterSpacing: 0.4 });
    const leftEnd = drawTable(doc, INNER_X, colY + 10, L_W, txRows);

    // RIGHT: payout sections stacked vertically
    let ry = colY;
    const GAP = 8;

    if (data.beneficiaryDetails?.accountNumber) {
      const bRows: [string, string][] = [
        ['ACCT NAME',   data.beneficiaryDetails.accountName ?? '—'],
        ['ACCT NUMBER', data.beneficiaryDetails.accountNumber],
        ['BANK',        data.beneficiaryDetails.bankName ?? '—'],
      ];
      if (data.beneficiaryDetails.swiftCode) bRows.push(['SWIFT', data.beneficiaryDetails.swiftCode]);
      if (data.beneficiaryDetails.iban)      bRows.push(['IBAN',  data.beneficiaryDetails.iban]);
      ry = drawSection(doc, R_X, ry, R_W, 'BENEFICIARY DETAILS', bRows) + GAP;
    }

    if (data.cashPickup?.pickupLocation) {
      const pRows: [string, string][] = [
        ['LOCATION',  data.cashPickup.pickupLocation],
        ['STATE/CITY',`${data.cashPickup.pickupState ?? ''} / ${data.cashPickup.pickupCity ?? ''}`],
        ['CODE',      data.cashPickup.pickupCode ?? '—'],
        ['AMOUNT',    fmt(data.cashPickup.amount, data.cashPickup.currency ?? data.currency)],
      ];
      if (data.cashPickup.pickupAddress) pRows.push(['ADDRESS',   data.cashPickup.pickupAddress]);
      if (data.cashPickup.pickupPhone)   pRows.push(['PHONE',     data.cashPickup.pickupPhone]);
      if (data.cashPickup.recipientName) pRows.push(['RECIPIENT', data.cashPickup.recipientName]);
      ry = drawSection(doc, R_X, ry, R_W, 'CASH PICKUP', pRows) + GAP;
    }

    if (data.prepaidCard?.cardNumber) {
      const cRows: [string, string][] = [
        ['CARD TYPE',  data.prepaidCard.cardType ?? '—'],
        ['CARD NO.',   `**** **** **** ${data.prepaidCard.cardNumber.slice(-4)}`],
        ['AMOUNT',     fmt(data.prepaidCard.amount, data.prepaidCard.currency ?? data.currency)],
        ['STATUS',     data.prepaidCard.activationStatus ?? '—'],
      ];
      ry = drawSection(doc, R_X, ry, R_W, 'PREPAID CARD', cRows) + GAP;
    }

    if (data.outboundSettlement) {
      const os = data.outboundSettlement;
      const osRows: [string, string][] = [];
      if (os.paymentMethod)      osRows.push(['METHOD',       fmtLabel(os.paymentMethod)]);
      if (os.beneficiaryName)    osRows.push(['PAYEE NAME',   os.beneficiaryName]);
      if (os.beneficiaryBank)    osRows.push(['PAYEE BANK',   os.beneficiaryBank]);
      if (os.beneficiaryAccount) osRows.push(['ACCOUNT',      os.beneficiaryAccount]);
      if (os.beneficiarySwift)   osRows.push(['SWIFT / BIC',  os.beneficiarySwift]);
      if (os.beneficiaryIban && os.beneficiaryIban !== os.beneficiaryAccount) osRows.push(['IBAN', os.beneficiaryIban]);
      if (os.paymentReference)   osRows.push(['PAYMENT REF',  os.paymentReference]);
      if (osRows.length > 0) ry = drawSection(doc, R_X, ry, R_W, 'PAYOUT DETAILS', osRows) + GAP;
    }

    if (data.refundBankDetails?.accountNumber) {
      const rRows: [string, string][] = [
        ['ACCT NAME',   data.refundBankDetails.accountName ?? '—'],
        ['ACCT NUMBER', data.refundBankDetails.accountNumber],
        ['BANK',        data.refundBankDetails.bankName ?? '—'],
      ];
      ry = drawSection(doc, R_X, ry, R_W, 'REFUND BANK DETAILS', rRows) + GAP;
    }

    // Advance y past both columns
    y = Math.max(leftEnd, ry) + 12;

    // ── CBN certificate stamp — full width, inline after columns ─────────────
    {
      const SX     = INNER_X;
      const SW     = INNER_W;
      const BAND_H = 18;
      const BODY_H = 70;   // fields + signature
      const SH     = BAND_H + BODY_H;
      const SY     = y;

      doc.save();
      doc.rect(SX, SY, SW, SH).lineWidth(1.5).stroke(ORANGE as any);
      doc.rect(SX + 3, SY + 3, SW - 6, SH - 6).lineWidth(0.4).stroke(ORANGE as any);
      doc.rect(SX + 3, SY + 3, SW - 6, BAND_H).fill(ORANGE as any);
      txt(doc, 'FOREIGN EXCHANGE TRANSACTION CERTIFICATE', SX, SY + 8, {
        font: 'Helvetica-Bold', size: 7.5, color: WHITE, width: SW, align: 'center', characterSpacing: 0.8,
      });

      // Watermark
      doc.save();
      doc.fillColor(ORANGE as any).fillOpacity(0.05).font('Helvetica-Bold').fontSize(24);
      const wmW = doc.widthOfString('SOHCAHTOA');
      doc.text('SOHCAHTOA', SX + (SW - wmW) / 2, SY + BAND_H + 18, { lineBreak: false });
      (doc as any).y = 1;
      doc.restore();

      // Three-column fields inside the stamp
      const NUM_COLS  = 3;
      const FPAD      = 10;
      const FCOL_W    = (SW - FPAD * 2) / NUM_COLS;
      const FY        = SY + BAND_H + 8;
      const FLH       = 13;

      const fxAmt    = parseFloat(String(data.foreignAmount ?? 0));
      const nairaAmt = parseFloat(String(data.nairaEquivalent ?? 0));
      const rate     = parseFloat(String(data.exchangeRate ?? 0));

      const stampFields: [string, string][] = [
        ['Foreign Currency',  data.currency ?? '—'],
        ['Amount of FX Sold', `${data.currency} ${fxAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ['Purpose',           data.purpose ?? '—'],
        ['PTA',               data.type === 'PTA' ? 'Yes' : 'N/A'],
        ['Value in Naira',    `\u20A6${nairaAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ['Date',              fmtDate(data.completedAt)],
        ['Exchange Rate',     rate > 0 ? `\u20A6${rate.toLocaleString('en-US', { minimumFractionDigits: 2 })} / ${data.currency}` : '—'],
        ['Reference',         data.referenceNumber],
      ];

      for (let i = 0; i < stampFields.length; i++) {
        const col = i % NUM_COLS;
        const row = Math.floor(i / NUM_COLS);
        const fx  = SX + FPAD + col * FCOL_W;
        const fy  = FY + row * FLH;
        txt(doc, stampFields[i][0] + ':', fx, fy, { font: 'Helvetica', size: 6, color: LABEL_GREY, width: FCOL_W - 2 });
        txt(doc, stampFields[i][1], fx, fy + 7, { font: 'Helvetica-Bold', size: 7, color: DARK, width: FCOL_W - 4 });
      }

      // Signature row
      const SIG_Y = SY + SH - 20;
      doc.moveTo(SX + 8, SIG_Y).lineTo(SX + SW - 8, SIG_Y).lineWidth(0.3).stroke(LINE_GREY as any);
      const SIG_MID = SX + SW / 2;
      txt(doc, 'Authorized Signature:', SX + FPAD, SIG_Y + 5, { font: 'Helvetica', size: 6.5, color: LABEL_GREY, width: 110 });
      doc.moveTo(SX + FPAD + 102, SIG_Y + 9).lineTo(SIG_MID - 6, SIG_Y + 9).lineWidth(0.3).dash(2, { space: 2 }).stroke(DARK as any);
      doc.undash();
      txt(doc, 'Official Stamp', SIG_MID + 6, SIG_Y + 5, { font: 'Helvetica', size: 6.5, color: LABEL_GREY, width: 80 });

      doc.restore();
      y += SH + 8;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.rect(CARD_X, FOOTER_Y, CARD_W, FOOTER_H).fill(PAGE_BG as any);
    doc.strokeColor(LINE_GREY as any).moveTo(INNER_X, FOOTER_Y).lineTo(CARD_X + CARD_W - PAD, FOOTER_Y).stroke();
    txt(doc, 'SohCahToa \u2014 Licensed & Regulated by the Central Bank of Nigeria',
      CARD_X, FOOTER_Y + 7, { font: 'Helvetica', size: 7, color: LABEL_GREY, width: CARD_W, align: 'center' });
    txt(doc, 'support@sohcahtoabdc.com',
      CARD_X, FOOTER_Y + 19, { font: 'Helvetica', size: 7, color: LABEL_GREY, width: CARD_W, align: 'center' });

    doc.end();
  });
}

// ── Table ─────────────────────────────────────────────────────────────────────
// Rows are [label, value]. COL_L scales to 40% of width for narrow columns.
function drawTable(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  rows: [string, string][]
): number {
  const ROW_H = 17;
  const COL_L = Math.round(width * 0.38);
  const PADH  = 7;

  for (let i = 0; i < rows.length; i++) {
    const [label, value] = rows[i];
    const bg = i % 2 === 0 ? CARD_BG : WHITE;
    doc.rect(x, y, width, ROW_H).fill(bg as any);
    doc.strokeColor(LINE_GREY as any).rect(x, y, width, ROW_H).stroke();
    txt(doc, label, x + PADH, y + ROW_H / 2 - 3, {
      font: 'Helvetica', size: 6.5, color: LABEL_GREY, characterSpacing: 0.4,
      width: COL_L - PADH, lineBreak: false,
    });
    txt(doc, value, x + COL_L + PADH, y + ROW_H / 2 - 3.5, {
      font: 'Helvetica-Bold', size: 7.5, color: DARK,
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
  txt(doc, title, x, y, { font: 'Helvetica-Bold', size: 7.5, color: DARK, characterSpacing: 0.4 });
  return drawTable(doc, x, y + 10, width, rows);
}
