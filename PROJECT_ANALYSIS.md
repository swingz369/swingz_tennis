# SwingZ — Project Analysis

> **Generated:** 2026-06-10
> **Project:** SwingZ — Premium Tennis Club Management (KI-gestützte Trainingplanung für Tennisclubs)
> **Stack:** Next.js 15 + Turbopack, React, TypeScript strict, Tailwind, shadcn/ui, Supabase, Drizzle ORM
> **Status:** Production (Vercel), Live-Supabase (qeckztuzeymuwwtyoryi.supabase.co)

---

## Inhaltsverzeichnis

1. [Tech-Stack & Konfiguration](#1-tech-stack--konfiguration)
2. [Verzeichnisstruktur](#2-verzeichnisstruktur)
3. [Authentifizierung & RBAC](#3-authentifizierung--rbac)
4. [Datenbank-Schema](#4-datenbank-schema)
5. [API-Inventar (213 Routes)](#5-api-inventar-213-routes)
6. [Feature-Subsysteme](#6-feature-subsysteme)
7. [UI-Komponenten & Design-System](#7-ui-komponenten--design-system)
8. [Testing-Infrastruktur](#8-testing-infrastruktur)
9. [DevOps & Deployment](#9-devops--deployment)
10. [Performance & Optimierungen](#10-performance--optimierungen)
11. [Working-Tree & Offene Tasks](#11-working-tree--offene-tasks)
12. [Recent Commits (Highlights)](#12-recent-commits-highlights)

---

## 1. Tech-Stack & Konfiguration

### 1.1 Runtime

| Aspekt              | Wert                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| **Node.js**         | `>=24.0.0` (siehe `.nvmrc` + `package.json#engines`)                       |
| **Package-Manager** | pnpm (implizit — `pnpm-lock.yaml` im Working-Tree)                         |
| **Build-Tool**      | Next.js 15 mit Turbopack (`next dev --turbopack`)                          |
| **TypeScript**      | strict mode, experimental decorators, custom path-aliases für DDD-Layering |

### 1.2 Frontend-Stack

- **React 18+** mit Server-Components + Client-Components (`'use client'`)
- **Tailwind CSS** + `tailwindcss-animate` + safelist für Gradients/Animations
- **Radix UI Primitives** (`@radix-ui/react-*`) als shadcn-Basis
- **shadcn/ui** (49 Komponenten in `components/ui/`)
- **@tanstack/react-query** für Client-Side Data-Fetching
- **react-hook-form + zod** für Form-Validation
- **lucide-react** für Icons
- **sonner** für Toast-Notifications
- **date-fns** + `@/lib/locale` für Datums-Formatting
- **next-themes** für Dark-Mode
- **@dnd-kit** für Drag-and-Drop (Court-Booking, Saisonplanung)

### 1.3 Backend-Stack

- **Next.js API Routes** (`app/api/**/route.ts`) — **213 Route-Handler**
- **Supabase**:
  - **Postgres** (Haupt-DB)
  - **Auth** (GoTrue) für Login/Session
  - **Row-Level-Security (RLS)** Policies
  - **Storage** (für Trainer-Certificates, Avatare)
  - **Realtime** (für Live-Plan-Entry-Updates)
- **Drizzle ORM** + `drizzle-kit` für Migrations
- **@supabase/ssr** für Server-Side-Session-Management

### 1.4 Externe Services

- **Stripe** (in `.env.example` referenziert) für Subscription-Billing
- **Sentry** für Error-Tracking (Postgres-Integration aktiv)
- **Vercel** für Hosting + Cron-Jobs
- **Midscene AI** (mit Playwright) für AI-powered E2E-Tests
- **GitHub Actions** (über `perf-history/github-source.ts` für Re-Run-Daten)

### 1.5 Tooling

- **Husky** für Git-Hooks (pre-commit Lint)
- **ESLint** mit `FlatCompat` + Custom-Rule `pagination-nav-mutually-exclusive-props.js`
- **Prettier** (`.prettierrc`)
- **Vitest** (60% lines/statements, 55% branches Coverage)
- **Playwright** (5 Browser-Projekte: chromium, firefox, webkit, mobile-chrome, mobile-safari)

### 1.6 Wichtige Config-Dateien

| Datei                                                 | Zweck                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `package.json`                                        | Dependencies, Scripts, Engines                                              |
| `tsconfig.json`                                       | TypeScript-Config (strict, path-aliases zu `src/domain`, `src/application`) |
| `next.config.js`                                      | Bundle-Analyzer, `transpilePackages: ['@supabase/ssr']`                     |
| `tailwind.config.ts`                                  | Custom-Theme (`./styles/theme`), Safelists                                  |
| `components.json`                                     | shadcn/ui-Config (default-Style, CSS-Variables)                             |
| `drizzle.config.ts`                                   | Schema-Pfad: `src/infrastructure/persistence/schema.ts`                     |
| `vitest.config.ts`                                    | react-swc + jsdom + path-aliases                                            |
| `playwright.config.ts`                                | 5-Browser-Setup, `./tests/e2e`                                              |
| `vercel.json`                                         | 2 Cron-Jobs: `/api/cron/billing-overdue`, `/api/cron/backup`                |
| `sentry.client.config.ts` + `sentry.server.config.ts` | Error-Tracking                                                              |
| `design-tokens.json`                                  | Design-System-Tokens (v2.0.0, Forest + Navy + Orange)                       |
| `supabase-types.ts`                                   | Generierte TypeScript-Types aus Supabase-Schema                             |
| `docker-compose.test.yml`                             | Lokales Test-Postgres auf Port 54323                                        |

---

## 2. Verzeichnisstruktur

```
SwingZ/
├── app/                          # Next.js App-Router
│   ├── (public)/                 # Öffentliche Routen (Login, Register, Landing)
│   ├── (protected)/              # Auth-geschützte Routen
│   │   ├── admin/                # Admin-Bereich
│   │   │   ├── seasons/          # Saison-Verwaltung (komplexe Sub-Routes)
│   │   │   ├── billing/          # Abrechnung
│   │   │   ├── courts/           # Plätze
│   │   │   ├── members/          # Mitglieder
│   │   │   └── [id]/             # Detail-Pages
│   │   ├── trainer/              # Trainer-Dashboard
│   │   ├── member/               # Member-Dashboard
│   │   ├── superadmin/           # Superadmin
│   │   └── billing/              # Member-Billing
│   ├── api/                      # 213 API-Routes
│   │   ├── auth/                 # Login/Logout/Register
│   │   ├── admin/                # Admin-Endpoints
│   │   ├── billing/              # Invoices, Payments, Subscriptions
│   │   ├── bookings/             # Court-Bookings
│   │   ├── cron/                 # Scheduled-Jobs
│   │   └── webhooks/             # Stripe, GitHub
│   ├── layout.tsx                # Root-Layout
│   ├── providers.tsx             # Client-Provider-Wrapper
│   └── globals.css               # Global-Styles
│
├── components/                   # React-Komponenten
│   ├── ui/                       # 49 shadcn-Komponenten
│   ├── layout/                   # Header, Sidebar, Footer
│   ├── admin/                    # Admin-spezifische Komponenten
│   ├── billing/                  # Billing-Dialogs
│   ├── bookings/                 # Booking-Listen
│   ├── feedback/                 # Feedback-Forms
│   ├── ai/                       # AI-Matchmaking
│   └── [feature]/                # Feature-spezifische Komponenten
│
├── lib/                          # Domain-Logic + Utilities
│   ├── auth.ts, auth-common.ts   # Auth-Helpers
│   ├── admin-context.ts          # Admin-Context (requireAdminClub)
│   ├── api-auth.ts               # API-Auth-Guard
│   ├── billing/                  # Billing-Domain
│   ├── booking/                  # Booking-Domain
│   ├── season-planning/          # Saisonplanung-Clustering-Engine
│   ├── perf-history/             # Performance-History
│   ├── court-calendar-utils.ts   # Shared-Calendar-Utils
│   └── csv/, pagination/        # Utilities
│
├── src/                          # Domain-Driven-Design-Layering
│   ├── domain/                   # Domain-Entities + Business-Rules
│   ├── application/              # Use-Cases
│   └── infrastructure/persistence/
│       └── repositories/         # Drizzle-Repositories (member, trainer, booking, ...)
│
├── hooks/                        # React-Hooks
│   ├── use-courts.ts, use-sessions.ts
│   ├── use-user-data.ts, use-club-features.ts
│   └── [feature]-hooks.ts
│
├── supabase/                     # DB-Migrations + Config
│   └── migrations/               # 82 SQL-Dateien
│
├── scripts/                      # Maintenance + Seed-Scripts
│   ├── seed-test-club-rheinland.ts
│   ├── seed-e2e-flow.ts
│   ├── check-db.ts, apply-migration.ts
│   └── gen-supabase-types.sh
│
├── e2e/                          # 4 Playwright-E2E-Tests
├── src/__tests__/                # 46 Vitest-Unit-Tests
│
├── docs/                         # Design-Documents
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md, CLUSTERING_API.md
│   ├── SECURITY, RBAC, PERFORMANCE
│   └── [weitere]
│
├── logs/                         # Audit + RBAC + Nav-Logs
├── types.ts                      # Globale TypeScript-Types
├── supabase-types.ts             # Generierte Supabase-Types
├── design-tokens.json            # Design-System
└── [config files]                # next.config.js, tsconfig.json, etc.
```

### 2.1 Wichtige Sub-Strukturen

**`app/(protected)/admin/seasons/[id]/`:**

- `page.tsx` — Detail-Page
- `planning/` — Saisonplanung-Wizard
- `plan/page.tsx` + `plan-list-client.tsx` — Plan-Liste
- `season-plan/[id]/page.tsx` + `season-plan-grid-client.tsx` — Stundenplan-Grid

**`lib/season-planning/`:**

- `clustering-engine.ts` (~600 Zeilen) — KI-Clustering für Saison-Planung
- `conflict-detector.ts` — Konflikt-Erkennung
- `season-calendar.service.ts` — Kalender-Logic
- `ai-analysis.ts` — AI-Insights

**`src/infrastructure/persistence/repositories/`:**

- `member-repository.ts`, `trainer-repository.ts`
- `booking-repository.ts`, `court-repository.ts`
- `billing-repository.ts`, `audit-repository.ts`

---

## 3. Authentifizierung & RBAC

### 3.1 Rollen

Definiert in `user_club_memberships.role`:

- **`superadmin`** — Plattform-weiter Zugriff, alle Vereine
- **`admin`** — Vollzugriff auf einen Verein
- **`trainer`** — Trainer-spezifisches Dashboard
- **`member`** — Standard-Mitglied

### 3.2 Auth-Helpers (`lib/`)

| Datei                  | Funktion                               | Verwendung                                          |
| ---------------------- | -------------------------------------- | --------------------------------------------------- |
| `lib/auth.ts`          | `requireAuth()`                        | Server-Components + Layouts                         |
| `lib/api-auth.ts`      | `requireAuth()` (NextRequest-Variante) | API-Routes                                          |
| `lib/auth-common.ts`   | Shared-Types                           | —                                                   |
| `lib/admin-context.ts` | `requireAdminClub()`                   | Admin-Pages, gibt `{ clubId, isSuperadmin }` zurück |
| `lib/permissions.ts`   | Permission-Checks                      | RBAC                                                |

### 3.3 Session-Management

- **Cookies:** `sb-*-auth-token` (von Supabase SSR)
- **Middleware:** `proxy.ts` (oder `middleware.ts` — siehe Pfad-Variante je nach Env)
- **Client-Side:** `createClient()` aus `@/infrastructure/external/supabase/client`
- **Server-Side:** `createClient()` aus `@/infrastructure/external/supabase/server`

### 3.4 RLS (Row-Level-Security)

Jede Tabelle hat RLS-Policies:

- `users` — User sieht nur eigene Daten
- `user_club_memberships` — Club-Membership-basiert
- `invoices`, `payments` — Club-Scoped
- `bookings`, `sessions` — Club-Scoped + Owner-basierend
- `trainer_profiles` — Club-Scoped
- `seasons` — Club-Scoped

### 3.5 Feature-Flags

`hooks/use-club-features.ts` — basierend auf `club.feature_flags` JSON-Spalte:

- `members`, `trainers`, `seasons`, `finance`, `shop`, `tournaments`, `trial_training`, `ai_matchmaking`

Sidebar blendet Sections basierend auf Flags aus (z.B. `Shop` nur wenn `shop` aktiv).

---

## 4. Datenbank-Schema

### 4.1 Übersicht

- **23 Haupttabellen** + mehrere Join-Tabellen
- **82 SQL-Migrations** in `supabase/migrations/`
- **PostgreSQL 15** (lokal via Docker)
- **Drizzle ORM** als TypeScript-Layer
- **Schema-Pfad:** `src/infrastructure/persistence/schema.ts`

### 4.2 Wichtige Tabellen (Top 15)

| Tabelle                                        | Zweck                       | Key-Fields                                                                               |
| ---------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| `users`                                        | Auth-User + Profile         | `id`, `email`, `full_name`, `phone`, `subscription_tier`, `subscription_status`          |
| `clubs`                                        | Tennis-Vereine (Tenants)    | `id`, `name`, `feature_flags`, `default_hourly_rate`                                     |
| `user_club_memberships`                        | User ↔ Club + Role          | `user_id`, `club_id`, `role`, `is_active`, `include_in_planning`                         |
| `seasons`                                      | Planungs-Saisons            | `id`, `club_id`, `name`, `start_date`, `end_date`, `planning_status`                     |
| `season_planning_configs`                      | Saison-Parameter            | `season_id`, `max_niveau_span_*`, `group_*_size`, `unassigned_rate_threshold`            |
| `season_group_weeks`                           | Wochen-Pläne pro Gruppe     | `season_id`, `group_id`, `week_number`                                                   |
| `season_plan_entries`                          | Konkrete Trainings-Sessions | `group_id`, `trainer_id`, `court_id`, `day_of_week`, `start_time`                        |
| `trainer_profiles`                             | Trainer-Stammdaten          | `user_id`, `first/last_name`, `bio`, `hourly_rate`, `status`                             |
| `trainer_qualifications`                       | Zertifikate                 | `trainer_id`, `name`, `issuer`, `verified`                                               |
| `trainer_specializations`                      | Spezialisierungen           | `trainer_id`, `name`, `level`                                                            |
| `trainer_availability`                         | Verfügbarkeits-Slots        | `trainer_id`, `date` oder `day_of_week`, `start/end_time`                                |
| `trainer_absences`                             | Abwesenheiten               | `trainer_id`, `club_id`, `start/end_date`, `reason`                                      |
| `courts` + `court_types`                       | Platz-Definitionen          | `club_id`, `name`, `surface_type`, `is_indoor/outdoor`                                   |
| `sessions`                                     | Konkrete Buchungs-Slots     | `court_id`, `trainer_id`, `start/end_time`, `session_type`                               |
| `bookings`                                     | Member-Buchungen            | `member_id`, `session_id`, `status`                                                      |
| `invoices`                                     | Rechnungen                  | `club_id`, `member_id`, `amount`, `paid_amount`, `status`, `invoice_type`                |
| `payments`                                     | Zahlungen                   | `club_id`, `member_id`, `amount`, `payment_method`                                       |
| `fee_configurations`                           | Gebühren-Kategorien         | `club_id`, `name`, `type` (membership/training/court/dunning), `amount`, `billing_cycle` |
| `news_posts`                                   | News & Updates              | `club_id`, `title`, `content`, `is_pinned`, `published_at`                               |
| `audit_logs`                                   | Audit-Trail                 | `club_id`, `user_id`, `action`, `entity_type`                                            |
| `attendance_records`                           | Anwesenheits-Tracking       | `member_id`, `session_id`, `status`                                                      |
| `season_member_preferences`                    | Mitglieder-Wünsche          | `season_id`, `member_id`, `preferred_days`, `preferred_times`                            |
| `coupons`                                      | Gutscheine                  | `club_id`, `code`, `discount_pct`                                                        |
| `court_bookings` (verschmolzen mit `sessions`) | —                           | —                                                                                        |

### 4.3 Wichtige RLS-Policies

- **Club-Scoped Reads:** User sieht nur Daten seines Vereins (via `club_id` in `user_club_memberships`)
- **Admin-Writes:** Nur `admin` oder `superadmin` darf Schreibrechte auf Club-Daten
- **Owner-Writes:** Member kann eigene `bookings`, `season_member_preferences` schreiben
- **Public-Reads:** `news_posts` sind vereins-öffentlich innerhalb des Clubs

### 4.4 Letzte Migrations (Juni 2026)

- `20260624_add_hours_logs_rejection_reason.sql`
- `20260622_overdue_invoice_cron.sql`
- `20260610_add_unassigned_rate_threshold.sql` (pending in Working-Tree)
- `20260608_deploy_billing_triggers.sql`
- `20260608_backfill_invoice_member_id.sql`
- (weitere ~75 vor Juni 2026)

### 4.5 Triggers + Functions

- `auto_generate_invoice_on_season_publish` — Erstellt Rechnungen bei Saison-Veröffentlichung
- `mark_invoice_overdue` — Setzt Status nach Fälligkeit
- `notify_trainer_on_booking` — Benachrichtigt Trainer bei Buchung

---

## 5. API-Inventar (213 Routes)

### 5.1 Verteilung

| Kategorie                | Anzahl (geschätzt) | Zweck                                                   |
| ------------------------ | ------------------ | ------------------------------------------------------- |
| **Auth**                 | ~5                 | login, logout, register, refresh, session               |
| **Admin**                | ~40                | Club-Verwaltung, Approvals, Bookings, Members, Sessions |
| **Billing**              | ~25                | Invoices, Payments, Subscriptions, Import, Export, Cron |
| **Booking/Sessions**     | ~15                | Court-Bookings, Block, Cancel, Direct                   |
| **Seasons**              | ~12                | CRUD, Planning, Plan-Entries, Conflicts, Calendar       |
| **Trainers**             | ~10                | Profile, Availability, Absences, Qualifications         |
| **Members**              | ~10                | CRUD, Planning-Include, Onboarding                      |
| **Courts + Court-Types** | ~8                 | CRUD, Calendar                                          |
| **News**                 | ~5                 | CRUD                                                    |
| **Shop**                 | ~15                | Products, Orders, Cart                                  |
| **Analytics**            | ~8                 | Reports, Dashboards                                     |
| **Cron**                 | ~3                 | billing-overdue, backup, planning                       |
| **Webhooks**             | ~3                 | Stripe, GitHub                                          |
| **Admin/System**         | ~20                | Audit-Logs, Settings, Search, Debug, Health, Backup     |
| **Sonstige**             | ~34                | Drizzle, Emails, Notifications, etc.                    |

**Gesamt: 213 Route-Handler**

### 5.2 HTTP-Methoden

- **GET** — Daten abrufen (häufigste)
- **POST** — Aktionen auslösen / Create
- **PATCH** — Teil-Updates (z.B. Status-Änderungen)
- **PUT** — Vollständige Updates (selten)
- **DELETE** — Löschen

### 5.3 Beispiel-Komplexe Routes

- `app/api/billing/invoices/create` — POST mit Multi-Item-Support
- `app/api/billing/payments/import` — POST Multipart-Form (CSV-Upload)
- `app/api/seasons/[id]/plan-entries` — GET mit Club-Filter
- `app/api/admin/perf-history/local` — GET mit Rate-Limit
- `app/api/trainer-availability` — POST mit day_of_week ODER date
- `app/api/billing/generate-invoices` — POST Cron-style Batch-Operation
- `app/api/admin/billing/invoices` — GET mit Pagination + Type-Filter

### 5.4 Auth-Pattern

Jede API-Route startet typischerweise mit:

```ts
const auth = await requireAuth();
const { supabase, user } = auth;
// ... role-checks, RLS enforced via supabase
```

Admin-Routes zusätzlich:

```ts
const { clubId } = await requireAdminClub();
```

---

## 6. Feature-Subsysteme

### 6.1 Saisonplanung (Kern-Feature)

**`lib/season-planning/`:**

- `clustering-engine.ts` (~600 Zeilen) — KI-Algorithmus:
  - Adaptive Backtrack-Tiefe (Sprint 4 P0 #1)
  - Decoupled `maxRetries` und `depth`
  - Cached Slot-Availability-Check (`buildSlotAvailabilityCaches`)
  - 46 Unit-Tests in `src/__tests__/lib/clustering-engine.test.ts`
- `conflict-detector.ts` — Erkennt Trainer-/Court-/Member-Konflikte
- `season-calendar.service.ts` — Kalender-Logik für Saison-Visualisierung
- `ai-analysis.ts` — AI-Insights (z.B. "Welche Gruppen haben die meisten Konflikte?")

**UI-Flows:**

- `app/(protected)/admin/seasons/[id]/planning/` — Saison-Planungs-Wizard (mehrstufig)
- `app/(protected)/admin/seasons/[id]/plan/page.tsx` — Plan-Liste (Member-Verwaltungs-Stil)
- `app/(protected)/admin/season-plan/[id]/page.tsx` — Stundenplan-Grid (Mo–So × 07:00–22:00)

**DB-Schema:**

- `seasons` (Master-Record)
- `season_member_preferences` (Mitglieder-Wünsche)
- `season_planning_configs` (Parameter: max_niveau_span, group_min/max_size, unassigned_rate_threshold, ...)
- `season_group_weeks` (Wochen-Pläne)
- `season_plan_entries` (konkrete Sessions)

### 6.2 Billing (Abrechnung)

**`lib/billing/`:**

- Invoice-Engine (line-items, tax-calc, status-state-machine)
- Payment-Import (CSV mit Validierung)
- Dunning-Logic (Mahnstufen, overdue-Cron)
- SEPA-Mandate-Management
- Stripe-Subscription-Tiers (free/pro/enterprise)

**UI:**

- `app/(protected)/admin/billing/` — Admin (Rechnungen, Kategorien, Abo-Zuweisung)
- `app/(protected)/billing/page.tsx` — Member (eigene Rechnungen ansehen + PDF)

**Invoice-Lifecycle:**
`draft` → `open` → `sent` → `partially_paid`/`paid` → `overdue` → `dunning` → `cancelled`/`uncollectible`

### 6.3 Trainer-Management

**UI:** `components/trainer-profile-management.tsx` (1902 Zeilen — aktuell Split-View, Refactor zu Full-Width-Table + separate Detail-Page in Arbeit)

**4 Tabs auf der Trainer-Detail-Seite:**

1. **Profil** — Persönliche Daten, Notfallkontakt, Sprachen
2. **Qualifikationen** — Zertifikate (verifiziert/ausstehend), Spezialisierungen
3. **Erfahrung** — Jahre, vorherige Vereine, Erfolge
4. **Verfügbarkeit** — Wöchentliche Slots + konkrete Slots + Abwesenheiten

**3 CenteredModals auf der Detail-Seite:**

- Weekly-Slot hinzufügen
- Konkreter-Slot hinzufügen
- Abwesenheit eintragen

### 6.4 Member-Management

**UI:** `app/(protected)/admin/members/members-client.tsx` (Full-Width-Table mit `<Link>` Detail-Button — Referenz-Pattern für Trainer-Refactor)

**Detail-Page:** `app/(protected)/admin/members/[id]/page.tsx` + `members-detail-client.tsx`

**Features:**

- `include_in_planning` Toggle (Member in Saisonplanung ein-/ausbeziehen)
- `is_active` Toggle (aktivieren/deaktivieren)
- Bulk-Actions (geplant)
- CSV-Export

### 6.5 Court-Booking + Kalender

**`components/unified-court-calendar.tsx`** — Wochen-/Tages-/Listen-Ansicht der Plätze

**Features:**

- Drag-and-Drop (Admin: Sessions verschieben)
- Block-Slot-Dialog (Event / Maintenance)
- Direct-Booking (Walk-in)
- Session-Type: walk-in, event, maintenance
- Saisonplan-Entries als farbcodierte Layer

**Calendar-Utils:** `lib/court-calendar-utils.ts` (shared)

### 6.6 News & Updates

**`components/news-announcements.tsx`** + `app/(protected)/news/page.tsx`

**Features:**

- Compose-Modal (Admin) — Commit `e84937f` migriert zu `<CenteredModal>` + Portal-Fix `d8f338e`
- Filter (alle/angepinnt/last 7 days + Type-Filter)
- Stats (Gesamt, Angepinnt, Dringend, Diese Woche)
- CRUD (nur Admin)

### 6.7 Performance-History (Admin)

**`app/api/admin/perf-history/local/route.ts`** + `app/api/admin/perf-history/github/route.ts`

**Features:**

- Lokale Benchmarks (`swingz bench`)
- GitHub Actions Re-Run-Daten (über `lib/perf-history/github-source.ts`)
- Recharts-Visualisierung (`components/admin/perf-history-chart.tsx`)
- Sidebar-Link in `admin/audit-logs` Sektion
- Rate-Limit: `RATE_LIMITS.STANDARD` (nicht String-Literal — Fix aus Sprint 4)

### 6.8 AI-Matchmaking

**`lib/ai/schedule-generator-v2.ts`**

- Generiert Spiel-Vorschläge basierend auf Skill-Level + Verfügbarkeit
- Admin-Tool: `app/(protected)/admin/ai/matchmaking/`

### 6.9 Shop (optional, Feature-Flag)

**`app/(protected)/shop/`** + `app/(protected)/meine-bestellungen/`

**Features:**

- Produkte, Cart, Bestellungen
- PDF-Receipts
- Gutscheine (`coupons`-Tabelle)

### 6.10 Feedback

**`components/feedback/feedback-modal.tsx`** — Member gibt Feedback zu Trainer/Session

- Migriert zu `<CenteredModal>` (Commit im Sprint 4)

---

## 7. UI-Komponenten & Design-System

### 7.1 shadcn/ui-Bibliothek (49 Komponenten)

`components/ui/`:

- `button`, `card`, `input`, `label`, `textarea`, `select`
- `dialog`, `alert-dialog`, `sheet`, `popover`, `tooltip`
- `dropdown-menu`, `context-menu`, `command`
- `tabs`, `accordion`, `collapsible`
- `table`, `data-table`
- `form`, `checkbox`, `radio-group`, `switch`, `slider`
- `calendar`, `date-picker`, `date-range-picker`
- `avatar`, `badge`, `skeleton`
- `toast` (sonner), `alert`
- `pagination-nav`, `scroll-area`
- `separator`, `aspect-ratio`
- **`centered-modal.tsx`** — **Canonical-Modal-Wrapper (Commit `0d21ca9`)**
- **`dialog.tsx`** — shadcn-Dialog-Primitive (im Auslaufen, ersetzt durch CenteredModal)
- `theme-toggle`, `icon-box`, `loading-button`, `error-boundary`
- `status-badge`, `pagination`

### 7.2 CenteredModal — Der kanonische Modal-Wrapper

**Commit `0d21ca9`** + Portal-Fix in **`d8f338e`**

**Features:**

- Viewport-Centering via `min-h-screen flex items-center justify-center p-4`
- `max-h-[90vh] overflow-y-auto sm:max-h-[85vh]` für interne Scroll
- Body-Scroll-Lock (verhindert Hintergrund-Scrollen)
- Escape-Key-Handler
- Overlay-Click schließt
- **createPortal(content, document.body)** — vermeidet Containing-Block-Probleme
- A11y: `role="dialog"`, `aria-modal="true"`, `aria-label`, `tabIndex={-1}`
- SSR-sicher (`typeof document === 'undefined'` Guard)

**Migration-Status (Sprint 4):**

- ✅ `confirm-dialog`, `feedback-modal`, `keyboard-shortcuts-dialog`, `payment-import-dialog`, `create-invoice-dialog`, `news-announcements`
- ❌ 7 verbleibende: `court-bookings-list`, `unified-court-calendar`, `seasons/[id]`, `court-types ×2`, `billing-client ×2`

### 7.3 Design-Tokens

**`design-tokens.json` v2.0.0:**

- **Primary:** Deep Forest Green (#1B4332)
- **Secondary:** Midnight Navy
- **Accent:** Sunrise Orange
- **Mode:** Dark + Light
- **Font:** DM Sans (body) + JetBrains Mono (code) + Clash Display (headings via Fontshare)

**Sync:** Manuell zwischen `styles/theme.ts`, `tailwind.config.ts`, `app/globals.css` (über `scripts/generate-design-tokens.ts`)

### 7.4 Layout-Pattern

- **Admin/Superadmin:** Left Sidebar (`components/layout/sidebar.tsx`) + Header
- **Trainer/Member:** Kein Sidebar, persistent Mobile-Bottom-Nav
- **Mobile-First:** Tailwind responsive (`sm:`, `md:`, `lg:`, `xl:`)
- **Glassmorphism:** `backdrop-blur-2xl`, `bg-background/70` auf Header

---

## 8. Testing-Infrastruktur

### 8.1 Vitest (Unit-Tests)

- **46 Test-Files** in `src/__tests__/`
- **Coverage-Schwellen:** 60% lines/statements, 55% branches
- **Setup:** `react-swc` Compiler, `jsdom` Environment
- **Path-Aliases:** Vollständige DDD-Struktur (`src/domain`, `src/application`, ...)
- **Mocking:** TanStack Query, Supabase Client, Next.js Router

**Wichtige Test-Suites:**

- `src/__tests__/lib/clustering-engine.test.ts` — 46 Tests für Saison-Planung
- `src/__tests__/api/confirm-publish-rate-limit.test.ts` — Rate-Limit-Tests
- `src/__tests__/api/*` — API-Route-Tests
- `src/__tests__/use-cases/*` — Application-Layer-Tests
- `src/__tests__/integration/*` — End-to-End-Integration

**Bekannte Issues:**

- 3 pre-existing Test-Failures in `findBestTimeSlot` (stale Mocks) — aus Sprint 4 P0 #1
- Null-Cache-Fallback wurde in Commit `?` hinzugefügt, aber noch nicht verifiziert

### 8.2 Playwright (E2E-Tests)

- **4 E2E-Files** in `e2e/`
- **5 Browser-Projekte:** chromium, firefox, webkit, mobile-chrome, mobile-safari
- **Midscene AI:** Natural-Language UI-Interaktion
- **Test-Fixtures:** `admin@tc-perftest.de / TestAdmin2026!` (lokal Docker)

**Wichtige E2E-Flows:**

- `e2e/admin-season-wizard.test.ts` — Saison-Planungs-Wizard (10 min/Phase)
- `e2e/member-lifecycle.test.ts` — Member-Lifecycle (5 min)
- `e2e/season-planning-backtracking.test.ts`
- (1 weitere)

### 8.3 Test-Commands

```bash
npm run typecheck         # TypeScript-Fehler-Check
npm run lint              # ESLint
npx vitest run            # Alle Unit-Tests
npx playwright test       # Alle E2E-Tests
npm run test:coverage     # Coverage-Report
```

---

## 9. DevOps & Deployment

### 9.1 Hosting

- **Vercel** als Production-Hosting
- **Supabase** (qeckztuzeymuwwtyoryi.supabase.co) als managed Postgres + Auth
- **Docker** nur lokal für Test-Postgres (`docker-compose.test.yml` Port 54323)

### 9.2 Cron-Jobs (Vercel)

`vercel.json`:

- `/api/cron/billing-overdue` — Markiert überfällige Rechnungen
- `/api/cron/backup` — DB-Backup (Supabase)

### 9.3 Error-Tracking (Sentry)

- `sentry.client.config.ts` + `sentry.server.config.ts`
- **Postgres-Integration:** `Sentry.postgresIntegration()` für DB-Query-Tracing
- **Sampling:** 10% in Production, 100% in Development
- **DSN:** über `NEXT_PUBLIC_SENTRY_DSN`

### 9.4 CI/CD

- **Husky** Git-Hooks (pre-commit: Lint + Typecheck)
- **Vercel Auto-Deploy** bei `git push origin main`
- **Migrations:** Manuell via `node scripts/apply-migration.ts` + `NOTIFY pgrst, 'reload schema'`

### 9.5 Environment-Variablen

- `.env.example` — Template
- `.env.local` — Local-Dev (nicht in Git)
- `.env.test.example` — Test-Setup
- Wichtige Vars: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*`, `SENTRY_DSN`, `GITHUB_TOKEN`, `GITHUB_REPOSITORY`

### 9.6 Deployment-Status

- **Production:** Live auf Vercel + Supabase
- **Letzte Deploys:** Modal-Centering-Fix, Saisonplanung-Fixes, Perf-History-Dashboard, Trainer-Tabelle-Refactor
- **Performance-History-Dashboard:** GitHub-Actions-Re-Run-Integration aktiv

---

## 10. Performance & Optimierungen

### 10.1 Sprint 4 Highlights

- **Clustering-Engine Adaptive-Backtrack** (Commit `6fdf6e7`):
  - `maxRetries` und `depth` entkoppelt
  - 5 neue Unit-Tests
  - Bench-Script für lokale Performance-Messung
- **Perf-History-Dashboard** (Commit `a83076a`):
  - Lokale Benchmarks + GitHub-Actions-Re-Run-Daten
  - Recharts-Visualisierung
  - API + Sidebar-Link
- **4 Typecheck-Fehler behoben** (Commit `5501cee`):
  - `RATE_LIMITS.STANDARD` statt String-Literal
  - `_cachedTimeSlotKeys` entfernt
  - `ClusteringConfig` exportiert
  - `unassignedRateThreshold` in Test-Mock
- **Modal-Centering** (Commits `a163698`, `0d21ca9`, `e84937f`, `d8f338e`):
  - `max-h-[90vh] overflow-y-auto` auf shadcn DialogContent
  - CenteredModal als kanonischer Wrapper
  - Migration von 6/12 `<DialogContent>`-Instanzen
  - **Portal-Fix** (createPortal → document.body) eliminiert Containing-Block-Probleme

### 10.2 Weitere Optimierungen

- **Seasonal Caching:** Saison-Planung-Cluster cached Slot-Availability
- **Web-Workers:** für rechenintensive Operationen (geplant)
- **Code-Splitting:** Next.js Dynamic Imports für Billing-Dialogs
- **Edge-Caching:** Vercel-Edge für statische Routes
- **Bundle-Analyzer:** `npm run analyze` zeigt Bundle-Größen

---

## 11. Working-Tree & Offene Tasks

### 11.1 Working-Tree-Status (uncommitted)

```bash
$ git status --short
 M components/billing/create-invoice-dialog.tsx      # CenteredModal-Migration pending
 M components/billing/payment-import-dialog.tsx      # CenteredModal-Migration pending
?? supabase/migrations/20260610_add_unassigned_rate_threshold.sql  # Neue Migration
```

**3 Dateien** aus dem Working-Tree müssen noch als separate Commits eingecheckt werden.

### 11.2 Offene Tasks (Priorisiert)

| #   | Task                                                                                                                                                                      | Priorität | Aufwand | Impact                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------- | ---------------------------------------------- |
| 1   | **Trainer-Detail-Refactor** (Split-View → Full-Width-Table + separate Route)                                                                                              | Hoch      | ~60 min | Hoch (UX-Konsistenz mit Members-Page)          |
| 2   | **7 restliche `<DialogContent>`-Migrationen** zu `<CenteredModal>` (court-bookings-list, unified-court-calendar, seasons/[id], court-types ×2, billing-client ×2)         | Mittel    | ~45 min | Mittel (profitiert automatisch vom Portal-Fix) |
| 3   | **6 raw-overlay Modale** auf `<CenteredModal>` migrieren (loading-spinner, admin-trial-approvals, shop/page, hours-logs-client ×2, meine-bestellungen)                    | Niedrig   | ~20 min | Polish                                         |
| 4   | **unassignedRateThreshold-Finalisierung** (Drizzle-Schema + loadConfig + Test-Mock + Drizzle-Schema-Update in `src/infrastructure/persistence/season-planning-schema.ts`) | Mittel    | ~20 min | Mittel (Sprint-4-Tech-Debt)                    |
| 5   | **3 pre-existing findBestTimeSlot-Test-Failures** fixen (stale Mocks)                                                                                                     | Mittel    | ~30 min | Mittel (CI-Quality)                            |
| 6   | **E2E-Regression-Test** für Modal-Centering (Playwright)                                                                                                                  | Niedrig   | ~30 min | Niedrig                                        |
| 7   | **E2E-Saisonplanung-Tests** (Plan + Grid Route)                                                                                                                           | Niedrig   | ~30 min | Niedrig                                        |
| 8   | **Live-Browser-Test** der Modal-Fix (braucht Live-Supabase-Admin-Creds)                                                                                                   | Niedrig   | manuell | Bestätigung                                    |
| 9   | **Temp-Working-Tree aufräumen** (3 Dateien als separate Commits)                                                                                                          | Niedrig   | ~10 min | Hygiene                                        |
| 10  | **E2E-Test mit .env.test.example** + lokaler Test-DB-Setup automatisieren                                                                                                 | Niedrig   | ~60 min | DevEx                                          |

### 11.3 Trainer-Detail-Refactor — Detail-Plan

**Aktueller Zustand:**

- `app/(protected)/admin/trainers/page.tsx` (3 Zeilen) → `<TrainerProfileManagement clubId={clubId} />`
- `components/trainer-profile-management.tsx` (1902 Zeilen) mit Split-View: links Liste (440px), rechts Side-Panel mit 4 Tabs + 3 Modals + 12 Detail-Handlern

**Ziel-Zustand:**

- `app/(protected)/admin/trainers/page.tsx` (unverändert) → `<TrainerProfileManagement clubId={clubId} />`
- `components/trainer-profile-management.tsx` (~200 Zeilen) — nur Liste + Filter + Full-Width-Table + Link-Button + Invite-Modal
- `app/(protected)/admin/trainers/[id]/page.tsx` (~30 Zeilen) — Server-Page mit `requireAdminClub` + Trainer-Fetch + `<TrainerDetailClient initialTrainer={...} clubId={...} />`
- `app/(protected)/admin/trainers/[id]/trainer-detail-client.tsx` (~1700 Zeilen) — 1:1 Extraktion des Side-Panels mit allen 4 Tabs, 3 CenteredModals, allen Handlern

**Members-Referenz-Pattern:**

- `app/(protected)/admin/members/members-client.tsx` — Full-Width-Table mit `<Link href={`/admin/members/${member.id}`}>` als `<Eye>`-Icon-Button
- `app/(protected)/admin/members/[id]/page.tsx` — Server-Page mit `requireAuth` + Club-Membership-Check + `MembersDetailClient`

### 11.4 Bekannte Issues

- **chrome-devtools\_\_fill_form Schema-Bug** in browser-use-Agent — verhindert automatisierte Login-Tests
- **Live-Supabase-Login fehlgeschlagen** in vorherigen Browser-Tests — benötigt gültige Creds
- **str_replace-Fragilität** bei großen Dateien (z.B. trainer-profile-management.tsx) — write_file bevorzugt
- **Trainer-Detail-Refactor** mehrfach angefordert, aber noch nicht durchgeführt

---

## 12. Recent Commits (Highlights)

| Commit                             | Beschreibung                                                                                                          | Datum     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- |
| `472e002`                          | fix(labels): clarify confusing billing/subscription nav labels                                                        | aktuell   |
| `d8f338e`                          | fix(modal): render CenteredModal via createPortal into document.body                                                  | Sprint 4  |
| `e84937f`                          | fix(news): migrate compose modal to CenteredModal                                                                     | Sprint 4  |
| `5501cee`                          | fix(types): resolve 4 typecheck errors (RATE_LIMITS, \_cachedTimeSlotKeys, ClusteringConfig, unassignedRateThreshold) | Sprint 4  |
| `50d6537`                          | fix(saisonplanung): 2 user-reported 404s + deploy season_group_weeks migration                                        | Sprint 4  |
| `a83076a`                          | feat(perf-history): local + GitHub Recharts dashboard                                                                 | Sprint 4  |
| `98c9049`                          | refactor(trainers): replace Card-Grid with shadcn Table                                                               | Sprint 4  |
| `6fdf6e7`                          | feat(season-planning): Sprint 4 P0 #3 Adaptive Backtrack + 5 unit tests                                               | Sprint 4  |
| `0d21ca9`                          | feat(modal): create CenteredModal canonical wrapper                                                                   | Sprint 4  |
| `a163698`                          | fix(modal): DialogContent max-h-[90vh] + overflow-y-auto                                                              | Sprint 4  |
| (weitere ~20 Commits vor Sprint 4) | Billing-Features, Auth-Fixes, Sentry-Setup, ...                                                                       | 2025-2026 |

---

## Anhang: Quick-Reference

### Wichtige Scripts

```bash
# Development
npm run dev               # Next.js Dev-Server mit Turbopack
npm run typecheck         # tsc --noEmit
npm run lint              # ESLint
npm run build             # Production-Build

# Database
node scripts/apply-migration.ts <migration-file>   # Migration deployen
node -e "..."                                      # NOTIFY pgrst manuell

# Seeding
npx tsx scripts/seed-test-club-rheinland.ts
npx tsx scripts/seed-e2e-flow.ts
npx tsx scripts/seed-squash-club-munich.ts
npx tsx scripts/seed-workflow-test.ts

# Testing
npx vitest run                                    # Unit-Tests
npx vitest run src/__tests__/lib/clustering-engine.test.ts
npx playwright test                               # E2E-Tests
npm run test:coverage                             # Coverage-Report

# Performance
npx tsx scripts/bench-clustering.ts                # Clustering-Benchmark
npm run analyze                                   # Bundle-Analyzer
```

### Wichtige URLs (Production)

- **Frontend:** https://swingz.app (Vercel)
- **Supabase:** https://qeckztuzeymuwwtyoryi.supabase.co
- **Sentry-Dashboard:** (intern)
- **Vercel-Dashboard:** (intern)

### Wichtige Test-Credentials (lokal)

- **Superadmin:** `superadmin@swingz.com` / `SuperadminPass123!` (siehe `TEST-CREDENTIALS.md`)
- **Admin TC Rheinland:** `admin@tc-rheinland.de` / `TestAdmin2026!`
- **Trainer TC Rheinland:** `trainer.1@tc-rheinland.de` / `Trainer2026!`
- **Member TC Rheinland:** `member@swingz.com` / `MemberPass123!`

### Wichtige Docs (im Repo)

- `DESIGN.md` — Design-System
- `ARCHITECTURE.md` — Architektur-Übersicht
- `CLUSTERING_API.md` — Saisonplanung-Clustering-API
- `SECURITY_AUDIT_*` — Security-Audits
- `ROLE-MANAGEMENT.md` — RBAC-Dokumentation
- `PERFORMANCE_OPTIMIZATIONS.md` — Performance-Historie
- `ROUTING.md` — Routing-Konventionen

---

_Letzte Aktualisierung: 2026-06-10 durch Buffy (Codebuff AI Agent)_
