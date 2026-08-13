# SwingZ – Marktreife-Analyse

> **Erstellt:** 2026-05-18  
> **Methode:** Direkte Codebase-Inspektion (keine alten .md-Dateien)  
> **Baseline:** `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`

---

## Zusammenfassung (Executive Summary)

| Metrik                  | Wert              | Status |
| ----------------------- | ----------------- | ------ |
| TypeScript-Fehler       | 7                 | 🟡     |
| ESLint-Fehler           | 0                 | 🟢     |
| Tests gesamt            | 295               | –      |
| Tests bestanden         | 196 (66%)         | 🟡     |
| Tests fehlgeschlagen    | 2                 | 🔴     |
| Tests skipped           | 97 (33%)          | 🟡     |
| Build                   | ❌ Fehlgeschlagen | 🔴     |
| API-Routen              | ~200 Handler      | 🟢     |
| Rate-Limiting-Abdeckung | ~170/200 (85%)    | 🟡     |
| CSRF-Schutz-Abdeckung   | ~10/200 (5%)      | 🔴     |
| console.log in Prod     | 206 Fundstellen   | 🟡     |

**Gesamtbewertung:** Das Projekt hat eine solide Basis, ist aber **nicht produktionsreif**. Die drei kritischen Blocker (P0) sind: Build-Failure, CSRF-Lücken und fehlschlagende Tests.

---

## 1. Baseline – Code-Qualitätsmetriken

### 1.1 TypeScript (`npm run typecheck`)

**7 Fehler**, alle reproduzierbar:

| #   | Typ    | Datei                      | Zeile | Problem                                              |
| --- | ------ | -------------------------- | ----- | ---------------------------------------------------- |
| 1   | TS2322 | `court-types-client.tsx`   | 619   | `"destructive"` nicht assignable zu `ConfirmVariant` |
| 2   | TS2322 | `courts-manage-client.tsx` | ~580  | `"destructive"` nicht assignable zu `ConfirmVariant` |
| 3   | TS2322 | `tournaments/page.tsx`     | –     | `"brand"` nicht assignable zu `ConfirmVariant`       |
| 4   | TS2322 | `tournaments/page.tsx`     | –     | `Element` nicht assignable zu `string`               |
| 5   | TS2322 | `trainer-booking/page.tsx` | –     | `"brand"` nicht assignable zu `ConfirmVariant`       |
| 6   | TS2322 | `trainer-booking/page.tsx` | –     | `Element` nicht assignable zu `string`               |
| 7   | TS2339 | `web-vitals-reporter.tsx`  | –     | `onFID` existiert nicht auf Modul                    |

**Root Cause für Fehler 1–6:** `ConfirmDialog` akzeptiert nur `'danger' | 'warning' | 'default'`, aber 4 Dateien übergeben `"destructive"` oder `"brand"`.

**Fix:** Entweder `ConfirmVariant` um `'destructive'` und `'brand'` erweitern (in `components/ui/confirm-dialog.tsx`), oder die Aufrufer auf gültige Werte ändern.

### 1.2 ESLint (`npx eslint . --ext .ts,.tsx`)

**0 Fehler, 0 Warnungen** ✅ – sauberer Lint-Status.

### 1.3 Tests (`npm run test:run`)

**295 Tests gesamt, 196 bestanden, 2 fehlgeschlagen, 97 skipped, 2 Suites nicht ausführbar.**

Fehlgeschlagene Tests:

| Test                                           | Erwartet | Erhalten | Ursache                       |
| ---------------------------------------------- | -------- | -------- | ----------------------------- |
| Phase2-5: `returns 401 when not authenticated` | 401      | 500      | Server-Error statt Auth-Error |
| Phase2-5: `returns 200 with points, badges...` | 200      | 500      | Gamification-Endpoint down    |

Nicht ausführbare Suites:

| Suite                       | Fehler                                                                |
| --------------------------- | --------------------------------------------------------------------- |
| `rls-policies.test.ts`      | `Could not find 'slug' column of 'clubs' in schema cache`             |
| `service-migration.test.ts` | `Could not find 'default_session_duration_minutes' column of 'clubs'` |

