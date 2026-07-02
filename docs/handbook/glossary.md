# Glossar — SwingZ-Begriffswörterbuch

> Schnellreferenz für Begriffe, die in Meetings, Audits, Tickets und Doku immer wieder vorkommen. Pflege: jeder PR, der einen neuen Begriff einführt, ergänzt hier einen Eintrag.

## A

### Audit-Log

Tabelle `audit_logs`. Jede kritische Schreib-Aktion (Buchung, Storno, Rollenwechsel, Rechnung) wird mit `actor_id`, `resource_type`, `action`, `details` (JSONB) und `metadata` (JSONB) geloggt. Pflichtfelder für DSGVO-Compliance (siehe P0-Finding "DSGVO-Wipe unvollständig" in `docs/PROJEKTANALYSE-KONSOLIDIERT-2026-07-01.md`).

### Auto-Gen (Handbuch)

Siehe [`README.md`](./README.md#automatischer-antteil). Skript `scripts/docs-autogen.ts` regeneriert `data-model.md` und `api-reference.md` aus dem Code.

## B

### Background-Job

Asynchroner Task, der vom `lib/jobs/runner.ts` oder per `app/api/cron/*` ausgeführt wird. Tabelle `background_jobs` trackt Status (queued, running, completed, failed). **Race-Condition-Risiko**: `upsert` ohne `locked_at`/`locked_by` (siehe P0-Finding 13). Schutz: Migration `20260728_fix_background_jobs_locking.sql`.

### Base-Path vs. Pflicht-Route

`/api/clubs/[id]/route.ts` ist eine **durchgehende** (mandatory) Route — verarbeitet PATCH/DELETE. Im Gegensatz zu reinen Datenrouten, die nur unter `lib/` leben.

### BFS / DFS (Booking-Search)

Booking-Engine (`lib/court-booking-engine.ts`) traversiert Slots in BFS-Reihenfolge. Bei Optimierungen zuerst BFS-Slots kritisch klumpen.

### Branded-Type

TypeScript-Pattern: `MemberId = string & { __brand: 'MemberId' }`. Verhindert, dass eine `SessionId` versehentlich als `MemberId` verwendet wird. In `src/domain/value-objects/*` definiert.

## C

### Calendar-Subscription (ICS)

`lib/ical-export.ts` und `lib/calendar-export.ts` generieren RFC-5545-konforme `.ics`-Feeds pro Trainer und pro Member. URLs signed mit JWT.

### Chargeback

Stripe-Dispute. Auswirkung: Stripe-Balance wird debitiert, Club-Account bleibt aktiv (kein Auto-Ban), aber im Dashboard markiert. Webhook `charge.dispute.created` → Eintrag in `notifications` + E-Mail an Owner.

### Clean Architecture

Verzeichnis-Struktur-Symbolik:

```
src/domain/          ← Pure business logic (entities, value objects, repository interfaces)
src/application/     ← Use cases, DTOs, services
src/infrastructure/  ← DB repositories, external services
app/                 ← Presentation (Next.js Pages, API routes)
```

Außen darf innen nicht kennen. Drift-Warnung: `docs/PROJEKTANALYSE-KONSOLIDIERT-2026-07-01.md` listet ~80 % Drift (nur 62/306 Routes nutzen den Layer).

### Club-Switcher

Cookie-basierter Mechanismus: `ADMIN_CLUB_COOKIE` (`lib/cookies.ts`) speichert die `club_id`, an der Owner/Superadmin aktuell arbeitet. Wird geprüft in `lib/api-auth.ts` → `buildAuthContext()` und `lib/admin-context.ts` → `requireAdminClub()`.

### Context-Provider

React-Konzept; in SwingZ: `TenantProvider` (`lib/tenant-context.tsx`), `QueryClient` (`lib/query-client.ts`), `ThemeProvider`, `ToastProvider`. HOC's sind verpönt, Composition stattdessen.

### CQRS

Command Query Responsibility Segregation. Im Code sichtbar als `xxx.use-cases.ts` (Application Layer) statt direktem Repository-Call. **Beispiel-Booking:** `BookingUseCase.create()` (Command) vs. `BookingUseCase.findByMember()` (Query) — siehe `src/application/use-cases/booking.use-cases.ts`.

### CSAT

Customer Satisfaction Score. Wird aktuell NICHT im Produkt gemessen. Sandbox: `components/analytics-provider.tsx` hat Hooks für späteres PostHog/Mixpanel-Tracking.

## D

### DSGVO

EU-Datenschutz-Grundverordnung. Pflicht-Felder: Rechtsgrundlage der Verarbeitung (`clubs.legal_basis`), Speicherdauer, Auskunftsrecht, Recht auf Löschung. Kritisch: `lib/services/anonymize.service.ts` anonymisiert nur 4 Felder (email/full_name/phone/avatar_url) — Adresse, SEPA-IBAN, Notfallkontakt bleiben. **MUSS vor Produktiv-Release gefixt werden** (P0-Finding 6).

### DTB-ID

Deutscher Tennis Bund ID. Pflicht-Feld für Mitglieder, die Punktspiele bestreiten. Migration `20260715_dtb_id_field.sql`.

### Drizzle

TypeScript-ORM. Schema-Definitionen in `src/infrastructure/persistence/schema/`. Repositories in `src/infrastructure/persistence/repositories/`. Migrations in `supabase/migrations/*.sql` (von Hand, nicht von Drizzle generiert — Konsolidierung in Migration `20260507000000_schema_consolidation.sql`).

### Dunning (Mahnwesen)

Prozess: Rechnung wird nicht fristgerecht bezahlt → Mahnstufe 1 (1 Tag nach Fälligkeit) → Mahnstufe 2 (7 Tage) → Verzugszins (ab 14 Tage) → ggf. Account-Sperre. Migrationen `20260624_mahnwesen_verzugszins_decisions.sql` + `20260607_*_dunning_*`. **Lücke:** `invoice.payment_failed` wird nicht behandelt (P0-Finding 8).

### Dynamic-Pricing

Feature-Flag `dynamic_pricing`. Migration `20260725_dynamic_pricing_rules.sql` + `useClubFeatures`-Hook. Erlaubt zeitbasierte Preise: Peak/Off-Peak, Tagespreise, Saison-Aufschläge.

## E

### ELO-Rating

Spieler-Stärke-Ranking. Trigger `20260630_elo_trigger.sql` aktualisiert ELO nach Match-Result.

### Epic / Ticket

Tickets werden im Verzeichnis `docs/tickets/` (Subdir nach Epic) gehalten. Status-Quelle: nicht Git, sondern `STATUS.md` oder Jira (je nach Setup).

## F

### Feature-Flag (clubs.features)

JSONB-Spalte in `clubs`. Speichert aktivierte Module als `{ "shop": true, ... }`. Master-Registry in `lib/features.ts`. Toggle-Pattern: `useClubFeatures(clubId)` in `hooks/`.

### Frozen-Object-Pattern

Verhindert versehentliche Mutationen: `Object.freeze()` an Stellen, wo Konfig-Objekte exportiert werden (z. B. lib/features.ts → `as const`).

## G

### GDPR → siehe DSGVO

### Gemini Flash

LLM aktiv für KI-Matchmaking und Saison-Clustering. Provider: Google. Konfiguration via `GOOGLE_GENERATIVE_AI_API_KEY` in `lib/env.ts`. **Achtung**: kein Timeout/Rate-Limit im Code → P1-Finding (Kostenkontrolle fehlt).

### GoBD

Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern, Aufzeichnungen und Unterlagen in elektronischer Form. Pflicht für deutsche Buchhaltung. Migrations-Trigger `20260607_fix_gobd_trigger*.sql` + `20260630_fix_gobd_trigger_total_amount.sql` korrigieren Buchhaltungs-Felder.

## I

### ICS

iCalendar-Standard (RFC-5545). `.ics`-Export aus `lib/ical-export.ts`.

### Idempotenz

Stripe-Webhook-Pattern: `check_and_record_stripe_event` RPC prüft `event_id` UNIQUE, INSERT in atomare RPC. Vermeidet Doppel-Buchungen bei Retry. Code-Refs: `app/api/webhooks/stripe/route.ts` + RPC in Migration `20260623_stripe_events_idempotency.sql`.

### Idempotency-Key

Client-seitige Schutzmaßnahme. Manche Routes (z. B. Stripe-Subscribe) akzeptieren `Idempotency-Key`-Header.

## J

### JWT

JSON Web Token. Wird für ICS-Calendar-Subscription-URLs signiert (nicht für Auth — Supabase Auth nutzt cookie-basiertes Session).

## K

### KI-Matchmaking

KI-Modul (Gemini). Empfehlung von Spielpartnern auf Basis Niveau + Verfügbarkeit. UI: `/admin/ai/matchmaking`. Feature-Flag `ai_matchmaking`. Siehe `user/admin.md`.

## L

### Lead-Time

Nicht zu verwechseln mit Stripe-Lead-Time. SwingZ-intern: Zeit zwischen Booking-Anfrage und tatsächlichem Slot-Beginn.

### Linting-Ausnahmen

`.eslintignore` fehlt → P1-Finding. `ds-bundle/` (Vendor-JS) erzeugt 463 von 626 Lint-Findings (Phantom-Last).

## M

### Membership vs. Auth

Auth = Supabase-Session (gültig 1 Stunde). Membership = `user_club_memberships`-Eintrag (kann inaktiv sein oder mehrere Clubs umfassen). `requireAuth` (lib/auth.ts) vs. `requireAdminClub` (lib/admin-context.ts) — siehe [`dev/auth-rbac.md`](./dev/auth-rbac.md).

### Multi-Tenant

Architektur-Muster: eine Datenbank, mehrere Vereine isoliert per `club_id`. DB-seitig: Row-Level-Security (RLS). Code-seitig: Service-Client umgeht RLS → **Vorsicht**.

## N

### nuLiga

Externe Plattform des DTB für Liga-Verwaltung. CSV-Import-Route `app/api/admin/nuliga/import/route.ts`. Migration `20260715_nuliga_sync_log.sql` + `20260729_nuliga_import_unique_constraints.sql` (P0-Finding 9: UNIQUE-Constraint fehlt, Error-Rückgabe ignoriert).

## O

### Office-Flag (Ämter)

Vereinsämter wie Kassenwart, Jugendwart, Platzwart, Mannschaftsführer, Turnierleiter. Gespeichert in `user_club_memberships.office_flags` (JSONB). Migration `20260625_office_flags.sql`. `verifyOffice()` in `lib/api-auth.ts`. Verwendet für granulare Berechtigungen, ohne separate Rolle.

### Open-Meteo

Free Weather API. Verwendet in `weather_integration` Feature. Keine API-Key nötig. Auto-Sperre von Plätzen bei Regen.

### Orion (Performance-Monitoring)

NICHT vorhanden. Performance-Tracking fehlt — siehe P1-Finding "Kein CI-Gate für Performance".

### Owner

Plattformbetreiber. Sieht ALLE Clubs, hat keinen `club_id`. Migration `20260621_add_owner_role.sql` + RLS-Policies `is_owner()`. Rollen-Rang 5 (höchste). Dashboard `/owner`. Siehe [`user/owner.md`](./user/owner.md).

## P

### Pagination

Standard: `getPagination()` + `buildPaginationMeta()` aus `lib/pagination.ts`. **Nur 5/306 Routes nutzen es** (P1-Finding) — Drift zu direkten `.range()`-Calls.

### Pricing-Rule

Dynamische Preisregel. Migration `20260725_dynamic_pricing_rules.sql`. UI im Admin unter `/admin/pricing`. Aktivierbar via `dynamic_pricing`-Feature.

### Probetraining (Trial-Training)

Öffentliche Anmeldung ohne Login. URL `/trial-training`. Speichert in `trial_trainings`-Tabelle (Migration `20260506280000_trial_trainings_table.sql`). Siehe [`user/public-trial.md`](./user/public-trial.md).

## Q

### QStash

Upstash QStash für HTTP-basierte Job-Queues. Cron-Routes können per QStash getriggert werden, umgehen Vercel-Time-Limit.

## R

### RBAC

Role-Based Access Control. Implementiert via `verifyRole()` in `lib/api-auth.ts`. Rollen vergleicht als Zahlen (siehe `ROLE_HIERARCHY`).

### Race-Condition

Parallele Trigger überschreiben sich. Beispiel: Background-Job ohne Locking (P0-Finding 13). Fast-Fix: `SELECT … FOR UPDATE` oder Lock-Token (`locked_at` + `locked_by`).

### RLS (Row-Level-Security)

Postgres-Sicherheits-Feature. Policies in `supabase/migrations/…rls_*.sql`. Service-Client (`createServiceClient()` aus `lib/supabase/service.ts`) **umgeht** RLS — siehe [`dev/supabase-setup.md`](./dev/supabase-setup.md).

### RSVP

Member-RSVP für Sessions. Tabellen: `session_rsvps` (`20260605_add_session_rsvps.sql`) + `season_waitlists` (`20260621_add_season_waitlists.sql`). Status: `going | waitlisted | declined`. Aggregiert in `lib/rsvp-status.tsx`.

## S

### Sentry

Error-Monitoring. Standardmäßig aktiv. **Lücke**: `app/global-error.tsx` loggt nur `console.error`, das `withSentryConfig()` in `next.config.js` fehlt (P0-Finding 10).

### SEPA

Single Euro Payments Area. Lastschrift-Mandat. Tabelle `sepa_mandates` (Migration `20260506310000_sepa_mandates_table.sql`). Validierung in `lib/iban.ts`.

### Service-Client

`createServiceClient()` aus `lib/supabase/service.ts`. Nutzt `SUPABASE_SERVICE_ROLE_KEY`. **Umgeht RLS** — nur in vertrauenswürdigen Server-Contexts einsetzen (Background-Jobs, Cross-Tenant-Aggregation, Notifications).

### Soft-Delete

NICHT im Projekt verwendet. DSGVO greift stattdessen (siehe [`anonymize.service.ts`](../../lib/services/anonymize.service.ts)).

### SSRF

Server-Side Request Forgery. Risiko-Checkliste: Zapier-Webhook mit `NODE_ENV !== 'production'`-Bypass (P1-Finding). Sentry-Webhook-URLs gegen SSRF absichern (allow-list Domains).

### Stripe

Payment-Provider. API-Version `2026-05-27.dahlia`. Wrapper: `lib/stripe/client.ts` (graceful) + `lib/stripe/stripe-client.ts` (strict, für Webhooks). Pricing: Starter €29/Monat, Professional €79/Monat.

### Superadmin

Tennisschule-Chef. Verwaltet mehrere Vereine. `club_id = NULL`. Rollen-Rang 4. Dashboard `/superadmin`. Siehe [`user/superadmin.md`](./user/superadmin.md).

## T

### Tab-Sync

Schwierige UX-Stelle: wenn 2-Tab-Logins parallel laufen, kommt es zu Race Conditions. Mitigation: Tab-Token + localStorage-Watch.

### Trainer-Availability

2 Tabellen: `trainerAvailability` (legacy) + `trainerAvailabilities` (neu). Konsolidierung offen (P2). Wöchentliche Slots + Day-Mapping (Migration `20260518_fix_trainer_availability_day_mapping.sql`).

### Trial-Training

→ siehe Probetraining

## U

### UI-Sprache

Deutsch durchgängig. CLAUDE.md: "Alle UI-Texte auf Deutsch".

### User-ID vs. Member-ID

`user.id` (Supabase-Auth) ≠ `members.id` (Domain-Entity). Verknüpfung über `members.user_id`. Member-Profil-Daten ohne Login nicht in Auth-User-Schema.

### User-Role

TypeScript: `UserRole = 'owner' | 'superadmin' | 'admin' | 'trainer' | 'member'` aus `lib/auth-common.ts`.

## V

### Vercel-Cron

Cron-Routes unter `app/api/cron/*`. Konfiguration in `vercel.json`. **Lücke:** `CRON_SECRET` als optional markiert in `lib/env.ts:44` (P0-Finding 4).

### Verein → Club

Domän-Begriff: "Verein" (User-sichtbar) und "Club" (Datenbank-Spalte). `clubs`-Tabelle ↔ Vereins-UI-Logik.

## W

### Wipe-User

`lib/services/anonymize.service.ts` — anonymisiert User-Daten. **Unvollständig**: nur 4 Felder. Soll auch Adresse, SEPA-IBAN, Notfallkontakt, `trainer_member_notes` abdecken (P0-Finding 6).

### Work-Duty

Arbeitsdienst-Modul. Zuweisung + Nachverfolgung. Migration `20260506220000_hours_log_tables.sql` + `20260624_add_hours_logs_rejection_reason.sql`.

---

**Neue Begriffe:** PR mit Label `docs(glossary)` ergänzt Einträge alphabetisch ein.
