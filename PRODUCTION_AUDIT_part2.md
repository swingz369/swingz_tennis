# SwingZ — Production Audit TEIL 2: Billing & Payments

---

## TEIL 2: BILLING & PAYMENTS (Score: 15/100)

### B1 — KRITISCH: Stripe Webhook ohne Idempotenz-Guard

**`app/api/webhooks/stripe/route.ts:76-89`**

`handleInvoicePayment()` ruft bei jedem Webhook-Event `billingEngine.createPayment()` auf ohne zu prüfen ob bereits eine Zahlung mit dieser `payment_intent`-ID existiert. Stripe sendet Webhooks mehrfach bei Retries → **Doppelzahlungen** in der DB.

**Fix:** `SELECT id FROM payments WHERE external_id = session.payment_intent` vor `createPayment()`.

---

### B2 — KRITISCH: Trainer-Billing ist In-Memory (Datenverlust bei Restart)

**`src/application/services/billing.service.ts:11-13`**

Statische Arrays: `private static trainers: TrainerBillingRecord[] = []`. Bei jedem Deploy/Restart gehen **alle Trainer-Abrechnungsdaten verloren**.

---

### B3 — HOCH: Invoice-Übersicht zeigt immer 0 Euro bezahlt

**`app/api/billing/invoices/overview/route.ts:92-93`** — `paid_amount: 0` hardcoded. Dashboard für finanzielle Entscheidungen unbrauchbar.

---

### B4 — HOCH: Offene-Posten ignorieren Teilzahlungen

**`app/api/billing/open-items/route.ts:65`** — `outstanding_amount = invoice.amount` immer, ohne Zahlungsabzug.

---

### B5 — HOCH: Invoice-Nummern Race-Condition

**`lib/billing/invoice.service.ts:27-36`** — Fallback: `INV-${Date.now() % 100000}`. Bei gleichzeitigen Requests entstehen identische Rechnungsnummern. Keine DB-Uniqueness-Constraint.

---

### B6 — HOCH: Rechnungstyp immer `'other'`

**`lib/billing/invoice.service.ts:55`** — Alle Rechnungen haben `type: 'other'`. Auswertungen nach Typ sind wertlos.

---

### B7 — HOCH: MemberBilling-Komponente persistiert nichts

**`components/member-billing.tsx:51`** — Rechnungen in `useState`, nach Seitenreload weg. Keine DB-Anbindung.

---

### B8 — HOCH: Trainer-Billing-Routes nutzen falschen Architecture-Layer

**`app/api/billing/trainers/[id]/pay/route.ts`** (und `.../overdue/route.ts`)

Die Routes existieren, importieren aber `BillingService` aus `@/src/application/services/billing.service` (Clean-Architecture-Layer mit In-Memory-Storage, siehe B2). Der gesamte Rest des Billing-Systems nutzt `billingEngine` aus `@/lib/billing-engine` (Supabase-backed). Dadurch greifen Trainer-Zahlungen nie auf persistente Daten zu.

---

### B9 — HOCH: Overdue-Status wird nie automatisch gesetzt

**`lib/billing/invoice.service.ts:206`** — Kein Cron-Job setzt `status` auf `'overdue'`. Mahnwesen verarbeitet immer 0 Rechnungen. (pg_cron-Schema vorhanden, aber kein konkreter Job definiert.)

---

### B10 — HOCH: SEPA-Mandatunterzeichnung ist Fassade

**`components/sepa-mandate-signing.tsx:154`** — `setTimeout(resolve, 1500)` simuliert API-Call. Backend ist fertig, wird aber nie aufgerufen. Kein Mandat wird je gespeichert.

---

### B11 — MITTEL: CSV-Payment-Import erstellt Orphan-Payments

**`app/api/billing/payments/import/route.ts:98-103`** — Zahlungen ohne `invoice_id`, nicht mit Rechnungen verknüpft. Import ist für Buchhaltung funktionslos.

---

### B12 — MITTEL: Dunning ohne E-Mail-Versand

**`lib/billing/dunning.service.ts:71-101`** — Erstellt DB-Einträge, sendet aber keine Benachrichtigungen an Schuldner.

---

### B13 — MITTEL: SEPA-Env-Variablen undokumentiert und unvalidiert

Nicht in `lib/env.ts` und fehlen in `.env.example`:
`SEPA_CREDITOR_NAME`, `SEPA_CREDITOR_IBAN`, `SEPA_CREDITOR_ID`, `SEPA_CREDITOR_BIC`, `SEPA_CREDITOR_STREET`, `SEPA_CREDITOR_CITY`, `SEPA_CREDITOR_POSTAL_CODE`, `SEPA_CREDITOR_COUNTRY`

---

### B14 — MITTEL: MonthlyBillingOverview zeigt Mock-Daten

**`components/monthly-billing-overview.tsx:74`** — Hartkodierte Namen ("Thomas Müller" etc.) und Beträge. Ruft keine echte API auf. Die monatliche Billing-Übersicht ist eine Demo-Ansicht ohne Datenbankanbindung.

---

### B15 — NIEDRIG: `checkRateLimitOrFail` möglicherweise nicht exportiert

**`lib/rate-limit.ts`** — Mehrere API-Routes importieren `{ checkRateLimitOrFail }` aus `@/lib/rate-limit`, aber die Funktion ist am Ende der Datei nicht explizit definiert/exportiert (die Datei endet bei `createRateLimitedHandler`). Kann zu einem Build-Fehler führen — vor Deployment verifizieren.

---

### Billing-Positives

- SEPA-XML-Generierung (Backend) korrekt implementiert ✓
- Stripe-Signaturverifizierung korrekt ✓
- SEPA-Route: superadmin-Guard + Club-Validierung ✓
