# SwingZ — Project Instructions

@AGENTS.md

> Automatisch bei jedem Session-Start geladen. Nur Dinge die NICHT aus dem Code offensichtlich sind.
> Zuletzt verifiziert: 13. September 2026 (Rollen-Hierarchie und Tarife gegen Code geprüft;
> Datenzugriffsmuster ADR-005 ergänzt)
> Doku-Governance-Regeln (welche Datei wohin, wann updaten statt neu anlegen): siehe `AGENTS.md`.

---

## Überblick

**SwingZ** — Tennis Club Management SaaS (Next.js 16, Supabase, Stripe, Vercel).

- Alle **UI-Texte auf Deutsch**. i18n-Infrastruktur (next-intl) vorhanden aber noch inaktiv.
- Produktionsbetrieb: https://swingz.vercel.app
- Code-Stand: ~255 API-Routes, 99 Pages, 120 Components, 102 DB-Migrationen

---

## Architektur

```
app/                    # Next.js 16 App Router
  (protected)/          # owner/, superadmin/, admin/, trainer/, member/
  (public)/             # trial-training/ (kein Login nötig)
  api/                  # API Routes (255)
  landing/              # Marketing Landing Page
components/             # React Components (shared + layout)
lib/                    # Utilities, Services, Helpers
src/
  application/          # Use Cases (Business Logic)
  domain/               # Domain Entities & Types
  infrastructure/       # DB Repos, External Services, Drizzle Schema
```

### Auth-Middleware

Die Auth-Middleware liegt in **`proxy.ts`** (nicht `middleware.ts` — Next.js 16 hat das deprecated).

```ts
// Seiten: requireAuth() aus @/lib/auth.ts
// API-Routes: withApiAuth() + verifyRole() aus @/lib/api-auth.ts
// Admin+Club: requireAdminClub() aus @/lib/admin-context.ts
// Admin-Club-Cookie: ADMIN_CLUB_COOKIE aus @/lib/cookies.ts
```

### Supabase Clients — 3 Varianten, richtige wählen!

| Client                           | Import                                               | Wann                                           |
| -------------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| Server (User-Kontext, RLS aktiv) | `createClient()` aus `@/lib/supabase/server`         | Server Components, API Routes                  |
| Service (bypasses RLS)           | `createServiceClient()` aus `@/lib/supabase/service` | Notifications, Admin-Operationen, Public Stats |
| Browser                          | `createClient()` aus `@/lib/supabase/client`         | Client Components                              |

> ⚠️ Direkte Drizzle/postgres-js Verbindungen (Port 5432) **schlagen aus der Dev-Umgebung fehl** — Supabase sperrt Port 5432 extern. Stattdessen Supabase REST via Service-Client verwenden.

### Datenzugriff in API-Routes (ADR-005)

Grund: `docs/ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md`. Rund die Hälfte der API
umging RLS und verließ sich auf Anwendungscode für die Mandantentrennung — zwei echte
Datenlecks im Juli waren die Folge. Neue und migrierte Domänen halten sich an dieses Muster.
Bereits migriert: Stundensätze (`app/api/hourly-rates/`), SEPA-Mandate
(`app/api/sepa-mandates/`), Zahlungseinstellungen (`app/api/payment-settings/`), Saison-Präferenzen
(`app/api/seasons/[id]/preferences/`) — je ein
Service unter `src/application/services/`, ein Repository unter
`src/infrastructure/persistence/repositories/`:

```
Route (Auth + Zod) → Service (Fachlogik) → Repository (einziger DB-Zugriff) → Postgres mit RLS
```

- Repositories bekommen ihren DB-Kontext **nur** über `@/infrastructure/db`:
  `getUserDb(auth)` (Nutzer-Token, RLS aktiv — der Normalfall) oder `systemDb(reason)`
  (Service-Client ohne RLS, nur für die Whitelist: Cron, Stripe-Webhook, Benachrichtigungen,
  Owner-Funktionen — `reason` ist Pflicht und wird geloggt).
- Kein DI-Container, kein Repository-Interface für genau eine Implementierung, kein
  Service+Adapter-Paar. Ein Service, ein Repository pro Domäne.
- Domänen-Typen kommen aus `Tables<'x'>`/`TablesInsert<'x'>`/`TablesUpdate<'x'>`
  (`@/types/supabase`), keine handgeschriebenen `rowToX`-Mapper.
- Fachliche Fehler (404, 409, …) wirft der Service als `ApiException`; die Route gibt
  `safeErrorMessage(error)` zurück, **nie** `error.message` roh (geprüft von
  `no-raw-db-errors.test.ts`).
