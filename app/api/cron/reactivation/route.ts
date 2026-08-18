/**
 * GET /api/cron/reactivation
 *
 * Sprint 4 Q2 — Ticket 2.5.2 (Inaktivitäts-Reaktivierung)
 *
 * Daily Vercel Cron (vercel.json `0 9 * * *`) that finds members with no booking
 * in the last 14 days, sends them a reactivation push notification, and marks the
 * membership so we don't spam them.
 *
 * Auth: Bearer ${CRON_SECRET} (same pattern as billing-overdue, nuliga-sync).
 * Monitoring: Sentry cron check-in with monitorSlug 'reactivation'.
 *
 * Idempotency: ReactivationService.runReactivation checks last_reactivation_sent_at
 * per membership and only sends if cooldown has elapsed.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { ReactivationService } from '@/lib/services/reactivation.service';
import { createLogger } from '@/lib/logger';
import { env } from '@/lib/env';
import { recordHeartbeat } from '@/lib/ops-heartbeat';

const log = createLogger('cron:reactivation');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    log.error('CRON_SECRET not configured — rejecting request');
    return NextResponse.json({ error: 'Dienst fehlkonfiguriert' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  // ── Sentry cron monitoring ───────────────────────────────────────────
  const checkInId = Sentry.captureCheckIn({
    monitorSlug: 'reactivation',
    status: 'in_progress',
  });

  try {
    const result = await ReactivationService.runReactivation();

    // Soft-warn if any per-member errors (push service may be flaky, not blocking)
    if (result.errors.length > 0) {
      log.warn(`Reactivation completed with ${result.errors.length} per-member errors`, {
        errors: result.errors.slice(0, 10), // cap log payload
      });
    }

    Sentry.captureCheckIn({ checkInId, monitorSlug: 'reactivation', status: 'ok' });

    // Lebenszeichen fuer /api/health (PRODUKTIONSREIFE.md 5.3)
    await recordHeartbeat('cron-reactivation');
    return NextResponse.json({
      success: true,
      ...result,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Reactivation cron failed', { error: message });

    Sentry.captureCheckIn({ checkInId, monitorSlug: 'reactivation', status: 'error' });
    Sentry.captureException(error, { tags: { cron: 'reactivation' } });

    return NextResponse.json({ error: 'Cron-Job fehlgeschlagen', message }, { status: 500 });
  }
}
