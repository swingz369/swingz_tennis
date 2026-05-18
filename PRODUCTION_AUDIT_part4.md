# SwingZ — Production Audit TEIL 4: UI, Deployment & Prioritäten

---

## TEIL 4: UI & DEPLOYMENT (Score: 50/100)

### D1 — KRITISCH: Sentry in `devDependencies`

`package.json` — `@sentry/nextjs` fehlt in Production-Build. Kein Fehlermonitoring.
**Fix:** `npm install @sentry/nextjs --save`

### D2 — HOCH: Node-Version-Mismatch

`package.json engines: ">=24.0.0"` vs. `docker/frontend.Dockerfile: node:20-alpine`

### D3 — HOCH: CI-YAML-Einrückungsfehler

`.github/workflows/ci.yml` — `steps:` falsch unter `env:` eingerückt im E2E-Job.

### D4 — HOCH: E-Mail-Route API-Mismatch

`app/api/emails/onboarding/route.ts` liest `{ email, firstName }`.
`components/admin-approval-workflow.tsx` sendet `{ recipientEmail, recipientName }`.
→ Approval/Rejection-E-Mails werden **nie versendet**.

### D5 — HOCH: Onboarding-Route ohne Auth-Guard

`app/api/emails/onboarding/route.ts` — Kein Auth. Spam/Abuse-Risiko.

### D6 — MITTEL: Hartkodierte Demo-Daten in 6 Dateien

| Datei | Wert |
|-------|------|
| `admin-approval-workflow.tsx` (3x) | `'Admin User'`, `'Tennisstraße 123'`, `'+49 123 456 7890'` |
| `trial-training-registration.tsx` | Gleiche Demo-Adresse |
| `api/trial-trainings/[id]/convert/route.ts` | Gleiche Demo-Adresse |
| `api/trial-trainings/[id]/reminder/route.ts` | Gleiche Demo-Adresse |

### D7 — MITTEL: In-Memory Rate-Limiting wirkungslos bei Skalierung

`lib/rate-limit.ts:105` — Ohne Redis hat jede serverlose Instanz eigenen Speicher.

### D8 — MITTEL: Fehlende Env-Vars in `.env.example`

