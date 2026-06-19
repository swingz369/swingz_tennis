# SwingZ — Project Instructions

> Automatisch bei jedem Session-Start geladen. Nur Dinge die NICHT aus dem Code offensichtlich sind.
> Zuletzt verifiziert: 17. Juni 2026 (gegen echten Code geprüft)

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
  (protected)/          # admin/, member/, trainer/, superadmin/
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

### UI

- **shadcn/ui** aus `@/components/ui/` — niemals eigene Duplikate bauen
- `cn()` aus `@/lib/utils` für conditional classNames
- Dark Mode immer mitdenken (beide Themes testen)

---

## Rollen & Business Rules

Vollständige Regeln: `docs/BUSINESS_RULES.md`

### Hierarchie

```
superadmin  →  admin  →  trainer  →  member
```

| Rolle        | Dashboard     | Besonderheit                                        |
| ------------ | ------------- | --------------------------------------------------- |
| `superadmin` | `/superadmin` | Verwaltet mehrere Vereine, Club-Switcher in Sidebar |
| `admin`      | `/admin`      | **Genau 1 Verein** — mehrere Clubs → superadmin     |
| `trainer`    | `/trainer`    | Kann in mehreren Vereinen aktiv sein                |
| `member`     | `/member`     | Kann in mehreren Vereinen aktiv sein                |

### Dashboard-Dispatch (`/dashboard`)

Höchste aktive Rolle aus `user_club_memberships` gewinnt. Kein aktives Membership → `/member` zeigt Hinweis "Admin kontaktieren" (kein Probetraining-Formular).

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

- API-Version: `2026-05-27.dahlia`
- Checkout (Client, graceful — gibt `null` wenn nicht konfiguriert): `@/lib/stripe/client.ts`
- Webhooks (Server, wirft Fehler wenn nicht konfiguriert): `@/lib/stripe/stripe-client.ts`
- **Niemals** `stripe`-Package direkt importieren — immer diese Wrapper nutzen
- Pricing: Starter €29/Monat, Professional €79/Monat

### E-Mail (Resend SMTP)

- Absender: `noreply@swingz.cloud`, `info@swingz.cloud`
- Keine `@mail.swingz.cloud`-Adressen (Subdomain nicht konfiguriert)
- Supabase Auth-Mails: SMTP via Resend, Absender `noreply@swingz.cloud`

### KI (Google Gemini Flash)

- Aktiver Provider: Google Gemini Flash (`GOOGLE_GENERATIVE_AI_API_KEY`)
- OpenAI-kompatibler Endpoint: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
- `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` in `lib/env.ts` optional definiert aber nicht aktiv genutzt

---

## Key Files

| Datei                                      | Zweck                                                |
| ------------------------------------------ | ---------------------------------------------------- |
| `proxy.ts`                                 | Auth-Middleware, Route-Protection, CSRF              |
| `lib/auth.ts`                              | `requireAuth()` — Server Component Auth Guard        |
| `lib/api-auth.ts`                          | `withApiAuth()`, `verifyRole()` — API Route Auth     |
| `lib/admin-context.ts`                     | `requireAdminClub()` — Admin + Club Kontext          |
| `lib/cookies.ts`                           | `ADMIN_CLUB_COOKIE` — Cookie-Name für Club-Selektion |
| `lib/logger.ts`                            | `createLogger()` — Structured Logging                |
| `lib/env.ts`                               | Zod-validierte ENV-Variablen                         |
| `lib/format.ts`                            | Datum/Zeit/Währung Formatter (de-DE)                 |
| `lib/api-fetch.ts`                         | Client-Side Fetch Wrapper                            |
| `lib/stripe/client.ts`                     | Stripe (graceful, für Checkout)                      |
| `lib/stripe/stripe-client.ts`              | Stripe (strict, für Webhooks)                        |
| `lib/features.ts`                          | Feature-Flag-Keys (JSONB in `clubs.features`)        |
| `src/infrastructure/persistence/schema.ts` | Drizzle Schema (alle Tabellen)                       |
| `docs/BUSINESS_RULES.md`                   | Verbindliche Produkt- und Rollenregeln               |

---

## Test & Build

```bash
npx tsc --noEmit          # Vor jedem Commit — muss 0 Errors geben
npx vitest run            # Unit Tests
npx playwright test       # E2E Tests
```

Component-Tests verwenden `TestProviders` aus `src/__tests__/test-utils.tsx`.

---

## Test-Accounts (Entwicklung)

| E-Mail                           | Rolle      | Verein                                              |
| -------------------------------- | ---------- | --------------------------------------------------- |
| `admin@swingz.com`               | superadmin | Tennis Club Berlin, Badminton Club Hamburg, weitere |
| `admin@tc-rheinland.de`          | admin      | TC Rheinland e.V.                                   |
| `trainer.1-8@tc-rheinland.de`    | trainer    | TC Rheinland e.V.                                   |
| `mitglied.1-120@tc-rheinland.de` | member     | TC Rheinland e.V.                                   |

Passwörter: `TEST-CREDENTIALS.md` (nicht in Git).

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
