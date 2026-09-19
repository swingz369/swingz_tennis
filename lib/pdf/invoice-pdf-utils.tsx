import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { InvoiceWithItems } from '../types/billing';

export interface InvoicePDFData {
  invoice: InvoiceWithItems;
  clubName: string;
  clubAddress: string;
  clubEmail: string;
  clubPhone: string;
  memberName: string;
  memberAddress: string;
  memberEmail: string;
  /** Vom Verein gestaltbare Teile — alles optional, ohne Angabe bleibt die Rechnung schlicht. */
  branding?: InvoiceBranding;
}

/** Aus `clubs` geladen (lib/pdf/invoice-issuer.ts); Freitexte aus `clubs.legal_info`. */
export interface InvoiceBranding {
  /** Hex, z. B. `#1e3a5f` (clubs.primary_color) */
  accentColor?: string | null;
  logo?: { bytes: Uint8Array; type: 'png' | 'jpg' } | null;
  steuernummer?: string;
  registerzeile?: string;
  bank?: string;
  iban?: string;
  bic?: string;
  /** Text über den Positionen (`rechnungstext`) */
  introText?: string;
  /** Text in der Fußzeile (`rechnungsfusszeile`) */
  footerText?: string;
}

function hexToRgb(hex: string | null | undefined) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// ─── Layout constants ───
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const COLORS = {
  black: rgb(0.1, 0.1, 0.1),
  gray: rgb(0.4, 0.4, 0.4),
  lightGray: rgb(0.75, 0.75, 0.75),
  veryLightGray: rgb(0.92, 0.92, 0.92),
  white: rgb(1, 1, 1),
  accent: rgb(0.12, 0.22, 0.37), // brand navy
  green: rgb(0.06, 0.72, 0.51),
  blue: rgb(0.23, 0.51, 0.96),
  red: rgb(0.94, 0.27, 0.27),
};

const STATUS_COLORS: Record<string, ReturnType<typeof rgb>> = {
  draft: COLORS.gray,
  open: COLORS.blue,
  sent: COLORS.blue,
  paid: COLORS.green,
  overdue: COLORS.red,
  cancelled: COLORS.lightGray,
  refunded: rgb(0.96, 0.62, 0.04),
};

function formatCurrency(amount: number, currency: string | null = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(amount);
}

function formatDate(dateString: string | Date | null): string {
  if (!dateString) return '—';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('de-DE');
}

interface DrawContext {
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  accent: ReturnType<typeof rgb>;
  y: number;
}

function drawText(
  ctx: DrawContext,
  text: string,
  x: number,
  options?: {
    size?: number;
    font?: PDFFont;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  }
) {
  const size = options?.size ?? 10;
  const font = options?.font ?? ctx.font;
  const color = options?.color ?? COLORS.black;

  ctx.page.drawText(text, {
    x,
    y: ctx.y,
    size,
    font,
    color,
    ...(options?.maxWidth ? { maxWidth: options.maxWidth } : {}),
  });
}

function drawLine(
  ctx: DrawContext,
  x1: number,
  x2: number,
  color = COLORS.lightGray,
  thickness = 0.5
) {
  ctx.page.drawLine({
    start: { x: x1, y: ctx.y },
    end: { x: x2, y: ctx.y },
    thickness,
    color,
  });
}

function drawSectionTitle(ctx: DrawContext, title: string) {
  ctx.y -= 8;
  drawText(ctx, title, MARGIN, { size: 12, font: ctx.boldFont, color: ctx.accent });
  ctx.y -= 4;
  drawLine(ctx, MARGIN, MARGIN + CONTENT_WIDTH, ctx.accent, 1);
  ctx.y -= 14;
}

function drawRow(ctx: DrawContext, label: string, value: string) {
  drawText(ctx, label, MARGIN, { size: 9, color: COLORS.gray });
  drawText(ctx, value, MARGIN + 120, { size: 9 });
  ctx.y -= 14;
}

