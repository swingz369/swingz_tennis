/**
 * app/api/cron/matchday-reminders/route.ts
 *
 * F2 — Vercel-Cron-Route für tägliche Spieltag-Erinnerungen.
 *
 * Schedule (in vercel.json):
 *   { "path": "/api/cron/matchday-reminders", "schedule": "0 7 * * *" }
 *   → täglich 07:00 UTC = 08:00/09:00 Berlin (Sommer/Winter).
 *
 * Auth:
 *   - Header `x-cron-secret` muss env.CRON_SECRET matchen.
 *     Vercel Cron sendet genau diesen Header.
 *   - Alternativ: `Authorization: Bearer <CRON_SECRET>` (Vercel-Konvention).
 *   - Local debug: manuelle Aufrufe mit `curl -H "x-cron-secret: $CRON_SECRET" ...`.
 *
 * Vercel-Cron-Vertrag:
 *   - max 90s Timeout; Service legt Logs in matchday_reminder_logs.
 *   - Soft-fail im Service: Fehler werden geloggt, Funktion returnt mit 200.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';
import {
  sendMatchdayRemindersForTomorrow,
  type SendMatchdayRemindersOptions,
} from '@/lib/matchday-reminders/send-matchday-reminders.service';

export const dynamic = 'force-dynamic';

const log = createLogger('api:cron:matchday-reminders');

export async function POST(request: NextRequest) {
  return runReminders(request);
}

export async function GET(request: NextRequest) {
  // GET-Support für manuelle Trigger via Browser / curl (z.B. "Dry-Run" Tests).
  return runReminders(request);
}

async function runReminders(request: NextRequest) {
  // ── Auth: Vercel-Cron-x-cron-secret Header ODER Authorization Bearer ───
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    log.error('CRON_SECRET nicht konfiguriert — Cron deaktiviert');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const incomingSecret =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (incomingSecret !== cronSecret) {
    log.warn('Unauthorized Cron-Request', {
      ip: request.headers.get('x-forwarded-for') ?? 'unknown',
    });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // ── Body / Query-Optionen (dryRun) ───────────────────────────────────
  const opts: SendMatchdayRemindersOptions = {};
  try {
    // Erlaube POST mit JSON-Body { dryRun: true } ODER GET ?dryRun=1.
    const method = request.method;
    if (method === 'POST') {
      const text = await request.text();
      if (text) {
        const parsed = JSON.parse(text) as { dryRun?: boolean };
        if (typeof parsed?.dryRun === 'boolean') opts.dryRun = parsed.dryRun;
      }
    } else {
      const url = new URL(request.url);
      if (url.searchParams.get('dryRun') === '1') opts.dryRun = true;
    }
  } catch {
    // Body nicht parsebar — als Default dryRun=false behandeln.
    opts.dryRun = false;
  }

  // ── Service-Invocation ────────────────────────────────────────────────
  try {
    const summary = await sendMatchdayRemindersForTomorrow(opts);
    log.info('Cron matchday-reminders Summary', {
      dryRun: summary.dryRun,
      matchdaysFound: summary.matchdaysFound,
      totalSent: summary.totalSent,
      totalSkipped: summary.totalSkipped,
      totalFailed: summary.totalFailed,
    });
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    // Service selbst hat fail-safe Vertrag (sollte niemals throwen) — falls
    // doch: 500 mit generischer Message (kein Stacktrace-Leak).
    log.error('Cron matchday-reminders unhandled Exception', {
      err: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json({ error: 'matchday-reminder run failed' }, { status: 500 });
  }
}
