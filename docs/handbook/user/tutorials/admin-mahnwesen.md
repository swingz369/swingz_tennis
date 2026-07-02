# Admin · Mahnwesen (Dunning-Stufen 0/1/2/3)

> **Walkthrough für Admin + Support-Team + Finance-FAQ.** Code-grounded: reale Schwellen, Gebühren, Cron-Routen, SQL-Trigger, §288-BGB-Verzugszins-Formel, Resend-E-Mail-Template.
>
> **Source-Module (lesen für Code-Detail):**
>
> - [`lib/billing/dunning.service.ts`](../../../lib/billing/dunning.service.ts) — Haupt-Service `DunningService` (Fee-Staffel, Verzugszins-Aufruf, E-Mail-Dispatch)
> - [`lib/billing/verzugszins.ts`](../../../lib/billing/verzugszins.ts) — `calculateVerzugszins()` + `calculateVerzugszinsForInvoice()` (ACT/360, BGH-Inklusiv)
> - [`app/api/cron/overdue-invoices/route.ts`](../../../app/api/cron/overdue-invoices/route.ts) — Vercel-Cron-Route (täglich 08:00)
> - [`app/api/cron/dunning-sync/route.ts`](../../../app/api/cron/dunning-sync/route.ts) — Vercel-Cron-Route (täglich 09:00)
> - [`app/api/billing/dunning/route.ts`](../../../app/api/billing/dunning/route.ts) — Frontend-Liste
> - Migrationen: `20260502_billing_system.sql` (Basis-Schema), `20260607_*_dunning_*` (Spalten + RLS), `20260608_*_billing_*` (Backfill + Trigger), `20260624_mahnwesen_verzugszins_decisions.sql` (Verzugszins-Spalten)

## 📊 Was passiert bei nicht-fristgerechter Zahlung?

| Stufe | Wann (Tage nach Fälligkeit) | Was passiert automatisch                                                                                      | Mahngebühr B2C | Mahngebühr B2B (§288 Abs. 5 BGB) |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------- |
| 0     | < 14 Tage                   | Rechnung gilt als `overdue`, keine Mahnung                                                                    | —              | —                                |
| 1     | ≥ 14 Tage                   | `dunning_record` mit `level=1` + **"1. Mahnung"**-E-Mail + Mailgun/Resend                                     | **5,00 €**     | **40,00 €**                      |
| 2     | ≥ 28 Tage                   | `dunning_record` mit `level=2` + **"2. Mahnung"**-E-Mail inkl. §288-BGB-Verzugszins-Aufstellung               | **10,00 €**    | **40,00 €**                      |
| 3     | ≥ 42 Tage                   | `dunning_record` mit `level=3` + **"3. Mahnung (Letzte)"**-E-Mail + `user_club_memberships.is_active = false` | **20,00 €**    | **40,00 €**                      |

**Plus durchgehend** (ab erster Mahnstufe): Verzugszins-Berechnung pro laufender Basiszinssatz-Periode nach §288 BGB.

## 🔧 Wann und wie wird der Mahnlauf ausgelöst?

Drei Trigger-Pfade:

1. **Vercel-Cron (produktiv)** — `vercel.json` Schedule:
   - `POST /api/cron/overdue-invoices` — **täglich 08:00** — setzt `invoices.status='overdue'` und triggert Mahnlauf via `dunningService.processAutomaticDunning(clubId)`.
   - `POST /api/cron/dunning-sync` — **täglich 09:00** — synct nur `dunning_records` ↔ `invoices.status`.
2. **Deno-Edge-Function** — `supabase/functions/process-automatic-dunning/index.ts` — kann pro `club_id` manuell aufgerufen werden.
3. **Manuell / API** — `POST /api/billing/dunning/[id]/escalate` — Admin oder Support stuft ein einzelnes `dunning_record` manuell hoch.

Auth: Alle Cron-Routes prüfen `CRON_SECRET` Header.

## 💰 Stufen-Berechnung — die Schwellen (autoritative Quelle)

### SQL-Trigger `calculate_dunning_level(p_invoice_id)` in `supabase/migrations/20260608_deploy_billing_triggers.sql`

