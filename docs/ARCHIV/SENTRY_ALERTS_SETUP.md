# Sentry Alerts Configuration

**Projekt:** SwingZ Tennis Club Management
**Stack:** Next.js 16 + @sentry/nextjs ^10.51.0
**Konfiguration:** `sentry.client.config.ts` + `sentry.server.config.ts`

---

## 1. Erforderliche Sentry Dashboard Alerts

Diese Alerts müssen im Sentry Dashboard (sentry.io) konfiguriert werden:

### Error Alerts

| Alert Name             | Bedingung                                               | Kanal          | Priorität |
| ---------------------- | ------------------------------------------------------- | -------------- | --------- |
| **New Critical Error** | `error.level:fatal` OR `error.unhandled:true`           | Slack + E-Mail | 🔴 Hoch   |
| **Error Spike**        | `event.count > 10 in 1h`                                | Slack          | 🟡 Mittel |
| **API 500 Errors**     | `transaction.op:http.server` AND `http.status_code:500` | E-Mail         | 🟡 Mittel |
| **Billing Errors**     | `tags.module:billing`                                   | Slack + E-Mail | 🔴 Hoch   |
| **Auth Errors**        | `tags.module:auth` AND `error.level:error`              | E-Mail         | 🟡 Mittel |

### Performance Alerts

| Alert Name              | Bedingung                                                        | Kanal  | Priorität |
| ----------------------- | ---------------------------------------------------------------- | ------ | --------- |
| **Slow API (>2s)**      | `transaction.duration > 2000ms` AND `transaction.op:http.server` | Slack  | 🟡 Mittel |
| **Slow DB Query (>1s)** | `span.op:db` AND `span.duration > 1000ms`                        | E-Mail | 🟡 Mittel |
| **High P95 Latency**    | `p95(transaction.duration) > 3000ms` over 5min                   | Slack  | 🔴 Hoch   |

### Cron Alerts

| Alert Name                 | Bedingung                                                  | Kanal          | Priorität |
| -------------------------- | ---------------------------------------------------------- | -------------- | --------- |
| **Billing Overdue Failed** | `monitor.slug:billing-overdue` AND `monitor.status:error`  | Slack + E-Mail | 🔴 Hoch   |
| **Billing Overdue Missed** | `monitor.slug:billing-overdue` AND `monitor.status:missed` | E-Mail         | 🟡 Mittel |

---

## 2. Cron Monitoring (bereits im Code konfiguriert)

### billing-overdue (Next.js Endpoint)

- **Endpoint:** `GET /api/cron/billing-overdue`
- **Schedule:** Täglich 3:00 UTC (via Vercel Cron)
- **Sentry Check-In:** `captureCheckIn({ monitorSlug: 'billing-overdue' })`
- **Setup in Sentry Dashboard:**
  1. Alerts → Monitors → Create Monitor
  2. Slug: `billing-overdue`
  3. Schedule: `0 3 * * *` (daily at 3 AM UTC)
  4. Check-in margin: 5 minutes
  5. Max runtime: 10 minutes

### mark-overdue-invoices (pg_cron)

- **SQL-Funktion:** `mark_overdue_invoices()` in Supabase
- **Schedule:** Täglich 3:00 UTC (via pg_cron)
- **Hinweis:** pg_cron läuft innerhalb der DB → kein Sentry Check-in möglich.
  Stattdessen: Overwache die Next.js API die danach aufgerufen wird.

---

## 3. Tags & Context (im Code verwenden)

Für bessere Alert-Filterung, Tags in `captureException` verwenden:

```typescript
Sentry.captureException(error, {
  tags: {
    module: 'billing', // billing | auth | booking | season | trainer
    cron: 'billing-overdue', // für Cron-Jobs
    page: 'admin-members', // für Frontend-Errors
  },
  extra: {
    memberId,
    clubId,
    invoiceId,
  },
});
```

---

## 4. Sampling-Konfiguration (aktuell)

| Config                     | Dev  | Prod |
| -------------------------- | ---- | ---- |
| `tracesSampleRate`         | 100% | 10%  |
| `profilesSampleRate`       | 100% | 10%  |
| `replaysOnErrorSampleRate` | -    | 100% |
| `replaysSessionSampleRate` | -    | 10%  |

**Empfehlung für Production:** Bei >1000 Users/Tag die Sampling-Rates beibehalten.
Bei <1000 Users/Tag können die Rates auf 25% erhöht werden (Kosten prüfen!).

---

## 5. Ignorierte Errors (bereichnet)

Folgende Errors werden in `sentry.client.config.ts` gefiltert:

- Browser Extension Errors (`top.GLOBALS`)
- Network Errors (`NetworkError`, `Failed to fetch`, `Load failed`)
- AbortController (`AbortError`)
- ResizeObserver (`ResizeObserver loop`)
- Health Check Transactions (`/api/health`)
- Static Asset Requests (`.css`, `.js`, `.png`, etc.)

---

## 6. Setup-Checkliste

- [ ] Sentry DSN in Vercel Environment Variables setzen (`NEXT_PUBLIC_SENTRY_DSN`)
- [ ] Sentry Auth Token in Vercel setzen (`SENTRY_AUTH_TOKEN` für Source Maps Upload)
- [ ] Error Alerts im Dashboard konfigurieren (siehe Tabelle oben)
- [ ] Performance Alerts konfigurieren
- [ ] Cron Monitor für `billing-overdue` erstellen
- [ ] Slack/E-Mail Notification Channels verbinden
- [ ] Source Maps Upload in CI/CD konfigurieren (optional, via `withSentryConfig`)

---

_Konfiguration aktualisiert: 2026-06-04_
