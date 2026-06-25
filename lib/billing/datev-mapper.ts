/**
 * DATEV Buchungsstapel CSV mapper (Format EXTF, Version 700).
 * Produces a CSV importable into DATEV Rechnungswesen / Lexware.
 *
 * Minimal required columns per DATEV spec:
 *   Umsatz · S/H-Kennzeichen · WKZ · Konto · Gegenkonto · Belegdatum · Buchungstext
 */

export interface DatevInvoiceItem {
  amount: number;
  description: string;
  taxRate: number;
  datevAccountNumber: string | null;
}

export interface DatevInvoice {
  invoiceNumber: string;
  invoiceDate: string; // ISO date YYYY-MM-DD
  memberName: string;
  items: DatevInvoiceItem[];
}

// DATEV Buchungsstapel header (Vorsatzzeile)
function buildVorsatzzeile(from: string, to: string): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14);
  const fromDatev = from.replace(/-/g, '').slice(0, 8);
  const toDatev = to.replace(/-/g, '').slice(0, 8);
  return (
    `"EXTF";700;21;"Buchungsstapel";3;${ts};;RE;;"";1;;` +
    `${fromDatev};${toDatev};0;0;0;4;${fromDatev};${toDatev};"SwingZ Export";;0;EUR;;`
  );
}

const COLUMN_HEADER =
  'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basisumsatz;' +
  'WKZ Basisumsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;' +
  'Belegfeld 1;Belegfeld 2;Skonto;Buchungstext';

function belegdatum(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}${month}`;
}

function formatAmount(n: number): string {
  return Math.abs(n).toFixed(2).replace('.', ',');
}

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildRow(invoice: DatevInvoice, item: DatevInvoiceItem): string {
  return [
    cell(formatAmount(item.amount)),
    'S', // Soll (Forderung)
    'EUR',
    '', // Kurs
    '', // Basisumsatz
    '', // WKZ Basisumsatz
    '10000', // Standard-Debitorenkonto
    cell(item.datevAccountNumber ?? ''),
    item.taxRate === 0 ? '94' : '', // BU-Schlüssel: 94 = steuerfrei
    cell(belegdatum(invoice.invoiceDate)),
    cell(invoice.invoiceNumber.slice(0, 36)),
    '', // Belegfeld 2
    '', // Skonto
    cell(`${invoice.memberName}: ${item.description}`.slice(0, 60)),
  ].join(';');
}

export function buildDatevCsv(invoices: DatevInvoice[], from: string, to: string): string {
  const lines: string[] = [buildVorsatzzeile(from, to), COLUMN_HEADER];
  for (const inv of invoices) {
    for (const item of inv.items) {
      if (item.amount !== 0) lines.push(buildRow(inv, item));
    }
  }
  return lines.join('\r\n'); // DATEV erwartet CRLF
}
