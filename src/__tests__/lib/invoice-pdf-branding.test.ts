import { describe, it, expect } from 'vitest';
import { inflateSync } from 'node:zlib';
import { generateInvoicePDF } from '@/lib/pdf/invoice-pdf-utils';
import type { InvoiceWithItems } from '@/lib/types/billing';

const invoice = {
  invoice_number: 'RE-2026-0001',
  status: 'open',
  currency: 'EUR',
  amount: 50,
  tax_amount: 0,
  created_at: '2026-09-01T10:00:00Z',
  due_date: '2026-09-30',
  notes: null,
  items: [{ description: 'Mitgliedsbeitrag', quantity: 1, unit_price: 50, total_price: 50 }],
} as unknown as InvoiceWithItems;

/** Alle (ggf. Flate-komprimierten) Streams des PDFs als lesbarer Text. */
function pdfText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const out: string[] = [raw];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      out.push(inflateSync(Buffer.from(m[1]!, 'latin1')).toString('latin1'));
    } catch {
      // nicht komprimiert oder kein Text-Stream
    }
  }
  // pdf-lib schreibt Text als Hex-String (`<48656C6C6F> Tj`) — zurück in Klartext
  return out
    .join('\n')
    .replace(/<([0-9A-Fa-f]{2,})>/g, (_, hex: string) =>
      Buffer.from(hex, 'hex').toString('latin1')
    );
}

const text = async (over: Parameters<typeof generateInvoicePDF>[0]['branding'], name: string) =>
  pdfText(
    await generateInvoicePDF({
      invoice,
      clubName: name,
      clubAddress: 'Platzweg 1, 12345 Musterstadt',
      clubEmail: 'kasse@example.org',
      clubPhone: '',
      memberName: 'Erika Musterfrau',
      memberAddress: '',
      memberEmail: 'erika@example.org',
      branding: over,
    })
  );

describe('Rechnungs-PDF gehört dem Verein', () => {
  it('zeigt Vereinsdaten und keinen Plattformnamen', async () => {
    const pdf = await text(
      {
        iban: 'DE12 3456 7890 1234 5678 90',
        steuernummer: '222/5700/0352',
        footerText: 'Danke, TC Musterstadt!',
        introText: 'Für Ihre Mitgliedschaft berechnen wir:',
        accentColor: '#c0392b',
      },
      'TC Musterstadt e.V.'
    );
    expect(pdf).toContain('TC Musterstadt e.V.');
    expect(pdf).toContain('DE12 3456 7890 1234 5678 90');
    expect(pdf).toContain('222/5700/0352');
    expect(pdf).toContain('Danke, TC Musterstadt!');
    expect(pdf).toContain('Für Ihre Mitgliedschaft');
    expect(pdf.toLowerCase()).not.toContain('swingz');
  });

  it('bleibt ohne Branding schlicht und ohne Plattformnamen', async () => {
    const pdf = await text(undefined, 'SV Beispiel');
    expect(pdf).toContain('SV Beispiel');
    expect(pdf).not.toContain('Bankverbindung');
    expect(pdf.toLowerCase()).not.toContain('swingz');
  });
});
