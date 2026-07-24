# Tutorial · Abrechnung & Gebühren (Admin)

> Page: [`app/(protected)/admin/(gated)/billing/page.tsx`](<../../../../app/(protected)/admin/(gated)/billing/page.tsx>) · Wrapper: `BillingCategoriesTabs` · Client: `BillingClient`

## Übersicht

Drei zusammenhängende Bereiche:

- **Rechnungen** (`invoices`) — pro Mitglied + pro Saison
- **Gebühren-Kategorien** (`fee_configurations`) — konfigurierbare Beitragsstruktur
- **Mitgliedsgebühren-Warnung** — erscheint wenn keine aktive „membership"-Konfiguration existiert

## A) Page lädt 3 parallele Server-Queries

1. **fee_configurations** für diesen Club (sortiert nach Name) — `categories`-Tab.
2. **clubMemberships** (user_club_memberships JOIN users) für `role IN ('member','trainer')` + `is_active = true` — Member-Picker für Invoice-Erstellung.
3. **invoices** paginiert (Default 25) + count — Invoices-Tab.

Plus: `hasActiveMembershipFee` Check (`type === 'membership' && is_active`).

## B) Gelbe Warnung (oben auf der Page)

Erscheint **nur** wenn **keine** aktive Mitgliedschaftsgebühr existiert:

- Warning-Icon + Heading „Keine aktive Mitgliedsgebühr konfiguriert".
- Beschreibungstext: „Rechnungen können erst mit einem Betrag größer 0 erstellt werden, wenn eine aktive Gebühr vom Typ Mitgliedschaft existiert."
- Link „Jetzt Mitgliedsgebühr anlegen →" → `?tab=categories`.

> **Wichtig:** Das ist die häufigste Fehlerquelle bei „Rechnung erstellen"-Bugs. Vor allen anderen Schritten prüfen.

## C) Rechnungen-Tab (Default)

### Liste

Server-Pagination. Pro Eintrag sichtbar:

- `invoiceNumber` (z. B. „2026-00042")
- Member-Name (über JOIN `users.full_name`)
- `subtotal`, `amount`, `paidAmount`
- Status (draft / sent / paid / overdue / cancelled)
- `invoiceDate` + `dueDate`
- `paidAt` falls vorhanden

### Mögliche Aktionen

Die genauen Buttons hängen vom `BillingClient` ab, typisch:

- **Rechnung erstellen** (Dropdown Member + Betrag + Fälligkeit) → POST
- **Mahnen** (für overdue) → erzeugt Dunning-Record + E-Mail
- **Als bezahlt markieren** (für offene)
- **Stornieren** (für noch nicht bezahlte)
- **PDF herunterladen** (Link)

### Refresh

Aktuelle Invoices-Liste wird per `router.refresh()` aktualisiert (Server Component re-render).

## D) Kategorien-Tab (`?tab=categories`)

### Liste

Pro `fee_configurations`-Row:

- Name (z. B. „Mitgliedsbeitrag 2026", „Sommercamp Aufschlag")
- Type (`membership`, `training`, `tournament`, `other`)
- Betrag (`amount`)
- `billing_cycle` (monthly / quarterly / yearly / one_time)
- `is_active`-Toggle

### Aktionen

- **Neue Kategorie** (Plus-Button, modal): name, type, amount, billing_cycle, is_active
- **Edit** (Stift-Icon): inline edit
- **Delete** (Mülleimer): nur wenn keine offenen Rechnungen mit dieser Kategorie verknüpft sind

> **Empfehlung:** mindestens eine aktive `type='membership'` Config pro Verein, sonst blockiert die Page-Warnung die Rechnungserstellung.

## E) Rechnung → bezahlen / mahnen / stornieren

### Status-Lebenszyklus

```
draft  →  sent  →  paid         (Glücklicher Pfad)
                  ↘  overdue  →  paid
                  ↘  cancelled
```

### Dunning-Prozess („Mahnung")

Server-Route setzt `invoices.status = 'overdue'` (falls noch nicht) und erzeugt eine `dunningRecords`-Row pro Mahnstufe. Mahnstufen-Fristen aus Vereinseinstellungen.

### SEPA-Lastschrift

Falls das Mitglied ein aktives `sepa_mandates`-Row hat:

- Schedule „Lastschrift am Fälligkeitstag" wird angelegt (siehe `Background-Jobs` in `dev/background-jobs.md`).
- Bei Erfolg: `invoices.status = 'paid'`, `paid_at = now`, Stripe Webhook informiert.

## F) Stripe-Integration (für externe Zahlungen)

Klick auf „Stripe-Checkout" auf einer Rechnung (falls implementiert) → erzeugt Stripe Checkout Session via `stripe-client.ts`, redirect zu Stripe.

Webhook → `/api/stripe/webhook` aktualisiert die Invoice falls `payment_intent.succeeded`.

## Edge-Cases

| Problem                            | Lösung                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Keine Rechnungen erstellen möglich | Erst Kategorie anlegen → gelbe Warnung verschwindet                                                        |
| Member taucht nicht im Picker auf  | `user_club_memberships.is_active = false` oder `role !== 'member'/'trainer'`                               |
| Doppelte Rechnung                  | Backend Unique-Constraint auf `(club_id, member_id, period_start, invoice_type)` — beim 409-Fehler prüfen. |
| Letzte Mahnung                     | `dunningRecords`-Tabelle bis Stufe 4 — danach „Inkasso"-Workflow (extern).                                 |
| Falscher Betrag                    | Rechnung Stornieren + neu erstellen mit Korrektur (kein Edit auf gesendete Rechnung — GoBD).               |
| Currency ≠ EUR                     | Aktuelles Setup: nur `EUR` unterstützt (siehe `lib/stripe/client.ts` defaults).                            |
| Stripe Webhook kommt nicht an      | `STRIPE_WEBHOOK_SECRET` prüfen, in Vercel-Logs auf Delivery-Failures prüfen.                               |