- Ältere Domänen laufen noch über Drizzle (`src/infrastructure/persistence/db.ts`, Port 6543
  ohne TLS) oder direkten Service-Client-Zugriff in der Route — Migration Domäne für Domäne
  (Plan: Archiv-Analyse § 6).

### UI

- **shadcn/ui** aus `@/components/ui/` — niemals eigene Duplikate bauen
- `cn()` aus `@/lib/utils` für conditional classNames
- Dark Mode immer mitdenken (beide Themes testen)

---

## Rollen & Business Rules

Vollständige Regeln: `docs/BUSINESS_RULES.md`

### Hierarchie

```
owner  →  superadmin  →  admin  →  trainer  →  member
```

| Rolle        | Dashboard     | Besonderheit                                                    |
| ------------ | ------------- | --------------------------------------------------------------- |
| `owner`      | `/owner`      | Plattformbetreiber (Swingz GmbH). Sieht/verwaltet ALLE Vereine. |
| `superadmin` | `/superadmin` | Tennisschule-Chef. Verwaltet mehrere Vereine, Club-Switcher.    |
| `admin`      | `/admin`      | **Genau 1 Verein** — mehrere Clubs → superadmin                 |
| `trainer`    | `/trainer`    | Kann in mehreren Vereinen aktiv sein                            |
| `member`     | `/member`     | Kann in mehreren Vereinen aktiv sein                            |

**Owner-Besonderheiten:**

- Keine `club_id` in Memberships — nur die Rolle `owner`
- Sieht alle Clubs ohne Membership (Service-Client in Server Components)
- `/api/clubs` und `/api/owner/invite-admin` (Superadmin per E-Mail einladen)
- Keine autom. Admin-Membership beim Club-Erstellen (anders als Superadmin)

### Dashboard-Dispatch (`/dashboard`)

Höchste Rolle gewinnt (in dieser Reihenfolge):

1. `owner` → `/owner`
2. `superadmin` → `/superadmin`
3. `admin` → `/admin/members`
4. `trainer` → `/trainer`
5. Sonst → `/member`

Kein aktives Membership → `/member` zeigt Hinweis "Admin kontaktieren" (kein Probetraining-Formular).

### Probetraining

- Nur öffentlich unter `/trial-training` (kein Login)
- Landing Page verlinkt darauf — **nicht** im App-Login-Flow

---

## Konventionen

### Logging

```ts
const log = createLogger('module-name'); // aus @/lib/logger
log.info('msg', { key: value });
log.error('msg', error instanceof Error ? error : undefined);
// NIEMALS console.log/error/warn
```

### Imports (Reihenfolge)

1. React/Next.js
2. Third-party Packages
3. `@/components/ui`
4. `@/lib`
5. Relative Imports

Datum/Zeit-Formatierung: `de` Locale aus `@/lib/locale` (date-fns).

### Fehlerbehandlung

Graceful, benutzerfreundliche **deutsche** Fehlermeldungen. Kein Stack-Trace in der UI.

### API-Fetch (Client-Side)

`apiFetch` aus `@/lib/api-fetch` — nie nacktes `fetch()` im Client.

### Pagination

`getPagination()` + `buildPaginationMeta()` aus `@/lib/pagination`.

### Notifications

In `notifications`-Tabelle via Service-Client einfügen.

---

## Externe Services

### Stripe

- API-Version: `2026-06-24.dahlia`
- Checkout (Client, graceful — gibt `null` wenn nicht konfiguriert): `@/lib/stripe/client.ts`
- Webhooks (Server, wirft Fehler wenn nicht konfiguriert): `@/lib/stripe/stripe-client.ts`
- **Niemals** `stripe`-Package direkt importieren — immer diese Wrapper nutzen
- Tarife (`lib/plans.ts`, einzige Quelle): Starter €29, Professional €49,
  Tennisschule S €79, Tennisschule L €99 — je Monat. Tarif-Keys in der DB:
  `solo_s`, `solo_l`, `school_s`, `school_l` (`users.subscription_tier`).
- **Pflicht-Abo:** ohne `subscription_status` in `active`/`trialing` zeigt
  jede Seite unter `app/(protected)/admin/(gated)/` nur die Bezahlschranke.
- ⚠️ **Bis zum Launch abgeschaltet:** `SUBSCRIPTION_ENFORCEMENT=off` (lokal und
  in Produktion) lässt jeden Verein alles nutzen. Nur exakt `off` schaltet ab —
  Variable entfernen stellt die Schranke wieder scharf. Zurückdrehen vor dem
  Launch: `docs/OPEN_ITEMS.md` § Vor dem Launch.

