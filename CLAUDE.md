# SwingZ — Project Instructions

> Read automatically at session start. Keep concise — every line costs context tokens.
> Only include things NOT obvious from reading the code or already in the system prompt.

## Overview

SwingZ is a **Tennis Club Management Platform** (Next.js 16, Supabase, Stripe, Vercel).
All user-facing text is in **German**. i18n infrastructure exists for English but is not yet active.

## Architecture

```
app/                    # Next.js App Router (routes, API, layouts)
  (protected)/          # Auth-required pages (admin/, member/, trainer/, superadmin/)
  api/                  # API routes
components/             # React components (shared + layout)
lib/                    # Shared utilities, services, helpers
src/
  application/          # Use cases (business logic)
  domain/               # Domain entities and types
  infrastructure/       # DB repos, external services, Drizzle schema
```

### Key Patterns

- **Server Components by default** — `'use client'` only when needed (hooks, browser APIs)
- **Role-based access** — 4 roles: `superadmin`, `admin`, `trainer`, `member`
  - Server auth: `requireAuth()` from `@/lib/auth`, `requireAdminClub()` from `@/lib/admin-context`
  - Admin selects which club to manage via `ADMIN_CLUB_COOKIE`
- **Supabase clients** — 3 variants, use the right one:
  - Server (user context): `createClient()` from `@/lib/supabase/server`
  - Service (bypasses RLS): `createServiceClient()` from `@/lib/supabase/service`
  - Browser: `createClient()` from `@/lib/supabase/client`
- **Logging**: Always `createLogger` from `@/lib/logger`, never `console.log/error`
  ```ts
  const log = createLogger('module-name');
  log.info('msg', { key: value });
  log.error('msg', error instanceof Error ? error : undefined);
  ```
- **API fetch** (client-side): `apiFetch` from `@/lib/api-fetch`
- **Next.js 16**: Route params are `Promise` — use `const { id } = await params` in page/layout props

### UI

- **shadcn/ui components** from `@/components/ui/` — never create custom equivalents
- Use `cn()` from `@/lib/utils` for conditional className merging

## Imports

Group in order: (1) React/Next, (2) third-party, (3) `@/components/ui`, (4) `@/lib`, (5) relative.
Use `de` locale from `@/lib/locale` for date-fns formatting.

## Testing

- **Run `npx tsc --noEmit` before every commit** — build must stay clean
- Tests: `npx vitest run` | E2E: `npx playwright test`
- Component tests use `TestProviders` from `src/__tests__/test-utils.tsx`

## Conventions

- All user-facing strings in **German** (exception: internal logs)
- **Stripe**: `@/lib/stripe/client.ts` (graceful, returns null if unconfigured) for checkout, `@/lib/stripe/stripe-client.ts` (throws) for webhooks
- **Pagination**: `getPagination()` + `buildPaginationMeta()` from `@/lib/pagination`
- **Notifications**: insert into `notifications` table via service client
- **Error handling**: graceful, user-friendly German messages

## Key Files

| File                   | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `lib/auth.ts`          | `requireAuth()` — server-side auth guard    |
| `lib/admin-context.ts` | `requireAdminClub()` — admin + club context |
| `lib/logger.ts`        | `createLogger()` — structured logging       |
| `lib/env.ts`           | Zod-validated ENV vars                      |
| `lib/format.ts`        | Date/time/currency formatters (de-DE)       |
| `lib/api-fetch.ts`     | Client-side fetch wrapper                   |
| `lib/stripe/*.ts`      | Stripe client wrappers                      |
| `middleware.ts`        | Auth middleware, route protection           |

## DO NOT

- ❌ Create custom UI components that duplicate shadcn/ui
- ❌ Use `stripe` package directly — use wrappers in `lib/stripe/`
- ❌ Display English text in the UI — use German
- ❌ Skip dark mode — always test both themes
- ❌ Commit without `npx tsc --noEmit` passing
