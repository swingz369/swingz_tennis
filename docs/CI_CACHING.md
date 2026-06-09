# CI Caching Strategy

> **Audience:** DevOps engineers, CI/CD maintainers
> **Last updated:** 2026-06-09
> **Status:** Stable — Sprint 3

This document describes how **Vercel** (production + preview deploys) and **GitHub Actions** (perf-bench + general CI) should cache build artifacts for SwingZ, and which environment variables must be set.

---

## Table of Contents

1. [Cache Architecture Overview](#1-cache-architecture-overview)
2. [Vercel Caching](#2-vercel-caching)
3. [GitHub Actions Caching](#3-github-actions-caching)
4. [Drizzle Migrations Cache](#4-drizzle-migrations-cache)
5. [Environment Variables](#5-environment-variables)
6. [Cache Invalidation Triggers](#6-cache-invalidation-triggers)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Cache Architecture Overview

SwingZ uses **multiple independent caches** that must be invalidated separately. Conflating them leads to either stale-module bugs (cache too aggressive) or 30s+ rebuild penalties (cache too aggressive).

| Cache                     | Location                         | Size (typical) | Invalidated by              |
| ------------------------- | -------------------------------- | -------------: | --------------------------- |
| Next.js Turbopack/Webpack | `.next/cache/`                   |      50-200 MB | `predev`, pre-commit hook   |
| Next.js Build Output      | `.next/server/`, `.next/static/` |     100-300 MB | `prebuild`                  |
| SWC Compiler              | `.swc/`                          |        5-20 MB | `predev`, pre-commit hook   |
| TypeScript Incremental    | `*.tsbuildinfo`                  |         1-5 MB | `predev`, pre-commit hook   |
| ESLint                    | `.eslintcache`                   |       0.5-2 MB | `clean:all`                 |
| Drizzle Migrations        | `drizzle/meta/`                  |         < 1 MB | **NEVER** (source of truth) |
| Vitest                    | `node_modules/.vitest`           |        5-10 MB | `clean`                     |
| Playwright Report         | `playwright-report/`             |       10-50 MB | `clean`                     |
| Coverage                  | `coverage/`                      |        5-20 MB | `clean`                     |

**Golden rule:** Drizzle migration metadata is **never** in the build cache — it must always come from the source tree (committed) to guarantee reproducibility.

---

## 2. Vercel Caching

### 2.1 What Vercel does by default

Vercel automatically caches:

- **`.next/cache/`** (Next.js build cache) → persists between deployments
- **`node_modules/`** (production dependencies) → persisted across builds
- **`~/.npm/`** (npm cache) → persisted, scoped to project

Vercel automatically **discards** between builds:

- `.next/server/`, `.next/static/` (rebuilt each deploy)
- `.vercel/` (Vercel-internal, ephemeral)
- Source files (always fresh from git)

### 2.2 Vercel `vercel.json` configuration

Our `vercel.json` (already in repo) configures:

```json
{
  "buildCommand": "npm run build",
  "framework": "nextjs",
  "github": {
    "silent": false,
    "deployOnPush": true
  }
}
```

### 2.3 What we override via `prebuild` hook

The `prebuild` script in `package.json` runs `rm -rf .next` before every Vercel build. This is **intentional** — it ensures:

- Fresh build for every deploy (reproducibility)
- No stale `.next/server` artifacts from a previous (possibly failed) build
- Cache key in Vercel CDN is always tied to the current git commit

**Trade-off accepted:** ~20-30s longer build time vs. zero stale-module risk.

### 2.4 Vercel environment variables

Set these in **Vercel Dashboard → Project Settings → Environment Variables**:

| Variable                        | Environment          | Value                                       | Required?          |
| ------------------------------- | -------------------- | ------------------------------------------- | ------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Production + Preview | `https://<project>.supabase.co`             | ✅                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production + Preview | (from Supabase dashboard)                   | ✅                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | Production + Preview | (server-only, never expose)                 | ✅                 |
| `DATABASE_URL`                  | Production + Preview | `postgresql://...supabase.co:5432/postgres` | ✅                 |
| `STRIPE_SECRET_KEY`             | Production           | `sk_live_...`                               | ✅ (billing)       |
| `STRIPE_PUBLISHABLE_KEY`        | Production + Preview | `pk_live_...` / `pk_test_...`               | ✅                 |
| `STRIPE_WEBHOOK_SECRET`         | Production           | `whsec_...`                                 | ✅                 |
| `NEXT_PUBLIC_APP_URL`           | Production           | `https://swingz.vercel.app`                 | ✅                 |
| `SENTRY_DSN`                    | Production           | (from Sentry project settings)              | Optional           |
| `SENTRY_AUTH_TOKEN`             | Production           | (for sourcemap upload)                      | Optional           |
| `DISABLE_RATE_LIMITING`         | Preview only         | `true`                                      | ✅ (E2E tests)     |
| `NODE_ENV`                      | Production           | `production`                                | Auto-set by Vercel |
| `SKIP_ENV_VALIDATION`           | Production + Preview | `1`                                         | ✅ (build perf)    |
| `NEXT_TELEMETRY_DISABLED`       | Production + Preview | `1`                                         | ✅ (privacy)       |

---

## 3. GitHub Actions Caching

### 3.1 What we cache in `.github/workflows/ci.yml`

The CI workflow currently uses `actions/setup-node@v4` with built-in npm cache:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version-file: '.nvmrc'
    cache: 'npm' # ← auto-caches ~/.npm
```

**Key derivation:** `package-lock.json` hash + Node version. Cache invalidates automatically when dependencies change.

### 3.2 Recommended: Add Next.js cache to GitHub Actions

Extend `ci.yml` with explicit `.next/cache` caching:

```yaml
- name: Cache Next.js build output
  uses: actions/cache@v4
  with:
    path: |
      .next/cache
      node_modules/.cache
    key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json', '**/next.config.js') }}-${{ hashFiles('**/[a-z]*.{ts,tsx,js,jsx}', '**/app/**', '**/lib/**', '**/components/**') }}
    restore-keys: |
      ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json', '**/next.config.js') }}-
      ${{ runner.os }}-nextjs-
```

**Why the `restore-keys` fallback?** GitHub Actions cache is best-effort. If the exact key misses, the restore-keys provide a partial cache (deps + config, no source) — still faster than cold build.

### 3.3 Recommended: Cache Drizzle schema state (NOT the migrations themselves)

```yaml
- name: Cache Drizzle introspection
  uses: actions/cache@v4
  with:
    path: drizzle/.introspected
    key: drizzle-introspect-${{ hashFiles('src/infrastructure/persistence/**/*.ts') }}
```

The introspection output is regenerated by `drizzle-kit generate` — caching it skips the 5-10s introspection step on CI.

### 3.4 perf-bench workflow caching

The `.github/workflows/perf-bench.yml` (Sprint 3) does **NOT** cache `.next` — benchmarks need a clean slate. It uses `npm run clean:all` before each run to guarantee:

- No compiler state from a previous run
- Identical starting conditions for all 3 configurations (baseline/caching/backtracking)
- Reproducible results in `tests/bench/.bench-results.json`

### 3.5 GitHub Actions environment variables

Set these in **GitHub → Repository → Settings → Secrets and variables → Actions**:

| Secret                  | Used in                  | Value                   | Required? |
| ----------------------- | ------------------------ | ----------------------- | --------- |
| `LHCI_GITHUB_APP_TOKEN` | ci.yml (Lighthouse step) | (from LHCI app install) | Optional  |
| `GITIGNORE_WEBHOOK_URL` | verify-gitignore.ts      | Slack/Discord webhook   | Optional  |
| `SLACK_WEBHOOK_URL`     | auto-detected fallback   | Slack webhook           | Optional  |
| `VERCEL_TOKEN`          | optional deploy workflow | (from Vercel account)   | Optional  |
| `VERCEL_ORG_ID`         | optional deploy workflow | (Vercel team ID)        | Optional  |
| `VERCEL_PROJECT_ID`     | optional deploy workflow | (Vercel project ID)     | Optional  |

For **repository variables** (non-secret, visible to forks):
| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://swingz.vercel.app` |

---

## 4. Drizzle Migrations Cache

### 4.1 The hard rule

> **Drizzle migration files (`drizzle/00XX_*.sql`) are ALWAYS built from the source tree, never from any cache.**

Reasoning: migrations are the source of truth for the database schema. A stale cached migration can cause silent schema drift between dev/staging/prod.

### 4.2 What IS cached

Only the **introspection output** (used by `drizzle-kit generate` to detect schema changes):

```
drizzle/.introspected/        # cached (regenerated when schema/*.ts changes)
drizzle/meta/_journal.json    # NEVER cached (committed, small)
drizzle/meta/00XX_snapshot.json # NEVER cached (committed, small)
drizzle/00XX_*.sql            # NEVER cached (committed, small)
```

### 4.3 The migration workflow

```bash
# 1. Generate new migration (uses cached introspection)
npx drizzle-kit generate

# 2. Review the SQL — NEVER skip this
cat drizzle/00XX_new_migration.sql

# 3. Apply to dev DB
DATABASE_URL=postgresql://localhost npx drizzle-kit migrate

# 4. Commit: schema.ts + drizzle/00XX_*.sql + drizzle/meta/
git add src/infrastructure/persistence/ drizzle/
git commit -m "feat: add new_feature column"
```

### 4.4 postbuild script behavior

```json
"postbuild": "npx drizzle-kit migrate"
```

This runs **after** every `npm run build` and applies pending migrations to the **target database** (via `DATABASE_URL`). On Vercel, this runs against the production Supabase DB. On CI, it runs against the test DB.

**⚠️ Production safety:** Vercel runs `postbuild` for every deployment. Ensure your migrations are **idempotent** or **backward-compatible** — a failed migration will break the deploy.

---

## 5. Environment Variables

### 5.1 Local development (`.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
SKIP_ENV_VALIDATION=1
NEXT_TELEMETRY_DISABLED=1
```

### 5.2 Vercel production

See section 2.4.

### 5.3 GitHub Actions

See section 3.5.

### 5.4 .env verification

The `scripts/verify-env.ts` script (Sprint 3) validates:

```typescript
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
];
```

Run with `npx tsx scripts/verify-env.ts` to catch missing variables before deploy.

---

## 6. Cache Invalidation Triggers

| Event                                                                    | Action                                                | Scope               |
| ------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------- |
| `git commit` (changes in `lib/`, `supabase/migrations/`, `package.json`) | Husky pre-commit deletes `.next/cache`                | Local               |
| `npm run dev` (first time)                                               | `predev` deletes `.next/cache`                        | Local               |
| `npm run build` (every time)                                             | `prebuild` deletes entire `.next/`                    | Local + Vercel + CI |
| `npm run clean`                                                          | Manual: deletes 9 build/test paths                    | Local               |
| `npm run clean:all`                                                      | Manual: deletes 14+ paths incl. OS temp               | Local + CI          |
| `drizzle-kit generate`                                                   | Invalidates `drizzle/.introspected/` cache            | Local + CI          |
| `git pull` (if package.json changed)                                     | `npm ci` re-installs, invalidates npm cache           | Local + CI          |
| Vercel deploy                                                            | Fresh `.next/` build (no shared cache across deploys) | Vercel              |
| Vercel rollback                                                          | Reuses previous deployment's `.next/`                 | Vercel              |

---

## 7. Troubleshooting

### "Module not found" after dependency update

1. Check `package-lock.json` was committed: `git log --stat package-lock.json`
2. Clear caches: `npm run clean:all && rm -rf node_modules && npm ci`
3. If on Vercel: trigger a **redeploy** (Vercel keeps last 5 builds' cache, sometimes a stale one wins)

### "Cannot find module" in production but works locally

1. Vercel `.next/cache` may be stale → push a small dummy commit to force fresh build
2. Or set `ENABLE_EXPERIMENTAL_COREPACK=0` in Vercel env to disable corepack caching
3. Check Vercel build log for "Using cache from previous deployment" — if yes, manually clear in Vercel Dashboard

### "Migration failed" in postbuild

1. Check `DATABASE_URL` in Vercel env points to the **target DB** (not a stale preview DB)
2. Verify migration is idempotent: run `npx drizzle-kit migrate` twice locally — second run should be a no-op
3. For data migrations: use `IF NOT EXISTS` clauses, never `DROP COLUMN` without multi-deploy dance

### Bench results are inconsistent

1. Ensure `npm run clean:all` runs **before** the bench in CI (see `.github/workflows/perf-bench.yml`)
2. Check for background processes consuming CPU: `top` in the CI runner
3. Use `time` or `hyperfine` to measure wall-clock, not just vitest's internal timer

---

## See also

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — main CI workflow
- [`.github/workflows/perf-bench.yml`](../.github/workflows/perf-bench.yml) — nightly benchmarks
- [`vercel.json`](../vercel.json) — Vercel deployment config
- [`package.json`](../package.json) — `clean`, `clean:all`, `prebuild`, `predev` scripts
- [`docs/CACHING.md`](../docs/CACHING.md) — local development cache strategy
- [`docs/DEPLOYMENT_STATUS.md`](../docs/DEPLOYMENT_STATUS.md) — deployment runbook