`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `NEXT_PUBLIC_GA_ID` (Namenskonflikt mit `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`), alle 8 `SEPA_CREDITOR_*`-Variablen, `NEXT_PUBLIC_EXPERIMENTS`, Feature-Flag-Vars.

### D9 — INFO: `vercel.json` fehlt (nur `.backup`)

---

## VOLLSTÄNDIGE PRIORITÄTSLISTE

### P0 — Sicherheitskritisch (vor Go-Live zwingend)

| # | Problem | Datei:Zeile |
|---|---------|-------------|
| P0-1 | Test-Mode-Cookie bypasses alle Auth-Guards | `middleware.ts:77-81` |
| P0-2 | Race Condition bei Buchungserstellung | `app/api/bookings/route.ts:43` |
| P0-3 | Stripe Webhook nicht idempotent | `app/api/webhooks/stripe/route.ts:76` |
| P0-4 | Role-Bleeding bei Multi-Club-Memberships | `lib/api-auth.ts:89` |

### P1 — Funktional Broken

| # | Problem | Datei:Zeile |
|---|---------|-------------|
| P1-1 | Court-Bookings komplett Dummy | `bookings/court-bookings.tsx:75` |
| P1-2 | "Meine Buchungen" hartkodierte Testdaten | `bookings/my-bookings.tsx:12` |
| P1-3 | Court-Kalender "Buchung bestätigen" ohne Handler | `courts/court-calendar.tsx:383` |
| P1-4 | Trainer-Wochenansicht komplett Mock | `trainer-weekly-view.tsx:63` |
| P1-5 | SEPA-Mandatunterzeichnung simuliert nur | `sepa-mandate-signing.tsx:154` |
| P1-6 | MemberBilling-Rechnungen nach Reload weg | `member-billing.tsx:51` |
| P1-7 | Invoice-Übersicht zeigt immer 0 Euro bezahlt | `billing/invoices/overview/route.ts:92` |
| P1-8 | Offene-Posten ignorieren Teilzahlungen | `billing/open-items/route.ts:65` |
| P1-9 | Approval-E-Mails werden nie versendet | `api/emails/onboarding/route.ts` |
| P1-10 | Trainer-Billing In-Memory (Datenverlust) | `src/application/services/billing.service.ts:11` |

### P2 — Architektur/Integrität

| # | Problem | Bereich |
|---|---------|---------|
| P2-1 | Buchung → Billing Pipeline fehlt komplett | Systemgrenze |
| P2-2 | Stunden → Billing Pipeline fehlt komplett | Systemgrenze |
| P2-3 | Overdue-Status wird nie automatisch gesetzt | `billing/invoice.service.ts:206` |
| P2-4 | Invoice-Nummern Race-Condition + Duplikate | `billing/invoice.service.ts:27` |
| P2-5 | Invoice-Typ immer `'other'` hardcoded | `billing/invoice.service.ts:55` |
| P2-6 | Sentry in `devDependencies` | `package.json` |
| P2-7 | Node-Version-Mismatch 20 vs 24 | `docker/frontend.Dockerfile` |
| P2-8 | CI-YAML-Einrückungsfehler E2E-Job | `.github/workflows/ci.yml` |
| P2-9 | SEPA-Env-Vars undokumentiert + unvalidiert | `lib/env.ts` |
| P2-10 | `unsafe-eval`/`unsafe-inline` in CSP | `next.config.js` |

### P3 — UX / Technische Schulden

| # | Problem | Datei:Zeile |
|---|---------|-------------|
| P3-1 | `prompt()` für Ablehnungsgrund | `admin/hours-logs/page.tsx:329` |
| P3-2 | Hartkodierte Demo-Adresse/Telefon in 6 Dateien | mehrere |
| P3-3 | `day_of_week = 0` → 'monday' falsches Mapping | Migration `20260507000000:57` |
| P3-4 | CSV-Import erstellt Orphan-Payments | `billing/payments/import/route.ts:98` |
| P3-5 | Dunning ohne E-Mail-Versand | `billing/dunning.service.ts:71` |
| P3-6 | Waitlist ohne Benachrichtigung | `booking/waitlist.service.ts:125` |
| P3-7 | N+1-Abfragen ScheduleService | `booking/schedule.service.ts:124` |
| P3-8 | Trainer-Dropdown zeigt UUIDs statt Namen | `trainer-availability-calendar.tsx` |
| P3-9 | Onboarding-Route ohne Auth-Guard | `api/emails/onboarding/route.ts` |
| P3-10 | In-Memory Rate-Limiting wirkungslos bei Skalierung | `lib/rate-limit.ts:105` |

---

## Empfohlene Sprint-Planung

**Sofort (< 1 Tag):**
1. `middleware.ts:77-81` — Test-Mode-Cookie entfernen (5 min, kritische Security)
2. Stripe-Webhook Idempotenz-Check (`external_id`-Duplikatprüfung)
3. Sentry nach `dependencies` verschieben
4. CI-YAML E2E-Job Einrückung fixen

**Sprint 1 (1 Woche):**
- `court-bookings.tsx` + `my-bookings.tsx` an echte API anbinden
- `courts/court-calendar.tsx` Buchungs-Handler implementieren
- Invoice-Übersicht `paid_amount` korrekt berechnen (JOIN payments)
- SEPA-Mandatunterzeichnung echten API-Call einbauen
- E-Mail-Route API-Mismatch fixen

**Sprint 2 (2 Wochen):**
- Buchung → Stunden → Billing Pipeline implementieren
- Cron-Job für automatischen Overdue-Invoice-Status
- Trainer-Billing von In-Memory auf Supabase migrieren
- Trainer-Wochenansicht an echte API anbinden
- Node-Version im Dockerfile auf 24 aktualisieren

**Pre-Launch-Checklist:**
- [ ] Alle hardkodierten Demo-Werte durch Systemeinstellungen ersetzt
- [ ] SEPA-Env-Vars in `lib/env.ts` und `.env.example` dokumentiert
- [ ] `vercel.json` erstellt oder Deployment-Plattform konfiguriert
- [ ] Redis/Upstash für Rate-Limiting konfiguriert
- [ ] CSP `unsafe-eval`/`unsafe-inline` entfernt
- [ ] Role-Bleeding in `lib/api-auth.ts` gefixt
- [ ] Vollständiger E2E-Test aller 4 Rollen-Workflows

---

*Audit erstellt 2026-05-18 | 4 parallele Analyse-Agents*
*Dateien: PRODUCTION_AUDIT_part1.md (Auth) · part2.md (Billing) · part3.md (Buchungen) · part4.md (UI/Prioritäten)*