### E-Mail (Resend SMTP)

- Absender: `noreply@swingz.cloud`, `info@swingz.cloud`
- Keine `@mail.swingz.cloud`-Adressen (Subdomain nicht konfiguriert)
- Supabase Auth-Mails: SMTP via Resend, Absender `noreply@swingz.cloud`

### KI — derzeit keine im Produktivpfad

- **Gemini ist am 17.09.2026 entfernt worden** (Env-Variable, Owner-Status-Kachel, Wizard-Schalter
  „KI-Optimierung", das tote Feld `useAI`). Es gab keinen Aufruf, nur die Oberfläche versprach einen.
- Die Saisonplanung clustert **regelbasiert** (`lib/season-planning/clustering-engine.ts`,
  Einstieg `app/api/seasons/[id]/planning/cluster/route.ts`) — kein LLM, kein Fremdaufruf.
- Übrig ist ein unbenutzter LLM-Pfad: `src/infrastructure/ai/ai-client.ts` (OpenAI `gpt-4o-mini`,
  `OPENAI_API_KEY`) hinter `POST /api/schedule`. Keine Oberfläche ruft die Route auf.
- `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` sind in `lib/env.ts` optional definiert.

---

## Key Files

| Datei                                             | Zweck                                                |
| ------------------------------------------------- | ---------------------------------------------------- |
| `proxy.ts`                                        | Auth-Middleware, Route-Protection, CSRF              |
| `lib/auth.ts`                                     | `requireAuth()` — Server Component Auth Guard        |
| `lib/api-auth.ts`                                 | `withApiAuth()`, `verifyRole()` — API Route Auth     |
| `lib/admin-context.ts`                            | `requireAdminClub()` — Admin + Club Kontext          |
| `lib/cookies.ts`                                  | `ADMIN_CLUB_COOKIE` — Cookie-Name für Club-Selektion |
| `lib/logger.ts`                                   | `createLogger()` — Structured Logging                |
| `lib/env.ts`                                      | Zod-validierte ENV-Variablen                         |
| `lib/format.ts`                                   | Datum/Zeit/Währung Formatter (de-DE)                 |
| `lib/api-fetch.ts`                                | Client-Side Fetch Wrapper                            |
| `lib/stripe/client.ts`                            | Stripe (graceful, für Checkout)                      |
| `lib/stripe/stripe-client.ts`                     | Stripe (strict, für Webhooks)                        |
| `lib/features.ts`                                 | Feature-Flag-Keys (JSONB in `clubs.features`)        |
| `lib/auth-common.ts`                              | `UserRole` Typ + `ROLE_HIERARCHY` + `ALL_ROLES`      |
| `src/infrastructure/persistence/schema.ts`        | Drizzle Schema (alle Tabellen)                       |
| `docs/BUSINESS_RULES.md`                          | Verbindliche Produkt- und Rollenregeln               |
| `app/(protected)/owner/layout.tsx`                | Owner-Auth-Guard                                     |
| `app/(protected)/owner/page.tsx`                  | Owner-Dashboard (KPIs via Service-Client)            |
| `app/(protected)/owner/clubs/page.tsx`            | Club-Management + Admin-Invite-Dialog                |
| `app/api/owner/invite-admin/route.ts`             | POST — Admin per Supabase-Invite einladen            |
| `supabase/migrations/20260621_add_owner_role.sql` | Migration: `is_owner()`, RLS-Policies                |

---

## Test & Build

```bash
npx tsc --noEmit          # Vor jedem Commit — muss 0 Errors geben
npx vitest run            # Unit Tests
npx playwright test       # E2E Tests
npm run test:tenant       # Mandanten-Isolation: Alpha-Admin ruft alle GET-Routen mit Gamma-IDs auf
                          # (braucht Dev-Server mit DISABLE_RATE_LIMITING=true + lokale DB)
```

`test:tenant` ist das Sicherheitsnetz vor jeder Migration einer Domäne (ADR-005). Neue Befunde
brechen ihn; `KNOWN_LEAKS` in `tests/browser/tenant-isolation-http.test.ts` bleibt leer.

Component-Tests verwenden `TestProviders` aus `src/__tests__/test-utils.tsx`.

---

## Umgebungen

Entwicklung läuft gegen den **lokalen** Supabase-Stack (`supabase start`), nicht gegen
Produktion. Aufteilung, Env-Dateien, Migrations- und Deploy-Weg, Backups:
**`docs/ENVIRONMENTS.md`** (Begründung: `docs/decisions/adr-003-datenbank-umgebungen.md`).

```bash
npm run db:status         # offene Migrationen — lokal
npm run db:migrate        # anwenden — lokal
npm run db:migrate:prod   # anwenden — Produktion (liest .env.prod.local, nach Merge auf main)
```

Seed-Skripte brechen ab, wenn `DATABASE_URL` nicht auf localhost zeigt.

---

## Test-Accounts & Lanes (Entwicklung)

> Stand 13.08.2026: Die DB wurde komplett zurückgesetzt. Alle früheren Test-Accounts
> (`*@tc-rheinland.de`, `*@tsv-dortmund.de`, `*@ts-westfalen.de`) existieren **nicht mehr**.

Testvereine gehören genau einer **Lane** — dem Eigentümer der Daten:

| Lane    | E-Mail-Domain   | Eigentümer | Regel für KI-Agenten                             |
| ------- | --------------- | ---------- | ------------------------------------------------ |
| `user`  | `*.swingz.test` | Mensch     | **Nur lesen. Niemals schreiben.**                |
| `agent` | `*.claude.test` | KI         | Freie Spielwiese — hier testen und kaputtmachen. |

| Verein               | Lane    | Zweck                                                 |
| -------------------- | ------- | ----------------------------------------------------- |
| TC Rheinland e.V.    | `user`  | Vollverein, laufende Saison (`published`). Hauptdemo. |
| TSV Dortmund         | `user`  | Präferenz-Erfassung offen (Wintersaison 2026/27)      |
| SV Bochum 08         | `user`  | Kein eigener Admin — nur über Superadmin (Switcher)   |
| TC Grün-Weiß Köln    | `user`  | Saison in `manual_review` — Testfall Publish-Übergang |
| TC Neuland e.V.      | `user`  | **Komplett leer** — Erstlogin/Onboarding von Hand     |
| Claude Sandbox Alpha | `agent` | Arbeitsverein der KI, bestückt                        |
| Claude Sandbox Beta  | `agent` | Leer — Onboarding-/CSV-Import-Tests der KI            |
| Claude Sandbox Gamma | `agent` | 500 Mitglieder, 20 Trainer, 12 Plätze — Lasttest      |

Owner bleibt `admin@swingz.com` (echter Zugang, vom Seed nie angefasst). Für
Tests gibt es zusätzlich `owner@claude.test` in der Agent-Lane — gleiche Rolle,
Seed-Passwort, wird bei jedem `seed:agent` neu angelegt. Darauf zeigen die
`TEST_OWNER_*`-Variablen.

Eingerichtete Testvereine bekommen im Seed ein laufendes Abo (Admin `solo_s`,
Superadmin `school_s`) — ohne das zeigt der gesamte Admin-Bereich nur die
Bezahlschranke. Die leeren Vereine (TC Neuland, Claude Sandbox Beta) bleiben
bewusst ohne: das ist der Erstlogin-Weg über den Onboarding-Wizard.

Alle Zugangsdaten: **`docs/TEST-CREDENTIALS.md`** — wird vom Seed generiert, nicht in Git
(Klartext-Passwörter). Die `TEST_*`-Variablen in `.env.local` zeigen bewusst auf die
Agent-Lane, weil E2E-Tests schreiben.

```bash
npm run seed              # Ist-Zustand zeigen, nichts ändern
npm run seed:docs         # Zugangsdaten-Doku neu schreiben (ändert keine Daten)
npm run seed:agent        # nur die Claude-Sandboxen neu aufbauen
npm run seed:reset        # DB komplett platt + alle 7 Vereine neu
```

---

## DO NOT

- ❌ `middleware.ts` anlegen — Auth läuft in `proxy.ts`
- ❌ Eigene UI-Komponenten bauen die shadcn/ui duplizieren
- ❌ `stripe`-Package direkt nutzen — Wrapper in `lib/stripe/` verwenden
- ❌ `console.log/error/warn` — immer `createLogger`
- ❌ Englische Texte in der UI
- ❌ Ohne `npx tsc --noEmit` committen
- ❌ `createServiceClient()` in Client Components — nur Server-Side
- ❌ Drizzle/postgres-js für Queries aus Dev-Umgebung — Supabase REST verwenden
- ❌ Admin-User mehreren Vereinen zuweisen — Admin = genau 1 Verein
- ❌ Owner mit `club_id` versehen — Owner hat nur Rolle, keine Membership zu Clubs
- ❌ Owner automatisch Admin-Membership beim Club-Erstellen geben — nur Superadmin bekommt das
