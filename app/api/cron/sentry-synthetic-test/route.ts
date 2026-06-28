import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('cron:sentry-synthetic-test');

export const dynamic = 'force-dynamic';

/**
 * Sentry-Pipeline Health-Synthetic-Test (TICKET B5 AKZ-1).
 *
 * Zweck: Quartalsweiser Heartbeat-Event, der verifiziert dass der
 * Sentry-SDK initialisiert ist, DSN konfiguriert ist und ein
 * Sample-Event die volle Pipeline (SDK zum DSN zum Transport zur
 * Sentry API) durchlaeuft. Der captureCheckIn-Lifecycle markiert in
 * der Sentry-UI einen Cron-Monitor; bleibt der Heartbeat aus,
 * alarmiert Sentry automatisch.
 *
 * Schedule: Quartalsweise via vercel.json
 * (Cron-Expression: 0 0 1 Stern-Slash 3 Stern = 1. jedes 3. Monats
 * um 00:00 UTC = Jan, Apr, Jul, Okt).
 *
 * Auth: Vercel Cron setzt Authorization 'Bearer CRON_SECRET' - gleicher
 * Pattern wie app/api/cron/billing-overdue.
 *
 * Response: Audit-Report als JSON (fuer Monitoring-Dashboards scrapbar);
 * strukturierte Felder: status, dsn_resolved, sdk_initialized,
 * sdk_version, monitor_slug, checkin_id, latency_ms, timestamp.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/crons/
 */
export async function GET(request: NextRequest) {
  // Vercel-Cron-Secret-Auth (same pattern as app/api/cron/billing-overdue)
  const authHeader = request.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    log.error('CRON_SECRET not configured - rejecting request');
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const monitorSlug = 'sentry-pipeline-health';
  const startTime = Date.now();

  // SDK-Init-Verifikation
  const client = Sentry.getClient();
  if (!client) {
    log.error('Sentry SDK not initialized');
    return NextResponse.json(
      {
        status: 'error',
        reason: 'Sentry SDK not initialized (no client registered)',
        dsn_resolved: false,
        sdk_initialized: false,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  // captureCheckIn-Lifecycle: in_progress -> ok
  const checkInId = Sentry.captureCheckIn({
    monitorSlug,
    status: 'in_progress',
  });

  // Reviewer-Nit #1: Wenn captureCheckIn keine ID liefert, ist der
  // Cron-Monitor fuer diesen Run stillgelegt (DSN misconfig? oder
  // Transport nicht erreichbar?). Sentry wuerde dann kein Heartbeat-
  // Missed-Alert generieren - ein falscher Sicherheits-Schein.
  if (!checkInId) {
    log.error('captureCheckIn returned no id (DSN/transport degraded)');
    return NextResponse.json(
      {
        status: 'degraded',
        reason: 'captureCheckIn returned no id (DSN/transport degraded)',
        monitor_slug: monitorSlug,
        sdk_initialized: true,
        dsn_resolved: !!client.getDsn?.(),
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  try {
    // Sample-Event verifies end-to-end pipeline (SDK to DSN to Transport to API)
    Sentry.captureMessage('B5 Synthetic-Test fired', { level: 'info' });

    Sentry.captureCheckIn({ checkInId, monitorSlug, status: 'ok' });

    // Reviewer-Nit #2: getDsn ist als Instanz-Methode typisiert;
    // optional-chain liefert DsnComponents | undefined, kein typeof-Guard noetig.
    const resolvedDsn = client.getDsn?.();
    const sdkVersion = client.getSdkMetadata?.()?.sdk?.version ?? null;
    const latencyMs = Date.now() - startTime;

    log.info('Sentry synthetic-test OK', { monitorSlug, latencyMs });

    return NextResponse.json({
      status: 'ok',
      dsn_resolved: !!resolvedDsn,
      sdk_initialized: true,
      sdk_version: sdkVersion,
      monitor_slug: monitorSlug,
      checkin_id: checkInId,
      latency_ms: latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Sentry synthetic-test threw', { error });
    Sentry.captureCheckIn({ checkInId, monitorSlug, status: 'error' });
    return NextResponse.json(
      {
        status: 'error',
        reason: error instanceof Error ? error.message : 'unknown',
        monitor_slug: monitorSlug,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
