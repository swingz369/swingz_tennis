import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { StatisticsService } from '@/src/application/services/statistics.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:statistics:dashboard');

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'trainer');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Trainer');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const statisticsService = new StatisticsService();
      const metrics = await statisticsService.getDashboardMetrics();

      return NextResponse.json(metrics);
    } catch (error) {
      log.error('Error fetching dashboard metrics:', error);
      return NextResponse.json(
        { error: 'Dashboard-Kennzahlen konnten nicht geladen werden' },
        { status: 500 }
      );
    }
  });
}