function ensureSpace(ctx: DrawContext, needed: number): PDFPage {
  if (ctx.y - needed < MARGIN + 50) {
    // Add a new page
    const doc = ctx.page.doc;
    const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.page = newPage;
    ctx.y = PAGE_HEIGHT - MARGIN;
  }
  return ctx.page;
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  const {
    invoice,
    clubName,
    clubAddress,
    clubEmail,
    clubPhone,
    memberName,
    memberAddress,
    memberEmail,
    branding = {},
  } = data;
  const accent = hexToRgb(branding.accentColor) ?? COLORS.accent;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const ctx: DrawContext = { page, font, boldFont, accent, y: PAGE_HEIGHT - MARGIN };

  // ─── Header ───
  if (branding.logo) {
    try {
      const img =
        branding.logo.type === 'png'
          ? await doc.embedPng(branding.logo.bytes)
          : await doc.embedJpg(branding.logo.bytes);
      const scaled = img.scaleToFit(120, 50);
      page.drawImage(img, {
        x: PAGE_WIDTH - MARGIN - scaled.width,
        y: PAGE_HEIGHT - MARGIN - scaled.height + 14,
        width: scaled.width,
        height: scaled.height,
      });
    } catch {
      // kaputtes Logo darf die Rechnung nicht verhindern
    }
  }
  drawText(ctx, 'RECHNUNG', MARGIN, { size: 22, font: boldFont, color: accent });
  ctx.y -= 18;
  drawText(ctx, clubName, MARGIN, { size: 9, color: COLORS.gray });
  ctx.y -= 20;

  // Status badge
  const status = (invoice.status || 'draft').toUpperCase();
  const statusColor = STATUS_COLORS[invoice.status || 'draft'] || COLORS.gray;
  const statusWidth = font.widthOfTextAtSize(status, 9) + 16;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 3,
    width: statusWidth,
    height: 16,
    color: statusColor,
  });
  drawText(ctx, status, MARGIN + 8, { size: 9, font: boldFont, color: COLORS.white });
  ctx.y -= 28;

  // ─── Rechnungsdetails ───
  drawSectionTitle(ctx, 'Rechnungsdetails');
  drawRow(ctx, 'Rechnungsnummer:', invoice.invoice_number);
  drawRow(ctx, 'Rechnungsdatum:', formatDate(invoice.created_at));
  drawRow(ctx, 'Fälligkeitsdatum:', formatDate(invoice.due_date));
  ctx.y -= 6;

  // ─── Rechnungssteller ───
  drawSectionTitle(ctx, 'Rechnungssteller');
  drawText(ctx, clubName, MARGIN, { size: 10, font: boldFont });
  ctx.y -= 14;
  if (clubAddress) {
    drawText(ctx, clubAddress, MARGIN, { size: 9 });
    ctx.y -= 14;
  }
  if (clubEmail) drawRow(ctx, 'E-Mail:', clubEmail);
  if (clubPhone) {
    drawRow(ctx, 'Telefon:', clubPhone);
  }
  if (branding.steuernummer) drawRow(ctx, 'Steuernummer:', branding.steuernummer);
  if (branding.registerzeile) drawRow(ctx, 'Vereinsregister:', branding.registerzeile);
  ctx.y -= 6;

  // ─── Rechnungsempfänger ───
  drawSectionTitle(ctx, 'Rechnungsempfänger');
  drawText(ctx, memberName, MARGIN, { size: 10, font: boldFont });
  ctx.y -= 14;
  if (memberAddress) {
    drawText(ctx, memberAddress, MARGIN, { size: 9 });
    ctx.y -= 14;
  }
  drawRow(ctx, 'E-Mail:', memberEmail);
  ctx.y -= 6;

  if (branding.introText) {
    for (const line of branding.introText.split('\n')) {
      ensureSpace(ctx, 16);
      drawText(ctx, line, MARGIN, { size: 9 });
      ctx.y -= 12;
    }
    ctx.y -= 8;
  }

  // ─── Rechnungspositionen ───
  drawSectionTitle(ctx, 'Rechnungspositionen');

  // Table header
  ensureSpace(ctx, 40);
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 3,
    width: CONTENT_WIDTH,
    height: 18,
    color: COLORS.veryLightGray,
  });
  const col1 = MARGIN + 4;
  const col2 = MARGIN + CONTENT_WIDTH * 0.55;
  const col3 = MARGIN + CONTENT_WIDTH * 0.72;
  const col4 = MARGIN + CONTENT_WIDTH * 0.88;

  drawText(ctx, 'Beschreibung', col1, { size: 8, font: boldFont });
  drawText(ctx, 'Menge', col2, { size: 8, font: boldFont });
  drawText(ctx, 'Einzelpreis', col3, { size: 8, font: boldFont });
  drawText(ctx, 'Gesamt', col4, { size: 8, font: boldFont });
  ctx.y -= 18;

  drawLine(ctx, MARGIN, MARGIN + CONTENT_WIDTH, COLORS.lightGray);
  ctx.y -= 6;

  // Table rows
  const items = invoice.items ?? [];
  for (const item of items) {
    ensureSpace(ctx, 20);
    const itemTotal = item.total_price ?? (item.quantity || 0) * item.unit_price;

    drawText(ctx, item.description || '', col1, { size: 9 });
    drawText(ctx, String(item.quantity ?? 1), col2, { size: 9 });
    drawText(ctx, formatCurrency(item.unit_price, invoice.currency), col3, { size: 9 });
    drawText(ctx, formatCurrency(itemTotal, invoice.currency), col4, { size: 9 });
    ctx.y -= 14;

    drawLine(ctx, MARGIN, MARGIN + CONTENT_WIDTH, COLORS.veryLightGray, 0.3);
    ctx.y -= 4;
  }

  // ─── Totals ───
  ctx.y -= 8;
  const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * item.unit_price, 0);
  const totalsX = MARGIN + CONTENT_WIDTH * 0.6;
  const totalsValX = MARGIN + CONTENT_WIDTH * 0.88;

  const drawTotalRow = (label: string, value: string, bold = false) => {
    drawText(ctx, label, totalsX, { size: 9, font: bold ? boldFont : font, color: COLORS.gray });
    drawText(ctx, value, totalsValX, { size: 9, font: bold ? boldFont : font });
    ctx.y -= 14;
  };

  drawTotalRow('Zwischensumme:', formatCurrency(subtotal, invoice.currency));
  drawTotalRow('MwSt.:', formatCurrency(invoice.tax_amount ?? 0, invoice.currency));
  ctx.y -= 2;
  drawLine(ctx, totalsX, MARGIN + CONTENT_WIDTH, COLORS.black, 1.5);
  ctx.y -= 8;
  drawTotalRow('Gesamtbetrag:', formatCurrency(invoice.amount, invoice.currency), true);

  // ─── Bankverbindung ───
  if (branding.iban) {
    ctx.y -= 10;
    ensureSpace(ctx, 70);
    drawSectionTitle(ctx, 'Bankverbindung');
    drawRow(ctx, 'Kontoinhaber:', clubName);
    if (branding.bank) drawRow(ctx, 'Bank:', branding.bank);
    drawRow(ctx, 'IBAN:', branding.iban);
    if (branding.bic) drawRow(ctx, 'BIC:', branding.bic);
    drawRow(ctx, 'Verwendungszweck:', invoice.invoice_number);
  }

  // ─── Notes ───
  if (invoice.notes) {
    ctx.y -= 10;
    ensureSpace(ctx, 60);
    drawSectionTitle(ctx, 'Bemerkungen');
    const notesLines = invoice.notes.split('\n');
    for (const line of notesLines) {
      ensureSpace(ctx, 16);
      drawText(ctx, line, MARGIN, { size: 9, color: COLORS.gray });
      ctx.y -= 12;
    }
  }

  // ─── Footer ───
  ensureSpace(ctx, 60);
  ctx.y = MARGIN + 50;
  drawLine(ctx, MARGIN, MARGIN + CONTENT_WIDTH, COLORS.lightGray);
  ctx.y -= 14;
  for (const line of (branding.footerText || 'Vielen Dank für Ihren Beitrag!')
    .split('\n')
    .slice(0, 3)) {
    const w = font.widthOfTextAtSize(line, 8);
    drawText(ctx, line, MARGIN + (CONTENT_WIDTH - w) / 2, { size: 8, color: COLORS.gray });
    ctx.y -= 12;
  }
  const contactText = `Bei Fragen: ${[clubEmail, clubPhone].filter(Boolean).join(' | ')}`;
  const contactWidth = font.widthOfTextAtSize(contactText, 8);
  drawText(ctx, contactText, MARGIN + (CONTENT_WIDTH - contactWidth) / 2, {
    size: 8,
    color: COLORS.gray,
  });

  // ─── Serialize ───
  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

export async function generateInvoicePDFBase64(data: InvoicePDFData): Promise<string> {
  const buffer = await generateInvoicePDF(data);
  return buffer.toString('base64');
}

export function getInvoiceFileName(invoiceNumber: string): string {
  return `Rechnung-${invoiceNumber}.pdf`;
}
