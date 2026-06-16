import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { StatisticsService } from '@/src/application/services/statistics.service';
import { withApiAuth } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:statistics');

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (_auth) => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const period = (searchParams.get('period') || 'monthly') as
        | 'daily'
        | 'weekly'
        | 'monthly'
        | 'yearly';
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      const statisticsService = new StatisticsService();

      const start = startDate
        ? new Date(startDate)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = endDate ? new Date(endDate) : new Date();

      // Filter statistics by club
      const statistics = await statisticsService.generateStatistics(period, start, end);

      return NextResponse.json(statistics);
    } catch (error) {
      log.error('Error generating statistics:', error);
      return NextResponse.json({ error: 'Failed to generate statistics' }, { status: 500 });
    }
  });
}