**97 skipped Tests** – das ist 33% der Test-Suite. Diese Tests sind bewusst deaktiviert, was auf unfertige Features hindeutet.

### 1.4 Build (`npm run build`)

**❌ Fehlgeschlagen** – TypeScript-Fehler in `court-types-client.tsx:619` (gleicher Fehler wie Typecheck #1).

**Warnung:** `The "middleware" file convention is deprecated. Please use "proxy" instead.` (Next.js 15+)

---

## 2. Sicherheitsaudit

### 2.1 CSRF-Schutz – 🔴 KRITISCH

**Nur ~10 von ~200 API-Routen verwenden `withCSRFProtection`:**

Geschützte Routen:

- `members/route.ts` (POST)
- `sepa-mandates/route.ts` (POST)
- `seasons/[id]/preferences/route.ts` (POST)
- `seasons/[id]/plan-entries/[entryId]/route.ts` (PATCH, DELETE)
- `seasons/[id]/plan-entries/route.ts` (POST)
- `seasons/[id]/auto-plan/route.ts` (POST)
- `seasons/[id]/preferences/[userId]/route.ts` (PATCH, DELETE)
- `seasons/[id]/route.ts` (DELETE)

**Ungeschützte mutations (Auswahl kritischer):**

- `auth/login/route.ts` (POST) – Login ohne CSRF
- `auth/logout/route.ts` (POST) – Logout ohne CSRF
- `bookings/route.ts` (POST) – Buchung ohne CSRF
- `bookings/[id]/cancel/route.ts` (POST) – Storno ohne CSRF
- `bookings/[id]/status/route.ts` (PATCH) – Status-Update ohne CSRF
- `billing/invoices/create/route.ts` (POST) – Rechnungserstellung ohne CSRF
- `billing/generate-invoices/route.ts` (POST) – Massenrechnung ohne CSRF
- `billing/trainers/[id]/pay/route.ts` (POST) – Auszahlung ohne CSRF
- `members/invite/route.ts` (POST) – Einladung ohne CSRF
- `members/bulk-deactivate/route.ts` (POST) – Massendeaktivierung ohne CSRF
- `trainer-profiles/route.ts` (POST) – Trainer-Profil ohne CSRF
- `admin/system/settings/route.ts` (PATCH) – Systemeinstellungen ohne CSRF
- ALLE `billing/`, `admin/`, `trainer/`, `courts/` mutations

**CSRF-Infrastruktur existiert** (`lib/csrf.ts`, `app/api/csrf-token/route.ts`), ist aber kaum genutzt.

### 2.2 Rate-Limiting – 🟡 Gut, aber Lücken

**~170 von ~200 Routen haben Rate-Limiting.** Die folgenden Kategorien fehlen:

**Fehlende Rate-Limits (Auswahl):**

- `emails/onboarding/route.ts` (POST) – kein Rate-Limit
- `email-campaigns/route.ts` (POST) – kein Rate-Limit
- `coupons/route.ts` (GET/POST) – kein Rate-Limit
- `auth/login/route.ts` (POST) – KEIN Rate-Limit! (Kritisch für Brute-Force)
- `auth/logout/route.ts` (GET/POST) – kein Rate-Limit
- `auth/callback/route.ts` (GET) – kein Rate-Limit
- `debug/auth/route.ts` (GET) – DEBUG-ENDPOINT ohne Rate-Limit
- `webhooks/stripe/route.ts` (POST) – kein Rate-Limit (sollte Signatur-Prüfung haben)
- `webhooks/zapier/route.ts` (POST) – RATE-LIMITED ✅ (STRICT)
- `qr-checkin/route.ts` (POST/GET) – kein Rate-Limit
- `public/register/route.ts` (POST) – kein Rate-Limit
- `trainer/book/route.ts` (POST) – kein Rate-Limit
- `trainer-availability/conflicts/route.ts` (GET) – kein Rate-Limit
- `shop/route.ts` (GET/POST) – kein Rate-Limit
- `docs/route.ts` (GET) – kein Rate-Limit
- `health/route.ts` (GET) – kein Rate-Limit (OK für Health-Check)
- `statistics/` (alle 3 Routen) – kein Rate-Limit
- `sessions/route.ts` – RATE-LIMITED ✅ (STANDARD)
- `sessions/[id]/route.ts` – RATE-LIMITED ✅
- `sessions/bulk-delete/route.ts` – RATE-LIMITED ✅ (STRICT)

### 2.3 Debug-Endpoints

**`app/api/debug/auth/route.ts`** – öffentlicher Debug-Endpoint, zeigt Auth-Status und Cookies.

- Kein Rate-Limiting
- Keine Authentifizierung
- Sollte im Production-Build entfernt oder mit Admin-Auth + Rate-Limit geschützt werden

### 2.4 Auth-Duplikation

- `lib/auth.ts` – `requireAuth()` für Server Components
- `lib/api-auth.ts` – `requireAuthApi()` für API-Routen
- `middleware.ts` – Supabase-Session-Check
- **Zwei Auth-Implementierungen** – sollten auf eine konsolidiert werden

### 2.5 Weitere Sicherheitsbedenken

- `process.env.NEXT_PUBLIC_SUPABASE_URL` in 59+ Stellen – alle client-safe?
- `sentry.server.config.ts` löscht `STRIPE_SECRET_KEY` aus Events – gut, aber `console.log` kann Secrets leaken
- Keine `helmet`-ähnlichen Security-Header gefunden (CSP, HSTS, X-Frame-Options)
- Cookie-Security: `middleware.ts` nutzt Supabase-Cookies – SameSite korrekt?

---

## 3. Architektur & Code-Duplikation

### 3.1 Doppelte Architektur: `lib/` vs `src/`

| Aspekt          | `lib/`                                                         | `src/`                                                                           |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Auth            | `auth.ts`, `api-auth.ts`                                       | –                                                                                |
| Supabase Client | `supabase/server.ts`                                           | `infrastructure/external/supabase/server.ts`                                     |
| Validation      | `validation.ts`, `validation-schemas.ts`, `form-validation.ts` | `application/validation/schemas.ts`                                              |
| Booking         | `booking/`, `booking-rules.service.ts`                         | `domain/booking/`                                                                |
| Billing         | `billing-engine.ts`, `billing/`                                | `application/services/billing.service.ts`                                        |
| Email           | –                                                              | `application/services/email.service.ts`, `infrastructure/email/email.service.ts` |

**Beide Architekturen werden aktiv genutzt** – Feature-Flags steuern die Migration von `lib/` zu `src/`. Alle 13 Feature-Flags sind derzeit auf `false`.

### 3.2 Validierungs-Duplikation (4+ Dateisets)

1. **`lib/validation.ts`** – `loginSchema`, `memberProfileSchema`, `bookingSchema`, `sessionSchema`, `clubSchema`
2. **`lib/validation-schemas.ts`** – `CreateMemberSchema`, `CreateSEPAMandateSchema`, `CreateTrialTrainingSchema`, `CreateHoursLogSchema`
3. **`lib/form-validation.ts`** – `login`, `member`, `session`, `booking`, `invoice`, `sepaMandate`, `settings`
4. **`src/application/validation/schemas.ts`** – `createClubSchema`, `createBookingSchema`, `createTrainerSchema`, `inviteMemberSchema`
5. **`src/application/validation/schemas/registration.schema.ts`** – `personalInfoSchema`, `addressSchema`, `tennisInfoSchema`
6. **`src/application/validation/schemas/reminders.schema.ts`** – `sendRemindersSchema`

**Empfehlung:** Auf EIN Validierungssystem konsolidieren (vorzugsweise `src/application/validation/` im DDD-Stil).

### 3.3 Stripe-Duplikation

| Datei                           | Verwendung                                | Status |
| ------------------------------- | ----------------------------------------- | ------ |
| `lib/stripe/stripe-client.ts`   | `billing/invoices/[id]/checkout/route.ts` | Aktiv  |
| `lib/stripe/client.ts`          | `stripe/checkout/route.ts`                | Aktiv  |
| `services/billing/src/index.ts` | Express-Service (separat?)                | Unklar |

**Zwei Stripe-Clients mit unterschiedlicher API** – `getStripeClient()` vs `getStripe()`.

**Zwei Webhook-Routen:**

- `app/api/webhooks/stripe/route.ts`
- `app/api/stripe/webhook/route.ts`

Stripe sendet Events an EINE URL – eine der beiden ist tot. Welche?

### 3.4 Weitere Duplikationen

- **Trainer-Availability:** `app/api/trainer-availability/` UND `app/api/trainer/availability/` – zwei Pfade!
- **API-Errors:** `lib/api-errors.ts` vs `lib/api-error.ts`
- **Schedule-Generator:** `lib/ai/schedule-generator.ts` vs `lib/ai/schedule-generator-v2.ts`
- **Feature-Flags:** `lib/features/feature-flags.ts` vs `lib/feature-flags.ts`

---

## 4. Datenbank & Schema

### 4.1 Schema-Drift: Drizzle vs Supabase

- **Drizzle-Snapshots:** `drizzle/meta/0000-0003_snapshot.json`
- **Supabase-Migrations:** `supabase/migrations/` (10+ SQL-Dateien)
- **Dokumentierter Konflikt:** `20260507000000_schema_consolidation.sql:14` – "Drizzle nutzt 'trainer_club' (singular), migrations nutzen..." – Plural/Singular-Namenskonflikt!

**Tests fehlgeschlagen wegen Schema-Drift:**

- `rls-policies.test.ts`: `'slug' column of 'clubs' not found`
- `service-migration.test.ts`: `'default_session_duration_minutes' column not found`

**Migration-Infrastruktur:** `drizzle-kit` + `scripts/apply-migrations.js` + `scripts/test-migrations.sh` – solide.

### 4.2 Feature-Flags – Alle OFF

Alle 13 Flags in `lib/features/feature-flags.ts` sind `false` (gesteuert via `process.env`):

`USE_BILLING_REPOSITORY`, `USE_COURSE_REPOSITORY`, `USE_ATTENDANCE_REPOSITORY`, `USE_MEMBER_REPOSITORY`, `USE_TRAINER_REPOSITORY`, `USE_ABSENCE_REPOSITORY`, `USE_FEE_CONFIGURATION_REPOSITORY`, `USE_PAYMENT_SETTINGS_REPOSITORY`, `USE_SYSTEM_SETTINGS_REPOSITORY`, `USE_TRIAL_TRAINING_REPOSITORY`, `USE_TRAINER_PROFILE_REPOSITORY`, `USE_HOURLY_RATE_REPOSITORY`, `USE_SEPA_MANDATE_REPOSITORY`

**Implikation:** Die Drizzle-Repositories sind implementiert, aber nicht aktiviert. Das Projekt läuft auf In-Memory-Fallbacks oder direkten Supabase-Queries.

### 4.3 Seed-Daten

5 Seed-Skripte vorhanden: `seed-db.ts`, `seed-full.ts`, `seed-clubs-members.ts`, `seed-users.ts`, `seed-trainers.ts`.

---

## 5. TODO- & Code-Hygiene

### 5.1 TODOs im Produktionscode

| Datei                                | Zeile | Inhalt                                                            | Priorität |
| ------------------------------------ | ----- | ----------------------------------------------------------------- | --------- |
| `app/api/ai/matchmaking/route.ts`    | 25    | `const myCity = null; // TODO: Add city field`                    | P2        |
| `app/api/ai/matchmaking/route.ts`    | 45    | `const memberLevel = 'intermediate'; // TODO: Extend users table` | P2        |
| `app/api/ai/matchmaking/route.ts`    | 60    | `city: null, // TODO: Add city field`                             | P2        |
| `app/api/emails/onboarding/route.ts` | 18    | `// TODO: Integrate with Resend for actual email sending`         | P1        |

### 5.2 console.log statt Logger

- **206 `console.log/error/warn`** in Produktionscode
- `lib/logger.ts` existiert mit `LogLevel.DEBUG|INFO|WARN|ERROR` – wird kaum genutzt
- Sentry-Integration existiert – aber Fehler werden meist nur geloggt, nicht an Sentry reported

### 5.3 Hardcodierte Werte

- **`COBADEFFXXX`** (Commerzbank-Test-BIC) in 14+ Dateien, inkl. `components/sepa-mandate-signing.tsx` (Produktionscode)
- `PLACEHOLDER_PREFIX` in `lib/stripe/client.ts` – Stripe-Platzhalter-Keys
- `SKIP_VALIDATION` in `lib/env.ts` – erlaubt Betrieb ohne Env-Validierung

---

## 6. Tennis-Domäne – Fachliche Analyse

### 6.1 Buchungssystem

| Feature           | Status | Details                                                         |
| ----------------- | ------ | --------------------------------------------------------------- |
| Einzelbuchung     | ✅     | `app/api/bookings/route.ts` POST/GET                            |
| Serienbuchung     | ✅     | `app/api/bookings/series/route.ts`, `validate-series/route.ts`  |
| Stornierung       | ✅     | `app/api/bookings/[id]/cancel/route.ts`                         |
| Status-Update     | ✅     | `app/api/bookings/[id]/status/route.ts`                         |
| Safe-Booking      | ✅     | `lib/booking/safe-booking.ts` – Doppelbuchungs-Prävention       |
| Warteliste        | ✅     | `lib/booking/waitlist.service.ts`, `waitlist_entries` Tabelle   |
| Platz-Typen       | ✅     | `app/api/court-types/`, Sand/Hartplatz/Rasen/Teppich/Kunstrasen |
| Flutlicht         | ✅     | `has_lighting`, `lighting_hours_start/end` in DB                |
| Trainer-Zuweisung | ✅     | Sessions haben `trainerId`                                      |

**ABER:** Wartelisten-UI nicht gefunden. Automatische Nachrück-Logik? Benachrichtigung?

### 6.2 Saison-Planung

| Feature         | Status | Details                                   |
| --------------- | ------ | ----------------------------------------- |
| Seasons CRUD    | ✅     | `app/api/seasons/route.ts`                |
| Plan-Entries    | ✅     | `app/api/seasons/[id]/plan-entries/`      |
| Auto-Planning   | ✅     | `app/api/seasons/[id]/auto-plan/route.ts` |
| Preferences     | ✅     | `app/api/seasons/[id]/preferences/`       |
| Migration-Check | ✅     | Warnt wenn Tabelle fehlt                  |

**ABER:** Auto-Planning benötigt DB-Migration (`20260506_season_planning_system.sql`). Ist sie in Production ausgeführt?

### 6.3 Trainer-Management

| Feature         | Status | Details                                         |
| --------------- | ------ | ----------------------------------------------- |
| Profile CRUD    | ✅     | `app/api/trainer-profiles/`                     |
| Verfügbarkeit   | ✅     | `app/api/trainer-availability/`                 |
| Abwesenheiten   | ✅     | `app/api/absences/` mit Approve/Reject          |
| Qualifikationen | ✅     | `app/api/trainer-profiles/[id]/qualifications/` |
| Trainer-Buchung | ✅     | `app/api/trainer/book/route.ts`                 |
| Feedback        | ✅     | `app/api/trainers/[trainerId]/feedback/`        |

**Duplikation:** `trainer-availability` vs `trainer/availability` – zwei getrennte API-Pfade.

### 6.4 Turniere

| Feature        | Status | Details                                 |
| -------------- | ------ | --------------------------------------- |
| Turnier CRUD   | ✅     | `app/api/tournaments/`                  |
| Registrierung  | ✅     | `app/api/tournaments/[id]/register/`    |
| Meine Turniere | ✅     | `app/api/tournaments/my-registrations/` |

---

## 7. Finanzen & Abrechnung

### 7.1 Mahnwesen (Dunning)

**Umfassend implementiert:**

- `lib/billing/dunning.service.ts` – Mahnstufen 1-3, Mahngebühren
- `lib/state-machines/invoice-state-machine.ts` – Status: draft→sent→overdue→dunning→paid
- `supabase/functions/scheduled-dunning-run/` – Automatischer Mahnlauf
- `supabase/functions/process-automatic-dunning/` – Mahnverarbeitung
- `lib/billing/stats.service.ts` – Mahnstatistiken (Level 1/2/3)
- `app/api/billing/open-items/route.ts` – Offene Posten

**Offene Fragen:**

- Sind die Supabase Edge Functions deployed und per Cron scheduled?
- `calculate_dunning_level` RPC-Funktion – existiert sie in der DB?
- Mahngebühren-Staffel konfigurierbar?
- Mahnbrief-PDF-Generator?

### 7.2 Rechnungswesen

| Feature              | Status | Details                                                      |
| -------------------- | ------ | ------------------------------------------------------------ |
| Rechnung erstellen   | ✅     | `app/api/billing/invoices/create/route.ts`                   |
| Rechnungsübersicht   | ✅     | `app/api/billing/invoices/overview/route.ts`                 |
| Invoice PDF          | ✅     | `lib/invoice-pdf.ts`, `lib/pdf/invoice-pdf.tsx` (duplicate!) |
| Invoice PDF Route    | ✅     | `app/api/invoices/[id]/pdf/route.ts`                         |
| Stripe Checkout      | ✅     | `app/api/billing/invoices/[id]/checkout/route.ts`            |
| Stripe Webhook       | ⚠️     | ZWEI Routen (s.o.)                                           |
| Trainer-Abrechnung   | ✅     | `app/api/billing/trainers/`                                  |
| Zahlungsimport (CSV) | ✅     | `app/api/billing/payments/import/route.ts`                   |
| Zahlungs-Settings    | ✅     | `app/api/payment-settings/`                                  |

### 7.3 SEPA

| Feature       | Status | Details                                                         |
| ------------- | ------ | --------------------------------------------------------------- |
| SEPA-Mandate  | ✅     | `app/api/sepa-mandates/route.ts`                                |
| PAIN008 XML   | ✅     | `lib/sepa/` – Generator                                         |
| PAIN008 Route | ⚠️     | `billing/sepa/pain008/route.ts` UND `billing/sepa-xml/route.ts` |

---

## 8. i18n & Internationalisierung

### 8.1 next-intl Status

- **`next-intl` ist installiert und konfiguriert** (`i18n/routing.ts`)
- Locales: `['de', 'en']`
- `app/layout.tsx:46` – `NEXT_LOCALE` Cookie wird gelesen
- `src/__tests__/i18n/dictionaries.test.ts` – Dictionary-Tests vorhanden
- `src/__tests__/test-utils.tsx` – `NextIntlClientProvider` in Test-Umgebung

### 8.2 🔴 Hartcodierte Locale

**135+ `import { de } from 'date-fns/locale'`** – alle Datumsformatierungen sind HARTCODIERT auf Deutsch!

Wenn ein englischer Nutzer die App verwendet, sieht er weiterhin deutsche Datumsformate. Dies muss dynamisch von `NEXT_LOCALE` abhängen.

---

## 9. UI/UX & Komponenten

### 9.1 Error Boundaries

- `components/error-boundary.tsx` – Klasse + AsyncErrorBoundary
- `components/sentry-error-boundary.tsx` – SentryErrorBoundary
- **Nur `components/layout/protected-page-wrapper.tsx` nutzt sie aktiv**
- `error.tsx` Dateien existieren nur in: `dashboard/`, `scheduler/`, `admin/dashboard/`, `admin/courts/`
- **Viele Routen ohne Error Boundary**

### 9.2 Code-Splitting

**Nur 12 Verwendungen von `Suspense`/`lazy()`/`dynamic()`:**

- `lib/code-splitting.tsx` – `createLazyComponent` (wird das genutzt?)
- `lib/performance.ts` – `createDynamicImport` (wird das genutzt?)
- `app/(public)/api-docs/page.tsx` – `dynamic(() => import('swagger-ui-react'))`
- `app/providers.tsx` – `Suspense` für QueryClient

**Empfehlung:** Schwere Admin-Komponenten (Analytics, Statistiken, Dashboard) lazy-loaden.

### 9.3 Navigations-Struktur

- `components/layout/sidebar.tsx` – Desktop
- `components/layout/mobile-bottom-nav.tsx` – Mobile
- `components/layout/header.tsx` – Top-Bar
- `components/layout/landing-header.tsx` – Landing-Page
- **Vier Navigationskomponenten** – konsistent?

### 9.4 Responsive Design

- Mobile-Navigation vorhanden ✅
- Tailwind-Breakpoints konsistent genutzt ✅
- `components/layout/protected-route.tsx` – Loading-Spinner

---

## 10. Infrastruktur & DevOps

### 10.1 Build & Deploy

- Vercel-Deployment (`.vercelignore` vorhanden)
- `middleware.ts` – Edge-kompatibel (Next.js Middleware)
- Upstash Redis – REST-API (Edge-kompatibel) ✅
- Supabase – `@supabase/ssr` (Edge-kompatibel) ✅
- **Build fehlgeschlagen** – muss vor Deployment gefixt werden

### 10.2 Monitoring

- Sentry: Server + Client konfiguriert ✅
- `lib/performance-monitor.ts` – Web Vitals
- `lib/performance.ts` – Optimierungen
- `app/api/health/route.ts` – Health-Check

### 10.3 CI/CD

- `playwright.config.ts` – E2E-Tests
- `.lintstagedrc.js` – Pre-Commit-Hooks
- **Keine GitHub Action / CI-Pipeline gefunden**

### 10.4 Abhängigkeiten

- `drizzle-kit 0.31.10`
- `next-intl` – Version?
- `@upstash/ratelimit` + `@upstash/redis`
- `sonner` (Toasts)
- `date-fns` (Datumsformatierung)

---

## 11. Rechtliche Anforderungen (D-A-CH)

### 11.1 DSGVO

| Anforderung           | Status | Details                                                      |
| --------------------- | ------ | ------------------------------------------------------------ |
| Datenexport           | ✅     | `app/api/analytics/members/export/route.ts`                  |
| Datenlöschung         | ✅     | `app/api/members/[id]/route.ts` DELETE                       |
| Audit-Logging         | ✅     | `app/api/audit-logs/`, `lib/audit/enhanced-audit.service.ts` |
| Cookie-Consent        | ❌     | Kein Cookie-Banner gefunden                                  |
| AVV (Supabase/Vercel) | ❓     | Nicht geprüft                                                |

### 11.2 SEPA-Compliance

- PAIN008-Generator vorhanden ✅
- XML-Schema-Version? 008.001.02 oder 008.001.08?
- Mandatsreferenz – eindeutig?
- Pre-Notification (14 Tage) – technisch erzwungen?

---

## 12. Priorisierte Roadmap

### P0 – Blocker (Produktivbetrieb unmöglich)

| #   | Problem                                         | Aufwand | Fix                                                     |
| --- | ----------------------------------------------- | ------- | ------------------------------------------------------- |
| 1   | Build fehlgeschlagen (TS-Fehler)                | S       | `ConfirmVariant` erweitern oder Aufrufer fixen          |
| 2   | CSRF-Schutz auf ~190 Routen fehlt               | L       | `withCSRFProtection` in allen mutations-Routen einbauen |
| 3   | 2 Tests fehlschlagen, 2 Suites nicht ausführbar | M       | Schema-Drift beheben, Gamification-Endpoint fixen       |
| 4   | Auth-Login ohne Rate-Limiting (Brute-Force)     | S       | `checkRateLimitOrFail(req, 'auth')` in Login-Route      |

### P1 – Kritisch (sollte vor Launch behoben sein)

| #   | Problem                                 | Aufwand | Fix                                                            |
| --- | --------------------------------------- | ------- | -------------------------------------------------------------- |
| 5   | 97 skipped Tests (33%)                  | L       | Skipped Tests aktivieren oder entfernen                        |
| 6   | Stripe-Webhook-Duplikation              | S       | Eine Route als kanonisch festlegen, andere entfernen           |
| 7   | SEPA-Routen-Duplikation                 | S       | `billing/sepa/pain008` vs `billing/sepa-xml` konsolidieren     |
| 8   | Trainer-Availability-Duplikation        | S       | `trainer-availability` vs `trainer/availability` konsolidieren |
| 9   | Hartcodierte `de`-Locale (135+ Stellen) | M       | Dynamische Locale aus `NEXT_LOCALE`                            |
| 10  | Debug-Endpoint in Production            | S       | Entfernen oder mit Admin-Auth schützen                         |
| 11  | Email-Versand TODO (Resend)             | M       | Resend-Integration abschließen                                 |

### P2 – Wichtig (Qualitätsverbesserung)

| #   | Problem                                                   | Aufwand | Fix                                                          |
| --- | --------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| 12  | 206 console.log → Logger                                  | L       | Alle console.\* durch `lib/logger.ts` ersetzen               |
| 13  | Validierungs-Duplikation (6 Dateien)                      | L       | Auf EIN System konsolidieren                                 |
| 14  | Auth-Duplikation (`lib/auth.ts` vs `lib/api-auth.ts`)     | M       | Konsolidieren                                                |
| 15  | API-Error-Duplikation (`api-errors.ts` vs `api-error.ts`) | S       | Konsolidieren                                                |
| 16  | Feature-Flags – alle OFF                                  | M       | Flags schrittweise aktivieren, In-Memory-Fallbacks entfernen |
| 17  | Schema-Drift Drizzle vs Supabase                          | L       | Eine Schema-Quelle definieren, Namenskonflikte lösen         |
| 18  | `COBADEFFXXX` aus Produktionscode entfernen               | S       | Konstante oder Env-Variable                                  |

### P3 – Nice-to-have

| #   | Problem                                  | Aufwand |
| --- | ---------------------------------------- | ------- |
| 19  | Wartelisten-UI fehlt                     | M       |
| 20  | Cookie-Consent-Banner                    | M       |
| 21  | Error Boundaries auf allen Routen        | M       |
| 22  | Code-Splitting für Admin-Komponenten     | M       |
| 23  | CI/CD-Pipeline (GitHub Actions)          | M       |
| 24  | `npx depcheck` – ungenutzte Dependencies | S       |
| 25  | 50+ docs/.md-Dateien aufräumen           | M       |

---

## 13. Go-Live-Checkliste

- [ ] Build erfolgreich (`npm run build`)
- [ ] Typecheck 0 Fehler (`npm run typecheck`)
- [ ] Alle Tests grün (`npm run test:run`)
- [ ] CSRF-Schutz auf allen mutations (POST/PUT/PATCH/DELETE)
- [ ] Rate-Limiting auf allen öffentlichen Routen
- [ ] Auth-Login mit Rate-Limiting (Brute-Force-Schutz)
- [ ] Debug-Endpoints entfernt oder geschützt
- [ ] Stripe-Webhook: EINE Route, korrekt konfiguriert
- [ ] SEPA-Endpoints konsolidiert
- [ ] Trainer-Availability-Pfade konsolidiert
- [ ] Email-Versand (Resend) funktional
- [ ] `date-fns` Locale dynamisch
- [ ] Sentry korrekt konfiguriert (DSN gesetzt)
- [ ] Supabase Edge Functions deployed + scheduled
- [ ] DB-Migrationen in Production ausgeführt
- [ ] Cookie-Consent implementiert
- [ ] DSGVO-Datenexport/-Löschung getestet
- [ ] Load-Testing (API-Routen unter Last)
- [ ] Uptime-Monitoring eingerichtet
