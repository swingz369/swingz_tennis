/**
 * GET /api/admin/cron-health
 * Returns health status of all active pg_cron jobs.
 * Superadmin only.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { db } from '@/infrastructure/persistence/db';
import { sql } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:cron-health');

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isSuperadmin = await verifyRole(auth, 'superadmin');
    if (!isSuperadmin) return forbiddenResponse('Superadmin access required');

    try {
      const hours = Math.max(
        1,
        Math.min(168, parseInt(req.nextUrl.searchParams.get('hours') ?? '24', 10))
      );

      // Query the cron_job_health view (created by migration)
      const healthRows = await db.execute(
        sql`SELECT * FROM public.cron_job_health ORDER BY jobname`
      );

      // Get recent failures
      const failures = await db.execute(
        sql`SELECT * FROM public.get_cron_failures(${hours}) ORDER BY run_time DESC LIMIT 20`
      );

      const jobs = Array.isArray(healthRows) ? healthRows : [];
      const recentFailures = Array.isArray(failures) ? failures : [];

      return NextResponse.json({
        jobs,
        recent_failures: recentFailures,
        healthy: recentFailures.length === 0,
        checked_at: new Date().toISOString(),
      });
    } catch (error) {
      log.error('[CronHealth] Error:', error);
      return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
  });
}
