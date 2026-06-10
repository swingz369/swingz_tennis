# Test Environment Setup

This guide explains how to set up a local test database and environment variables for the SwingZ E2E test suites.

## Quick Start

```bash
# 1. One-time: spin up the local test DB in Docker
bash scripts/setup-test-db.sh

# 2. Fill in test user credentials in .env.test (the script auto-fills DB URLs)
$EDITOR .env.test

# 3. Run the E2E tests
npx playwright test
```

That's it. The setup script is idempotent — re-run it any time to verify the test DB is healthy, and it will not clobber an existing `.env.test`.

## Test Suite Architecture

SwingZ has three parallel test suites, all reading environment variables from `.env.test` (which is gitignored):

| Suite             | Directory                              | Framework                                          | Auth   | Purpose                                                      |
| ----------------- | -------------------------------------- | -------------------------------------------------- | ------ | ------------------------------------------------------------ |
| Vitest + Midscene | `e2e/`                                 | Vitest + Midscene AI (driven by `aiAct`/`aiQuery`) | Real   | AI-driven end-to-end flows (Season Wizard, member lifecycle) |
| Playwright        | `tests/e2e/`                           | Pure Playwright (no AI)                            | Real   | Functional flows (RBAC, navigation, modal centering)         |
| Vitest unit       | `src/__tests__/`, `src/__tests__/api/` | Vitest                                             | Mocked | Pure logic, no DB required                                   |

The `vitest.config.ts` and `playwright.config.ts` both call `dotenv.config()` to load `.env.test` automatically.

## Local Test Database: Two Options

### Option A: Plain Postgres in Docker (default — fast, no auth)

`scripts/setup-test-db.sh` uses `docker-compose.test.yml` to start a vanilla `postgres:15` container on port `54323`. This is enough for:

- Unit tests with mocked auth (`auth.users` is mocked)
- Drizzle schema validation
- Raw SQL queries during development

It is **NOT** enough for:

- E2E tests that require real Supabase auth (sign-up, login, RLS)
- Tests that hit the `auth.users` table directly

### Option B: Full Supabase Local Stack (recommended for E2E)

For the full Supabase experience (GoTrue, PostgREST, Realtime, Storage, RLS), use:

```bash
bash scripts/setup-supabase.sh
```

This requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker. Once running, all `.env.test` values pointing to `localhost:54321` work as-is. This is the only option that runs the real auth flow that `loginAs()` depends on.

## Environment Variables Reference

### Dev Server

| Variable       | Default                 | Description                       |
| -------------- | ----------------------- | --------------------------------- |
| `APP_BASE_URL` | `http://localhost:3000` | Where the Next.js dev server runs |
| `BASE_URL`     | `http://localhost:3000` | Alias used by some specs          |

### Supabase Connection

| Variable                        | Local default            | Description                                                    |
| ------------------------------- | ------------------------ | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `http://localhost:54321` | Supabase API URL (must be `NEXT_PUBLIC_*` for client-side use) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `supabase status`   | Public anon key (safe to commit)                               |
| `SUPABASE_SERVICE_ROLE_KEY`     | from `supabase status`   | Service role key — **NEVER commit; full DB access**            |
| `NEXT_PUBLIC_APP_URL`           | `http://localhost:3000`  | Used for email redirect URLs, Stripe webhooks                  |
| `NEXT_PUBLIC_SITE_URL`          | `http://localhost:3000`  | Same as `APP_URL`, used in some integrations                   |

### Database

| Variable       | Local default                                                                                                                                         | Description                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:54323/swingz_test` (plain Docker) or `postgres://postgres:postgres@localhost:54322/postgres` (Supabase local) | Direct Postgres connection for Drizzle/migrations/scripts |

### Test Behavior

| Variable                | Default  | Description                                                                                                                                                                 |
| ----------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISABLE_RATE_LIMITING` | `true`   | **Required.** Disables auth/rate-limit middleware so tests can hit login many times. The Playwright `webServer` command runs with `DISABLE_RATE_LIMITING=true npm run dev`. |
| `MIDSCENE_MODEL_NAME`   | `gpt-4o` | AI model for Midscene tests. `gemini-1.5-pro` also supported.                                                                                                               |
| `OPENAI_API_KEY`        | —        | OpenAI API key for Midscene tests.                                                                                                                                          |

### Test Users

Required for any test that calls `loginAs()` / `loginAsRoleAware()`:

| Variable                                             | Description                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`           | Admin role user (for `/admin/*` routes)                                       |
| `TEST_SUPERADMIN_EMAIL` / `TEST_SUPERADMIN_PASSWORD` | Superadmin role user (for `/superadmin/*` routes)                             |
| `TEST_MEMBER_EMAIL` / `TEST_MEMBER_PASSWORD`         | Member role user (for `/dashboard/*` routes)                                  |
| `TEST_TRAINER_EMAIL` / `TEST_TRAINER_PASSWORD`       | Trainer role user                                                             |
| `E2E_TEST_MEMBER_EMAIL` / `E2E_TEST_MEMBER_PASSWORD` | Stripe-checkout test user (uses a different domain to avoid collisions)       |
| `TEST_MEMBER_UUID`                                   | UUID of the test billing user (output of `scripts/seed-test-billing-user.ts`) |

