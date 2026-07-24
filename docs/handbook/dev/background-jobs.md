# Background-Jobs — Cron, Runner, Race-Condition-Schutz

> Wie asynchrone Tasks laufen. Quelle: `app/api/cron/*`, `lib/jobs/runner.ts`.

## 🏗 Architektur

```
[Vercel-Cron-Trigger]
   │ vercel.json: schedule
   │ Header: "Authorization: Bearer $CRON_SECRET"
   ▼
[Route] app/api/cron/<job-name>/route.ts
   │ POST request, nur intern erreichbar (Vercel-Cron only)
   │ Importe: lib/jobs/runner.ts
   ▼
[Runner] lib/jobs/runner.ts
   │ INSERT/SELECT background_jobs { job_name, status }
   │ SET locked_at, locked_by (für Race-Condition-Schutz)
   │ Führe Job-Funktion aus
   │ UPDATE background_jobs { status, completed_at }
   ▼
[Job-Funktion] (z. B. backup-all, dispatch-notifications, dunning-sync)
   │ Eigenverantwortlich, nutzt Service-Client
   ▼
[Result: notifications / invoices / files gesetzt]
```

## 📋 Job-Liste

| Job                     | Cron-Schedule               | URL                               | Zweck                                                     |
| ----------------------- | --------------------------- | --------------------------------- | --------------------------------------------------------- |
| `backup`                | `0 2 * * *` (täglich 02:00) | `/api/cron/backup`                | JSON-Export aller 37 Tabellen (P0-11: kein Restore-Pfad!) |
| `notification-dispatch` | `*/5 * * * *`               | `/api/cron/notification-dispatch` | E-Mail/Push für offene Notifications                      |
| `overdue-invoices`      | `0 8 * * *`                 | `/api/cron/overdue-invoices`      | Mahnstufen setzen                                         |
| `dunning-sync`          | `0 9 * * *`                 | `/api/cron/dunning-sync`          | Dunning-Records synchronisieren                           |
| `nuliga-sync`           | `0 12 * * 0`                | `/api/cron/nuliga-sync`           | Wöchentlicher Liga-Sync                                   |
| `season-reminders`      | `0 11 * * 1`                | `/api/cron/season-reminders`      | Saison-Planungs-Erinnerungen                              |
| `cleanup-sessions`      | `0 3 * * 0`                 | `/api/cron/cleanup-sessions`      | Alte Sessions archivieren                                 |
| `reactivation-tracking` | `0 4 * * 1`                 | `/api/cron/reactivation-tracking` | Inaktive Members markieren                                |

## 🛡 Race-Condition-Schutz

🔴 **P0-Finding 13**: Aktuell `lib/jobs/runner.ts` benutzt `upsert` ohne `locked_at` / `locked_by`. Zwei parallele Cron-Trigger überschreiben sich.

**Fix** (Migration `20260728_fix_background_jobs_locking.sql`):

```sql
ALTER TABLE background_jobs
  ADD COLUMN locked_at TIMESTAMPTZ,
  ADD COLUMN locked_by TEXT,
  ADD COLUMN lock_expires_at TIMESTAMPTZ;
```

**Runner-Pattern:**

```ts
async function acquireLock(jobName: string, runnerId: string): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 min lease

  const { data, error } = await supabase.from('background_jobs').upsert(
    {
      job_name: jobName,
      runner_id: runnerId,
      locked_at: now.toISOString(),
      locked_by: runnerId,
      lock_expires_at: expiresAt.toISOString(),
      status: 'running',
      started_at: now.toISOString(),
    },
    {
      onConflict: 'job_name',
      // Nur update, wenn lock_expires_at abgelaufen
      // …
    }
  );
  // simpel: SELECT + UPDATE mit WHERE lock_expires_at < now()
}
```

Alternativ: Postgres-Advisory-Locks via `pg_try_advisory_lock(job_name_hash)`.

## 📜 Job-Status-Union-Type

```ts
type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stale';

interface BackgroundJob {
  job_name: string; // z. B. 'notification_dispatch'
  status: JobStatus;
  runner_id?: string; // Welcher Vercel-Instance
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  error_message?: string;
  locked_at?: string;
  lock_expires_at?: string;
  payload?: jsonb; // job-spezifische Daten
  result?: jsonb; // Ergebnis (Anzahl verarbeiteter Records, …)
  retry_count?: number;
  last_retry_at?: string;
}
```

## 🪵 Logging & Monitoring

Jeder Job loggt strukturiert:

```ts
const log = createLogger('cron/backup');

log.info('backup started', { jobName: 'backup' });
const result = await backupAllTables();
log.info('backup completed', {
  jobName: 'backup',
  recordCount: result.recordCount,
  durationMs: result.durationMs,
  outputFiles: result.outputFiles.length,
});
```

Fehler werden in `background_jobs.error_message` persistiert und in Sentry getrackt.

**Alerting** (Sentry): Wenn `status='failed'` innerhalb 24h > X Mal → Alarm.

## 📂 Backup-Job (P0-Finding 11)

Datei: `app/api/cron/backup/route.ts`

- **Input:** keine (alle Clubs)
- **Prozess:** pro Tabelle → JSON-Datei → Vercel-Blob-Storage
- **Output-Files:** `clubs.json`, `members.json`, `bookings.json`, … (~90 Dateien)
- **Retention:** 7 Tage (Cleanup im selben Job)
- **⚠️ Problem:** KEIN Restore-Mechanismus.
- **TODO:** `scripts/restore-backup.ts` Skript schreiben (P0 vor Marktreife lösen).

## 🎯 Idempotenz-Pflicht

Jeder Job MUSS idempotent sein — bei 2× Lauf darf er nicht zu doppelten Daten führen.

| Job                     | Idempotenz-Strategie                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| `notification-dispatch` | `WHERE dispatched_at IS NULL`                                            |
| `dunning-sync`          | UPSERT mit `dunning_id` PK                                               |
| `overdue-invoices`      | Vergleich mit `invoices.last_status`                                     |
| `nuliga-sync`           | UPSERT mit `nuliga_id` UNIQUE                                            |
| `backup`                | Datum-basiertes Output-Verzeichnis → überschreibt gleich-altriges Backup |

## 🧪 Test-Pattern

```ts
// src/__tests__/lib/jobs/backup.test.ts
test('backup produces all 90 tables', async () => {
  const result = await backupAllTables({ dryRun: true });
  expect(result.tables).toHaveLength(90);
  expect(result.recordCount).toBeGreaterThan(0);
});
```

## ⚠️ Bekannte Probleme

| Problem                                             | Severity | Finding |
| --------------------------------------------------- | -------- | ------- |
| `upsert` ohne Locking in `lib/jobs/runner.ts:16-32` | 🔴 P0    | P0-13   |
| `CRON_SECRET` als optional                          | 🔴 P0    | P0-4    |
| Backup ohne Restore-Pfad                            | 🔴 P0    | P0-11   |
| Kein Gemini-Timeout bei KI-Routes                   | 🟡 P1    | –       |
| N+1-Queries im Superadmin-Dashboard                 | 🟡 P1    | –       |

## 📚 Verwandte Kapitel

- [`deployment-vercel.md`](./deployment-vercel.md) — vercel.json Cron-Konfiguration
- [`notifications.md`](./notifications.md) — notification-dispatch Job
- [`data-model.md`](./data-model.md) — `background_jobs`-Tabelle
- [`stripe-integration.md`](./stripe-integration.md) — invoice.payment_failed-Race
