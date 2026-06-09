---
name: swingz-pdf-invoice
description: SwingZ-specific knowledge for PDF invoice generation — pdf-lib patterns, German compliance (GoBD), serverless-friendly caching, and bulk generation.
---

# SwingZ PDF Invoice

## Where it lives

- **Main renderer:** `lib/pdf/invoice-pdf.tsx` (React-PDF / @react-pdf/renderer)
- **Utilities:** `lib/pdf/invoice-pdf-utils.tsx` (number formatters, layout helpers)
- **API:** `app/api/invoices/[id]/pdf/route.ts` (GET endpoint)
- **Storage:** `invoices` table (`pdf_url` column points to Supabase Storage)
- **Email:** lib/billing/invoice-email.ts (sends PDF as attachment) — _Note: this file may not exist yet; emails are typically sent via lib/email Resend helpers directly from the billing service_
- **Schema:** `invoices` table in `src/infrastructure/persistence/schema.ts`

## Why @react-pdf/renderer (NOT puppeteer/playwright)

- **Serverless-compatible:** No headless Chrome, no 100MB+ dependency
- **Fast:** Renders in 50-200ms vs 2-5s for headless Chrome
- **Cold-start friendly:** Works on Vercel Edge + Node runtimes
- **TypeScript-native:** React components describe the PDF layout
- **Trade-off:** Less flexible than HTML→PDF, but we don't need HTML for invoices

**Never** suggest migrating to Puppeteer/Playwright for PDFs — it's a 10x perf regression.

## The invoice PDF structure

```typescript
// lib/pdf/invoice-pdf.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export const InvoicePDF = ({ invoice, club, member }: InvoicePDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header: Club logo + invoice number + date */}
      <InvoiceHeader club={club} invoice={invoice} />
      {/* Recipient: Member address */}
      <RecipientBlock member={member} />
      {/* Line items: Description, qty, unit price, total */}
      <LineItemsTable items={invoice.lineItems} />
      {/* Totals: Subtotal, tax (MwSt), grand total */}
      <TotalsBlock invoice={invoice} taxRate={club.tax_rate} />
      {/* Footer: Bank details, payment terms, tax ID */}
      <PaymentFooter club={club} invoice={invoice} />
    </Page>
  </Document>
);
```

## German compliance (GoBD)

Invoices in Germany must comply with **GoBD** (Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern):

1. **Mandatory fields** (all must be present, no exceptions):
   - Full club name + address
   - Tax ID (`USt-IdNr.`) OR business tax number (`Steuernummer`)
   - Invoice number (sequential, no gaps)
   - Invoice date (issue date, not service date)
   - Service date / period (Leistungszeitraum)
   - Net amount + tax amount (separately) + gross total
   - Description of service
   - Member's full name + address

2. **Sequential numbering** — use the `invoice_number_prefix` from `clubs.invoice_number_prefix` + a sequential counter (see `lib/billing/season-billing.service.ts`)

3. **Immutability** — once issued, an invoice's PDF should never change. If a correction is needed, issue a **Stornorechnung** (cancellation invoice) + new invoice.

4. **10-year retention** — don't delete old invoice PDFs from Supabase Storage.

## Number formatting (German locale)

```typescript
// lib/pdf/invoice-pdf-utils.tsx
export const formatEUR = (cents: number): string => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
};

export const formatDate = (date: Date): string => {
  // German format: TT.MM.JJJJ
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};
```

**Always** use these helpers. Never inline `toFixed(2)` — it produces English formatting (`123.45` instead of `123,45`).

## Serverless caching strategy

PDF generation is CPU-bound (~100ms per invoice). On Vercel:

- Render to Buffer in the API route
- Upload to Supabase Storage
- Return the Storage URL to the client (not the Buffer)
- **Cache key:** `invoices/{invoiceId}/invoice.pdf` (immutable, 10-year retention)
- **Cache-Control:** `public, max-age=31536000, immutable`

```typescript
// In the API route
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id);
  if (!invoice) return new Response('Not found', { status: 404 });

  // Check if PDF already exists in storage
  const existing = await supabase.storage.from('invoices').download(`${invoice.id}/invoice.pdf`);
  if (existing.data) {
    return new Response(existing.data, { headers: { 'Content-Type': 'application/pdf' } });
  }

  // Generate fresh
  const buffer = await renderToBuffer(<InvoicePDF invoice={invoice} ... />);
  await supabase.storage.from('invoices').upload(`${invoice.id}/invoice.pdf`, buffer);
  return new Response(buffer, { headers: { 'Content-Type': 'application/pdf' } });
}
```

**Never** regenerate on every request — it's wasteful and breaks immutability.

## Bulk generation (monthly billing run)

The `lib/billing/season-billing.service.ts` cron generates invoices for all members on the 1st of each month:

```typescript
async generateMonthlyInvoices(clubId: string, month: Date): Promise<Invoice[]> {
  const members = await this.getActiveMembers(clubId);
  const invoices = await Promise.all(
    members.map(m => this.createInvoice(m, month))
  );
  // Bulk-generate PDFs in parallel (max 10 concurrent to avoid OOM)
  await pMap(invoices, inv => this.renderAndStore(inv), { concurrency: 10 });
  return invoices;
}
```

**Concurrency limit:** 10 — Vercel serverless functions have ~3GB memory, each PDF render is ~50MB peak. 10 concurrent ≈ 500MB peak.

## Common tasks

### Add a new line item type

1. Add to `InvoiceLineItem.kind` enum (`membership` | `training_session` | `equipment_rental` | `tournament_fee`)
2. Add a renderer in `invoice-pdf.tsx` (different icon/description per kind)
3. Update the price calculation in `season-billing.service.ts`
4. Add test case in `lib/pdf/__tests__/invoice-pdf.test.tsx`

### Add a new field to the invoice

1. Add column to `invoices` table (or use a `metadata` jsonb field)
2. Update the `Invoice` type in `lib/types/billing.ts`
3. Add to the PDF layout in `invoice-pdf.tsx`
4. If GoBD-mandatory, update `docs/COMPLIANCE.md` and notify legal
5. **Backfill:** existing invoices won't have the field — show as empty/N/A

### Debug "PDF is blank"

1. Check React-PDF version compatibility (some fonts break between versions)
2. Check if the `invoice.lineItems` array is empty (renders blank middle section)
3. Check if `club.tax_rate` is null (crashes the TotalsBlock)
4. Check Vercel function logs for "Out of memory" (increase concurrency limit)

## Gotchas

- **Fonts must be registered** — German invoices need a font with `€`, `ü`, `ö`, `ä`, `ß` glyphs. We use `Inter` + `Roboto`. Don't switch to a font without these characters.
- **The PDF is React, but it's NOT hydrated** — don't use hooks like `useState` or `useEffect`. Pure components only.
- **No CSS-in-JS** — use the `StyleSheet.create()` API from @react-pdf/renderer, not Tailwind/styled-components.
- **Images must be base64 or URLs** — don't try to import local files, use `import logo from './logo.png'` to get a base64 string.
- **Long line item descriptions wrap** — set `flexWrap: 'wrap'` on the Text style, or truncate with `...`.
- **Page breaks are automatic** but can be controlled with `break` prop on `<View>`. Use sparingly.
- **Vercel's 4.5MB response limit** — most invoices are <50KB, but a 1000-line-item invoice could exceed. Use Supabase Storage URL instead of returning the Buffer directly.