#### Provisioning Test Users

The cleanest way is to create them in Supabase Studio at <http://localhost:54323> with these exact emails + passwords, then set their roles via SQL or the Studio UI.

For the billing test user, the helper `scripts/seed-test-billing-user.ts` does the heavy lifting:

```bash
npx tsx scripts/seed-test-billing-user.ts
# → prints TEST_MEMBER_UUID=... / TEST_MEMBER_EMAIL=... / TEST_MEMBER_PASSWORD=...
# Copy the output into .env.test
```

## Common Commands

```bash
# ─── Test database ────────────────────────────────────────────────────────
bash scripts/setup-test-db.sh                    # idempotent: start or verify
$COMPOSE_CMD -f docker-compose.test.yml down     # stop
$COMPOSE_CMD -f docker-compose.test.yml down -v  # stop + wipe data
docker logs swingz-test-db                       # inspect container logs

# ─── Playwright tests ─────────────────────────────────────────────────────
npx playwright test                              # all specs
npx playwright test tests/e2e/modal-centering.spec.ts  # one spec
npx playwright test --headed                     # headed mode for debugging
npx playwright test --ui                         # Playwright UI mode

# ─── Vitest + Midscene tests (need OPENAI_API_KEY) ────────────────────────
npx vitest run e2e/admin-season-wizard.test.ts
npx vitest run e2e/member-lifecycle.test.ts
npx vitest run e2e/season-planning-backtracking.test.ts
npx vitest run e2e/trainer-availability.test.ts

# ─── Vitest unit tests (no DB / no AI required) ───────────────────────────
npm test                                         # full suite
npx vitest run src/__tests__/lib/load-config.test.ts

# ─── Seed test users ──────────────────────────────────────────────────────
npx tsx scripts/seed-test-billing-user.ts        # prints test billing user creds
```

## CI Integration

The E2E tests are designed to be CI-friendly out of the box:

- `.env.test.example` is the canonical template — copy it to `.env.test` in CI
- All scripts gracefully `test.skip()` if env vars are missing
- The setup script is idempotent and prints a clear summary

In GitHub Actions, you typically:

1. Spin up a Postgres service container (or use Supabase's hosted CI tier)
2. `cp .env.test.example .env.test` + inject secrets via `env.SECRET_NAME`
3. `npx playwright test`

## Troubleshooting

### "Login failed" in Playwright tests

- Verify `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` match a user in your local Supabase
- Ensure Supabase is running: `supabase status` should show the API URL
- Open DevTools → Network → `/api/auth/login` to see the actual error
- Check the session cookie is being set: DevTools → Application → Cookies → look for `sb-*-auth-token`

### "Connection refused" on port 54323

- The plain Docker test DB isn't running: `docker ps | grep swingz-test-db`
- If the container exists but is stopped: `docker start swingz-test-db`
- If it's missing: `bash scripts/setup-test-db.sh`
- Port conflict: edit `docker-compose.test.yml` to use a different host port

### "relation auth.users does not exist"

You're using Option A (plain Docker) but a test needs real Supabase auth. Switch to Option B:

```bash
bash scripts/setup-supabase.sh
```

### Midscene tests are slow or fail with API errors

- Verify `OPENAI_API_KEY` is set and has credits
- The free tier may rate-limit — increase the test timeout (currently 600s)
- Switch to Gemini (free tier) by setting `MIDSCENE_MODEL_NAME=gemini-1.5-pro` + `GOOGLE_API_KEY`

### `.env.test` accidentally committed

The file is in `.gitignore` (`Local env files`), but if a secret leaked:

1. Rotate the secret immediately (Supabase dashboard → Settings → API → Regenerate)
2. Remove from history: `git filter-repo --invert-paths --path .env.test`
3. Force-push (or open a PR to rewrite history)