```sql
CREATE OR REPLACE FUNCTION calculate_dunning_level(p_invoice_id uuid)
RETURNS integer AS $$
DECLARE
  v_due_date date;
  v_days_overdue integer;
BEGIN
  SELECT due_date INTO v_due_date FROM invoices WHERE id = p_invoice_id;
  IF v_due_date IS NULL THEN RETURN 0; END IF;
  v_days_overdue := CURRENT_DATE - v_due_date;
  IF v_days_overdue >= 42 THEN RETURN 3;
  ELSIF v_days_overdue >= 28 THEN RETURN 2;
  ELSIF v_days_overdue >= 14 THEN RETURN 1;
  ELSE RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

> ⚠️ **Konsistenz-Hinweis**: Der Themen-Interplay-Mermaid-Diagramm in `docs/handbook/dev/themen-interplay.md` §5 zeigt historisch **15/30/45 Tage**. Diese Zahlen sind überholt — die **autoritative Quelle ist dieser SQL-Trigger mit 14/28/42 Tagen**. Neue Tickets bitte gegen 14/28/42 zitieren.

### TypeScript-Schicht — Mahngebühren-Staffel

Methode `DunningService.calculateDunningFee(level, isB2B)` in `lib/billing/dunning.service.ts`:

```ts
private calculateDunningFee(level: number, isB2B = false): number {
  if (isB2B) return 40.0; // §288 Abs. 5 BGB Pauschale für Unternehmen
  switch (level) {
    case 1: return 5.0;
    case 2: return 10.0;
    case 3: return 20.0;
    default: return 0;
  }
}
```

**Im Code-TODO markiert**: `// TODO: perspektivisch pro Verein in system_settings konfigurierbar.` — aktuell hartcodiert; pro-Verein-Override ist geplant aber nicht implementiert.

### Idempotenz — kein Doppel-Mahnen am selben Tag

Methode `DunningService.processAutomaticDunning(clubId)`:

```ts
const lastDunningDate = existingDunning?.[0]?.sent_at
  ? new Date(existingDunning[0].sent_at).toDateString()
  : null;
if (lastDunningDate === new Date().toDateString()) continue; // skip if already sent today
```

Pro Tag + Stufe + Rechnung: maximal **ein** `dunning_record`. Cron-Läufe sind damit sicher mehrfach.

## 💸 Verzugszins-Berechnung (§288 BGB)

Datei: `lib/billing/verzugszins.ts`

### Rechtsgrundlagen

- **§288 Abs. 1 BGB**: Verbraucher (B2C) → Basiszinssatz + **5 Prozentpunkte**
- **§288 Abs. 2 BGB**: Unternehmen (B2B) → Basiszinssatz + **9 Prozentpunkte**
- **§247 BGB**: Basiszinssatz wird halbjährlich (1.1. + 1.7.) angepasst — Snapshot-Tabelle `base_interest_rates`
- **§286 Abs. 3 BGB**: Verzug beginnt 30 Tage nach Fälligkeit + Zugang (oder ab erster Mahnung wenn `firstDunningAt` gesetzt)

### Day-Count-Formel (ACT/360, BGH-Inklusiv)

Inklusiv-Formel aus `verzugszins.ts` Zeile 234 ff:

```
days = floor((ms + ONE_DAY_MS) / ONE_DAY_MS)
```

Zählt sowohl Anfangs- als auch Endkalendertag als vollen Verzugstag. Teil-Tage werden aufgerundet.

Im Code-Header explizit zitiert: **BGH NJW 2014, 1234; BGH WM 2007, 484; BGH WM 2009, 1493** — mit Disclaimer: ⚠️ "**nicht legal verifiziert**". Vor produktivem Einsatz in Mahn-Workflows unbedingt durch die Rechtsabteilung gegenprüfen lassen.

### Stichtag-Doppelzählung (BGH-Konformität)

Beim H1→H2-Stichtag (1. Juli) würde der gleiche Kalendertag sonst von beiden Perioden gezählt. Der Service trackt daher `prevBoundaryEnd` (Ende der zuletzt verarbeiteten Periode) und verschiebt `effectiveStart` der nächsten Periode auf `prevBoundaryEnd + 1 Tag`. H1 "besitzt" den 1. Juli.

Test-Coverage: 22 BGH-Edge-Cases in `tests/unit/lib/billing/verzugszins.test.ts` (32 Cases insgesamt) — Sekunden-Toleranz, DST spring-forward/fall-back, Jahr-Schicht-Berechnung, NaN-Schutz.

### Beispiel-Berechnung (B2C, 30 Tage Verzug)

Bei Original-Rechnung **100,00 €**, B2C, Basiszinssatz **2,27 %**, 30 Tage Verzug:

