# API-Referenz — alle 306 Routes, gruppiert nach Domain

> ⚠️ **Dieser Inhalt wird automatisch generiert** durch `npm run docs:autogen` (Skript: [`scripts/docs-autogen.ts`](../../scripts/docs-autogen.ts)).
> Quelle: `app/api/**/route.ts`.
> Manuelle Edits NUR außerhalb der `<!-- AUTOGEN:-->`-Marker.

Stand 2026-07-01: **306 Route-Files** in `app/api/`.

<!-- AUTOGEN:BEGIN api-routes — wird bei jedem docs:autogen neu geschrieben -->

## Routes nach Domäne

### Bookings & Sessions — `/api/bookings`, `/api/sessions`, `/api/attendance`, `/api/waitlists`, `/api/rsvp`

Beispiele (vollständige Liste wird beim Auto-Gen erzeugt):

- `POST /api/bookings` — Buchung erstellen (RPC `create_booking_safe`)
- `PATCH /api/bookings/[bookingId]` — stornieren, mit `reason` + `notes?`
- `GET /api/bookings/member/[memberId]` — alle Buchungen eines Members
- `GET /api/bookings[trainer|trainer-schedule]` — Trainer-spezifisch
- `GET /api/sessions` — Sessions mit Trainer-Name
- `POST /api/sessions` — neue Session anlegen
- `POST /api/sessions/[sessionId]/cancel` — Session absagen
- `POST /api/sessions/[sessionId]/rsvp` — RSVP setzen
- `POST /api/attendance/qr-checkin` — QR-Check-In (Trainer)
- `GET /api/attendance/session/[sessionId]` — Anwesenheits-Liste
- `POST /api/waitlists/join` — Warteliste beitreten

### Members & Auth — `/api/members`, `/api/auth`, `/api/users`

- `GET /api/members` — Liste (filterbar: `clubId?`, `status?`, `search?`)
- `PATCH /api/members/[id]` — Toggle Active, Rollen
- `POST /api/members/invite` — neuen Member einladen
- `GET /api/members/[id]/bookings`
- `GET /api/members/[id]/invoices`
- `GET /api/members/[id]/sepa`
- `POST /api/auth/login` — Login (meist über Supabase-Clients direkt)
- `POST /api/auth/logout`
- `GET /api/auth/me` — Session-Info
- `GET /api/user/delete` — DSGVO-Lösch-Vorbereitung
- `POST /api/user/delete` — tatsächliches Löschen
- `GET /api/user/data-export` — DSGVO-Auskunft

### Clubs & Branding

- `GET /api/clubs` — Clubs-Liste (Owner/Superadmin only)
- `POST /api/clubs` — Verein anlegen (Owner/Superadmin)
- `GET /api/clubs/[id]` — Vereins-Details
- `PATCH /api/clubs/[id]` — bearbeiten ⚠️ **Cross-Tenant-Write vorhanden** (P0-Finding 1)
- `DELETE /api/clubs/[id]`
- `POST /api/clubs/access-requests` — Admin beantragt Club-Wechsel
- `POST /api/clubs/branding` — Logo/Farben

### Courts, Court-Types, Schedule

- `GET /api/courts` (Admin/Trainer)
- `POST /api/courts`
- `PATCH /api/courts/[id]`
- `POST /api/courts/[id]/book` (Court-Booking, nicht Session-Booking!)
- `GET /api/court-types`
- `POST /api/court-types`
- `GET /api/schedules`
- `POST /api/schedules`
- `GET /api/schedules/[id]/sessions`

### Billing & Stripe

- `GET /api/billing/invoices` — Rechnungs-Liste (Admin)
- `POST /api/billing/invoices/generate` — Monats-Rechnungslauf
- `POST /api/billing/invoices/[id]/send` — Manueller Versand
- `POST /api/billing/invoices/[id]/mark-paid`
- `GET /api/billing/season/[seasonId]`
- `GET /api/billing/dunning` — Mahnwesen-Liste
- `POST /api/billing/dunning/[id]/escalate` — Stufe erhöhen
- `POST /api/billing/dues/generate` — Monats-Beiträge
- `GET /api/billing/fees` — Fee-Configurations
- `POST /api/stripe/checkout` — Stripe-Checkout starten
- `POST /api/stripe/subscribe` — Plan wählen (Pricing-Tiers)
- `POST /api/stripe/portal` — Customer-Portal-Link
- `POST /api/webhooks/stripe` — Webhook-Receiver (Idempotenz!)
- `GET /api/stripe/subscription` — aktuelle Subscription
- `GET /api/stripe/invoices`
- `POST /api/stripe/quantity-sync` — Sync Subscription-Quantities

