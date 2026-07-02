# Deployment & Vercel-Konfiguration

> Production-Hosting, ENV, Build-Hooks, Cache-Strategie. Quelle: `vercel.json`, `package.json`, `lib/env.ts`.

## 🎯 Stack

- **Hosting:** Vercel (EU-Central-Region)
- **Production-URL:** https://swingz.vercel.app
- **Branch-Deploys:** jeder Git-Branch → Preview-URL
- **Custom-Domains:** pro Club (geplant, im Pilot mit swingz.cloud)

## 🔐 ENV-Variablen

Pflicht-Vars aus `lib/env.ts` (Zod-validiert beim Boot):

| Var                                      | Zweck                                                  |            Pflicht?             |
| ---------------------------------------- | ------------------------------------------------------ | :-----------------------------: |
| `NEXT_PUBLIC_SUPABASE_URL`               | Supabase-Projekt-URL                                   |               ✅                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`          | Public Anon-Key                                        |               ✅                |
| `SUPABASE_SERVICE_ROLE_KEY`              | Service-Key (⚠️ Server-only!)                          |               ✅                |
| `STRIPE_SECRET_KEY`                      | Stripe-API                                             |               ✅                |
| `STRIPE_WEBHOOK_SECRET`                  | Webhook-Signature                                      |               ✅                |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`     | Public Stripe-Key für Stripe.js                        |               ✅                |
| `RESEND_API_KEY`                         | E-Mail-Versand                                         |               ✅                |
| `NEXT_PUBLIC_APP_URL`                    | https://swingz.vercel.app (Prod)                       |               ✅                |
| `SENTRY_DSN`                             | Error-Monitoring                                       |               ✅                |
| `CRON_SECRET`                            | Cron-Auth (Header `Authorization: Bearer …`)           | ⚠️ als optional markiert (P0-4) |
| `GOOGLE_GENERATIVE_AI_API_KEY`           | Gemini Flash für KI                                    |            optional             |
| `OPENAI_API_KEY`                         | Fallback-Provider                                      |            optional             |
| `ANTHROPIC_API_KEY`                      | Fallback-Provider                                      |            optional             |
| `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | Web-Push                                               |           ✅ in Prod            |
| `OPEN_METEO_URL`                         | Weather-API (default: `https://api.open-meteo.com/v1`) |               ✅                |

Setup:

```bash
# Vercel Dashboard → Settings → Environment Variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
# …

# Multi-Environment (Production, Preview, Development)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
```

## 🏗 Build-Pipeline

### `npm run build`

Schritte (laut `package.json`):

```
1. prebuild: rm -rf .next    ← Vollständiger Cache-Wipe
2. next build               ← Compile + TypeScript-Check + Bundle
3. postbuild: drizzle-kit migrate    ← DB-Migrations automatisch
```

**Warum `prebuild` `rm -rf .next`?**

Vermeidet stale-cache-Probleme aus Vercels inkrementellem Build. Verlangsamt Build um ~30s, eliminiert aber "Cannot find module"-Fehler nach Dependency-Updates.

### Caching-Hook-Reihenfolge

| Hook       | Wann      | Befehl                                                                                                    | Zweck                                 |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `prebuild` | Vor Build | `rm -rf .next`                                                                                            | Garantiert reproduzierbare Builds     |
| `predev`   | Vor Dev   | `rm -rf .next/cache`                                                                                      | Schneller Dev-Start, behält `server/` |
| `clean`    | Manuell   | `rm -rf .next .turbo coverage .drizzle node_modules/.vitest .vitest-cache test-results playwright-report` | Komplett-Aufräumen                    |

Troubleshooting:

```bash
# Stale-Cache nach Dependency-Update?
npm run clean

# Schneller selektiv?
rm -rf .next/cache
```

## 🕐 Cron-Schedule

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/backup", "schedule": "0 2 * * *" },
    { "path": "/api/cron/notification-dispatch", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/overdue-invoices", "schedule": "0 8 * * *" },
    { "path": "/api/cron/dunning-sync", "schedule": "0 9 * * *" },
    { "path": "/api/cron/nuliga-sync", "schedule": "0 12 * * 0" },
    { "path": "/api/cron/season-reminders", "schedule": "0 11 * * 1" }
  ]
}
```

⚠️ **P0-Finding 4**: `CRON_SECRET` optional → Ungeprüfter Zugriff möglich. Sofort fixen.

## 🚦 Health-Checks

- `/` → Public Landing (200 OK)
- `/trial-training` → Public (200 OK)
- `/login` → Auth-Redirect-Loop-Test

## 🐛 Error-Tracking (Sentry)

Konfiguration in:

- `sentry.client.config.ts` — Browser-Errors
- `sentry.server.config.ts` — Server-Errors
- `next.config.js` → `withSentryConfig()` — Build-Integration

⚠️ **P0-Finding 10**: `app/global-error.tsx` loggt nur `console.error`, kein Sentry-Wiring. Inkonsistent zu `app/error.tsx`, das Sentry korrekt verdrahtet hat.

Fix: `error.tsx` Pattern für `global-error.tsx` übernehmen.

⚠️ **P1-Finding**: `Sentry.setUser()` fehlt implizit. Crash → User-Zuordnung schwer.

## 🔍 Monitoring & Logs

- **Vercel-Logs**: Live in Dashboard oder `vercel logs <deployment-url>`
- **Sentry**: Issue-Tracking mit Release-Tag pro Deploy
- **Supabase-Logs**: SQL-Editor → "Logs" (letzte Queries)
- **Postgres-Slow-Query-Log**: Production-Read-Replica

## 🌐 Custom-Domain (geplant, pro Club)

```bash
# Multi-Tenant-Domain
vercel domains add tcrheinland.swingz.app
vercel alias tcrheinland.swingz.app <deployment-id>

# Wildcard (Pilot)
*.swingz.app → CNAME → cname.vercel-dns.com
```

DNS-Provider: Cloudflare (Separation Vercel ↔ DNS für DDoS-Schutz).

## 🧪 Smoke-Tests nach Deploy

```bash
# Production-Smoke
curl -s -o /dev/null -w "%{http_code}" https://swingz.vercel.app/        # → 200
curl -s -o /dev/null -w "%{http_code}" https://swingz.vercel.app/trial-training  # → 200
curl -s -X POST https://swingz.vercel.app/api/webhooks/stripe  # → 400 (no signature)
```

## 📚 Verwandte Kapitel

- [`supabase-setup.md`](./supabase-setup.md) — Supabase-ENVs
- [`stripe-integration.md`](./stripe-integration.md) — Stripe-Webhook-Secret
- [`background-jobs.md`](./background-jobs.md) — Cron-Routes
- [`notifications.md`](./notifications.md) — Resend-SMTP
