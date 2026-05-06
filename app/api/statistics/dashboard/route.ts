import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { StatisticsService } from '@/src/application/services/statistics.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'trainer');
    if (!hasRole) {
      return forbiddenResponse('Trainer access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const statisticsService = new StatisticsService();
      const metrics = await statisticsService.getDashboardMetrics();

      return NextResponse.json(metrics);
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      return NextResponse.json({ error: 'Failed to fetch dashboard metrics' }, { status: 500 });
    }
  });
}