### Trainer

- `GET /api/trainers` — Trainer des Vereins
- `POST /api/trainers/invite`
- `PATCH /api/trainers/[id]`
- `GET /api/trainers/[id]/availability` — Wochenplan
- `PATCH /api/trainers/[id]/availability`
- `POST /api/trainers/[id]/absences` — Abwesenheit
- `GET /api/trainers/[id]/hours-logs`
- `POST /api/trainers/[id]/hours-logs`
- `PATCH /api/trainers/[id]/notes/member/[memberId]` — Trainer-Member-Notes

### Sessions-Planner / Saison

- `GET /api/seasons`
- `POST /api/seasons` — Saison-Anlage
- `POST /api/seasons/[id]/plan` — Wizard-Start
- `POST /api/seasons/[id]/plan/cluster` — KI-Clustering
- `POST /api/seasons/[id]/plan/backtrack` — Backtracking-Konfliktlösung
- `POST /api/seasons/[id]/billing` — Abrechnung generieren
- `POST /api/seasons/[id]/publish` — veröffentlichen

### Pricing (dynamic)

- `GET /api/pricing/rules` (Admin)
- `POST /api/pricing/rules`
- `PATCH /api/pricing/rules/[id]`
- `POST /api/pricing/calc` — Server-Side Preis-Berechnung für UI

### Tournaments & League

- `GET /api/tournaments`
- `POST /api/tournaments`
- `POST /api/tournaments/[id]/register`
- `GET /api/leagues`
- `POST /api/leagues`
- `GET|PATCH|DELETE /api/leagues/[id]`
- `POST /api/leagues/[id]/sync` — nuLiga-Abgleich. Erkennt am URL-Pfad, ob eine
  Mannschaftsseite (`/wa/teamPortrait`) oder eine Gruppenseite (`/wa/groupPage`)
  hinterlegt ist. Mannschaftsseite liefert eigene Spieltermine + Kader + (über den
  verlinkten Gruppenlink) die Tabelle; Gruppenseite liefert die Tabelle und
  filtert den Spielplan über `leagues.own_team_name`.
- `GET|POST /api/leagues/[id]/roster` — Meldeliste (Kader mit LK), Zuordnung zum
  Mitglied über DTB-ID, ersatzweise über den Namen
- `POST|DELETE /api/leagues/[id]/matchdays/[matchdayId]/courts` — Plätze für ein
  Heimspiel sperren bzw. freigeben (`court_closures.match_day_id`)
- `POST /api/leagues/[id]/matchdays/[matchdayId]/lineup` — Mannschaftsaufstellung
- `GET|PATCH /api/leagues/[id]/matchdays/[matchdayId]/result` — Match-Ergebnisse
- `GET /api/leagues/[id]/export/verband` — Medenspiel-CSV für den Verband

### Analytics & Dashboard

- `GET /api/dashboard/kpis?clubId=…` — KPIs (Admin)
- `GET /api/analytics/booking-trends`
- `GET /api/analytics/trainer-performance`
- `GET /api/analytics/revenue`
- `POST /api/analytics/export` — CSV-Export

### KI (Gemini)

- `POST /api/ai/matchmaking` — Spielpartner-Empfehlung
- `POST /api/ai/season-cluster` — Saison-Clustering
- `POST /api/ai/feedback-summary` — Trainer-Feedback zusammenfassen

### Notifications & Newsletter

- `POST /api/notifications/dispatch` — Cron-Worker (alle 5 min)
- `GET /api/newsletters/campaigns`
- `POST /api/newsletters/campaigns`
- `POST /api/newsletters/campaigns/[id]/send`
- `POST /api/messaging/[threadId]/send`
- `POST /api/messaging/broadcast`

### Decision-Voting (Mitglieder-Abstimmung)

- `GET /api/decisions/proposals`
- `POST /api/decisions/proposals`
- `POST /api/decisions/proposals/[id]/vote`
- `POST /api/decisions/proposals/[id]/close`

### News, Feedback, Engagement

- `GET /api/news`
- `POST /api/news`
- `GET /api/feedback` (DSGVO-Audit-Logger)
- `POST /api/feedback`

### Background-Jobs / Cron (intern)