- Rate gesamt: 2,27 % + 5 PP = **7,27 %**
- Verzugszins: 100 × 7,27 % × (30/360) ≈ **0,606 €**
- Real-Wert im Test (AKZ-1.1 B2C 30T): **~0,63 €** (gerundet auf 2 Nachkommastellen pro Periode)

Siehe `tests/unit/lib/billing/verzugszins.test.ts` für nachvollziehbare Cases AKZ-1.1 bis AKZ-1.5.

## 📧 E-Mail-Dispatch (Resend)

Methode `DunningService.sendDunningEmail(...)` in `lib/billing/dunning.service.ts`:

- **Absender**: `noreply@swingz.cloud` (konfigurierbar: `process.env.EMAIL_FROM`)
- **Subject**: `{levelLabel}: Rechnung {invoiceNumber} ist überfällig`
- **Body-HTML-Template**:
  - `<h2>` mit **Mahnstufe-Label** ("1. Mahnung" / "2. Mahnung" / "3. Mahnung (Letzte)")
  - Anrede "Sehr geehrtes Mitglied"
  - Rechnungsnummer + Betrag
  - **Neue Zahlungsfrist**: 14 Tage ab Issuance (Cron setzt `dueDate.setDate(dueDate.getDate() + 14)` im Service)
  - Mahngebühr-Box (`fee_amount.toFixed(2)` €, nur falls > 0)
  - Verzugszins-Box mit Rechtsgrundlage-Label (z.B. `§288 Abs. 1 BGB (B2C)`) und Betrag
  - **Gesamtforderung** (`total_due`) — fett, groß
  - Signatur: "Mit freundlichen Grüßen, SWINGZ"

### Graceful degradation

- **Kein `RESEND_API_KEY`**: Service logged `'No RESEND_API_KEY — skipping email'` und skippt Senden. `dunning_records` wird trotzdem erzeugt (kein Hard-Fail).
- **Email-Versand-Fehler**: `log.error('Failed to send dunning email', ...)` und weiter im Loop — blockiert nicht die Erstellung weiterer `dunning_records`.

## 🔒 RLS-Policies

Aus Migrationen `20260607_add_dunning_rls_policies.sql` + `20260607_dunning_rls_null_member.sql`:

- **`members_can_view_own_dunning`** (SELECT): Member sieht `dunning_records` seiner eigenen `user_club_memberships`.
- **`admins_can_manage_dunning`** (ALL): Admin-User mit `club_id`-Scope verwaltet alle Records des Clubs.
- **`members_can_view_own_dunning_via_invoice`** (SELECT, Fallback): Historische Records mit `member_id IS NULL` — JOIN über `invoices.member_id`.

Trigger `set_dunning_member_id` aus `20260608_backfill_dunning_member_id.sql` sorgt dafür, dass **neue** `dunning_records` automatisch `member_id` aus der verlinkten Invoice übernehmen. Damit wird die Fallback-Policy perspektivisch obsolet.

## 🔌 API-Übersicht

| Route                                | Methode  | Effekt                                            | Auth               |
| ------------------------------------ | -------- | ------------------------------------------------- | ------------------ |
| `/api/billing/dunning`               | GET      | `dunning_records`-Liste für aktiven Club          | Admin (Role-Guard) |
| `/api/billing/dunning/[id]/escalate` | POST     | Eine Stufe manuell erhöhen                        | Admin              |
| `/api/cron/overdue-invoices`         | POST     | `invoices.status = 'overdue'` + Mahnlauf triggern | `CRON_SECRET`      |
| `/api/cron/dunning-sync`             | POST     | Records ↔ Invoice-Status syncen                   | `CRON_SECRET`      |
| `/api/cron/billing-overdue`          | POST     | Test-/Fallback-Cron-Route                         | `CRON_SECRET`      |
| `/admin/billing/dunning`             | UI-Seite | Admin-Liste im Frontend                           | Admin              |

## ⚠️ P0-8 Lücke: `invoice.payment_failed`

Wenn Member per **SEPA-Lastschrift** zahlt und die Bank weist die Lastschrift zurück, sendet Stripe `invoice.payment_failed`. **Dieser Stripe-Webhook wird aktuell nicht behandelt** (siehe `docs/handbook/dev/stripe-integration.md`, Zeile 60).

**Konsequenzen:**

- `invoices.status` bleibt auf `pending`/`overdue` (Webhook-Receiver aktualisiert nicht)
- Dunning-Cron sieht Rechnung weiterhin als offen → mahnt weiter
- Club-Notification + Member-Notify werden nicht automatisch ausgelöst
- Support muss manuell eskalieren

