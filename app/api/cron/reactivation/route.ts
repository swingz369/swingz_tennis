// =============================================================================
// app/api/cron/reactivation/route.ts — TICKET 2.5.2
// =============================================================================
//
// Vercel-Cron-Invocation auf `vercel.json`: `0 14 * * 1` (Montag 14:00 UTC,
// weekly cadence, low-noise). Auth via Bearer $CRON_SECRET. Service-Layer
// in `lib/services/reactivation.service.ts` (separated for Test-Stub-
// Override + Reusability).
//
// Pattern-Reference: app/api/cron/billing-overdue/route.ts +
// app/api/cron/sentry-synthetic-test/route.ts.
//
// Production-Activation-Step: tsc + vitest grün + Migration
// `20260701_create_reactivation_logs_and_view.sql` DEPLOYED via
// `npx supabase db push`.
// =============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { reactivateInactiveMembers } from '@/lib/services/reactivation.service';
import { createLogger } from '@/lib/logger';
import { env } from '@/lib/env';

const log = createLogger('cron:reactivation');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. CRON_SECRET-Auth (Vercel-Cron-Standard: `Authorization: Bearer ${CRON_SECRET}`).
  // Mirror zu app/api/cron/billing-overdue/route.ts.
  const authHeader = request.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    log.error('CRON_SECRET not configured — rejecting request');
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Sentry-Cron-Monitor: captureCheckIn-Lifecycle (B5-Synthetic-Test-Pattern).
  const monitorSlug = 'reactivation-inactive-members';
  const checkInId = Sentry.captureCheckIn({
    monitorSlug,
    status: 'in_progress',
  });

  // B1: silent-Cron-Monitor-Bug vermeiden. Wenn captureCheckIn undefined zurueck-
  // gibt, ist DSN-Transport degraded und Sentry sieht den Heartbeat nicht. Wir
  // antworten 503 damit Vercel-Cron einen Retry fuehrt (Mirror-Pattern:
  // app/api/cron/sentry-synthetic-test/route.ts).
  if (!checkInId) {
    log.error('captureCheckIn returned no id (DSN/transport degraded)');
    return NextResponse.json(
      {
        status: 'degraded',
        reason: 'captureCheckIn returned no id (DSN/transport degraded)',
        monitor_slug: monitorSlug,
        sdk_initialized: true,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  try {
    const summary = await reactivateInactiveMembers();

    // 3. captureCheckIn: mark as ok
    Sentry.captureCheckIn({ checkInId, monitorSlug, status: 'ok' });

    log.info('Reactivation-Cron erfolgreich', summary);
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    log.error('Reactivation-Cron failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    Sentry.captureCheckIn({ checkInId, monitorSlug, status: 'error' });
    Sentry.captureException(error, { tags: { cron: 'reactivation' } });
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