- `POST /api/cron/backup` — täglicher JSON-Export ⚠️ kein Restore (P0-11)
- `POST /api/cron/notification-dispatch`
- `POST /api/cron/overdue-invoices`
- `POST /api/cron/season-reminders`
- `POST /api/cron/dunning-sync`
- `POST /api/cron/nuliga-sync`
- `POST /api/cron/cleanup-sessions`
- `POST /api/cron/reactivation-tracking`

⚠️ **Alle Cron-Routes**: `CRON_SECRET`-Header erwartet. Aktuell als optional markiert in `lib/env.ts:44` → **P0-Finding 4**.

### Shop

- `GET /api/shop/products`
- `POST /api/shop/orders`
- `GET /api/shop/orders/[id]`

### Work-Duty (Arbeitsdienst)

- `GET /api/work-duty/assignments`
- `POST /api/work-duty/assignments`
- `POST /api/work-duty/assignments/[id]/complete`

### Smart Court (Hardware-Integration, Add-On)

- `GET /api/hardware/vendor/status`
- `POST /api/hardware/vendor/unlock`
- `POST /api/hardware/nuki/callback`
- `POST /api/hardware/shelly/callback`
- `POST /api/hardware/loxone/callback`

### Push & Calendar

- `POST /api/push/subscribe` — Web-Push-Endpoint-Registrierung
- `GET /api/calendar/[token].ics` — ICS-Export (signed JWT)

### Public (kein Auth)

- `POST /api/public/trial-training` — Probetraining-Anmeldung
- `POST /api/public/contact` — Kontaktformular
- `GET /api/public/stats/[id]` — öffentliche Vereins-Stats (gecached)

### Owner

- `GET /api/owner/clubs` — alle Clubs
- `POST /api/owner/invite-admin` — Admin per E-Mail einladen (P0-3 berührt)
- `GET /api/owner/audit-logs` — Audit-Logs alle Vereine

### Webhooks (extern)

- `POST /api/webhooks/stripe` — Stripe (siehe stripe-integration.md)
- `POST /api/webhooks/zapier` — Zapier (P1: NODE_ENV !== 'production' bypass)

### Dev-Internal

- `POST /api/internal/db-audit` — Schema-Validation (CI)
- `POST /api/internal/perf-bench` — Performance-Benchmarks
- `POST /api/internal/feature-flags/[feature]/toggle` — Test-Toggle

<!-- AUTOGEN:END -->

## 📊 Übersicht nach Rolle

Welche Routes darf welche Rolle nutzen? (manuell kuratiert — bitte beim Hinzufügen ergänzen)

| Route-Gruppe           | owner | superadmin | admin |     trainer     |     member     |          public          |
| ---------------------- | :---: | :--------: | :---: | :-------------: | :------------: | :----------------------: |
| `/api/owner/*`         |  ✅   |     ❌     |  ❌   |       ❌        |       ❌       |            ❌            |
| `/api/admin/*`         |  ✅   |     ✅     |  ✅   |       ❌        |       ❌       |            ❌            |
| `/api/trainers/*`      |  ✅   |     ✅     |  ✅   |       ✅        |       ❌       |            ❌            |
| `/api/members/*`       |  ✅   |     ✅     |  ✅   | eigener Trainer | eigenes Profil |            ❌            |
| `/api/bookings` (POST) |  ✅   |     ✅     |  ✅   |       ✅        |       ✅       |            ❌            |
| `/api/sessions/*`      |  ✅   |     ✅     |  ✅   |       ✅        |   read-only    |            ❌            |
| `/api/public/*`        |  ✅   |     ✅     |  ✅   |       ✅        |       ✅       |            ✅            |
| `/api/cron/*`          |  ✅   |     ✅     |  ✅   |       ❌        |       ❌       | ❌ (nur mit CRON_SECRET) |
| `/api/ai/*`            |  ✅   |     ✅     |  ✅   |       ❌        |       ❌       |            ❌            |
| `/api/webhooks/*`      |  n/a  |    n/a     |  n/a  |       n/a       |      n/a       |      Stripe/Zapier       |

## 📚 Verwandte Kapitel

- [`api-conventions.md`](./api-conventions.md) — wie du eine neue Route schreibst
- [`auth-rbac.md`](./auth-rbac.md) — wie die Rollenprüfung passiert
- [`stripe-integration.md`](./stripe-integration.md) — Stripe-spezifische Routes
- [`background-jobs.md`](./background-jobs.md) — Cron-Routes