**Workaround (heute):** Manuell in `invoices` setzen + ggf. `account_frozen = true` triggern, Member direkt benachrichtigen.

**TODO-Pattern (im Code-Kommentar):** dunning-record escalate + club-flag + member-Notify. Siehe `docs/tickets/STATUS.md` Folge-Tickets.

## 🧪 Tests

- **Unit-Tests** `tests/unit/lib/billing/verzugszins.test.ts` — 32 Cases grün (AKZ-1.1 B2C 30T math, AKZ-1.2 B2B, AKZ-1.3 H1→H2-Stichtag-Segmentierung, AKZ-1.4 firstDunningAt-Konfigurierbarkeit, AKZ-1.5 Mahnstufen-Gebühren).
- **E2E-Tests** `tests/e2e/admin-dunning.spec.ts` — 6 Tests × 6 Browser-Targets = 36 Cases; `test.skip` defensiv für fehlende Live-Supabase.
- **Integration** `src/__tests__/integration/payment-flow.test.ts` — dunning-Deletion im payment-Override-Flow getestet.

## 🛠 Manuelle Utils

`lib/billing/verzugszins.ts` exportiert `calculateVerzugszinsForInvoice()` für direkten Aufruf (z.B. Support-Reports, Audit):

```ts
import { calculateVerzugszinsForInvoice } from '@/lib/billing/verzugszins';

const result = calculateVerzugszinsForInvoice({
  invoiceAmountEur: 100.0,
  dueDate: new Date('2026-05-01'),
  isB2B: false,
  baseRates: [{ validFrom: '2026-01-01', rate: 0.0227 }],
  firstDunningAt: new Date('2026-06-01'), // Datum der ersten Mahnstufe
  computationDate: new Date('2026-07-15'),
});
// result.totalInterest  ~0,63 €
// result.totalDays      75 (inklusiv)
// result.lineItems      [{ periodStart, periodEnd, days, appliedRate, interest, baseRate }]
```

## 📋 Edge-Cases — Schnell-Referenz für Finance-Support

| Szenario                                            | Symptom                                                             | Lösung                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Rechnung wird bezahlt während Mahnlauf läuft        | `dunning_record` bleibt offen; Member bekommt Mahnung trotz Zahlung | Stripe-Webhook `invoice.paid` schließt `dunning_record` automatisch (siehe `ticketing.md`) |
| Falsche Member-Adresse / unverfügbarer Empfänger    | Resend SMTP-Bounce                                                  | Dunning-Service loggt Warnung; manuelles Cleanup nötig                                     |
| SEPA-Lastschrift zurückgewiesen                     | Stripe feuert `invoice.payment_failed`                              | **P0-8 Lücke** — Support muss manuell eskalieren/sperren                                   |
| Member hat mehrere Clubs                            | `dunning_records` pro Club separat; Mahn-Mail kommt pro Club        | OK — kein Bug                                                                              |
| Inkasso-Pfad (Stufe 4)                              | Aktuell **nicht implementiert**                                     | Nach Stufe 3 extern (Verein / Anwalt); Workflow in `lib/billing/` ausstehend               |
| `base_interest_rates` Tabelle fehlt (Pre-Migration) | `loadBaseRates()` returnt `[]`; Interest-Skip                       | Service degradiert graceful — Mahnung geht ohne Verzugszins-Box raus                       |
| `RESEND_API_KEY` nicht gesetzt                      | Email wird nicht gesendet; `dunning_record` wird trotzdem erstellt  | Logging-Alert; manuelle Nachsendung erforderlich                                           |
| DST-Spring-Forward/Backward im Verzug-Zeitraum      | 22 BGH-Edge-Cases in Unit-Tests                                     | Service tolerant; ACT/360 in UTC, lokale DST-Normalisierung im Invoice-Date                |

## 🔗 Verwandte Kapitel

- [`admin-billing.md`](./admin-billing.md) — Rechnungserstellung-Schritt (Membership-Fee-Gate)
- [`glossary.md`](../../glossary.md) §Mahnwesen — Kurzübersicht der Stufen
- [`themen-interplay.md` §5](../../dev/themen-interplay.md) — visuelles Sequenzdiagramm (Hinweis: 15/30/45-Tage-Werte sind überholt)
- [`stripe-integration.md`](../../dev/stripe-integration.md) — `invoice.paid` Webhook-Handler (P0-8 nicht behandelt)
- [`background-jobs.md`](../../dev/background-jobs.md) — Cron-Worker-Pattern
