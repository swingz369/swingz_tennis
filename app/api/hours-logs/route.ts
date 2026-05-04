import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { HoursLogService } from '@/src/application/services/hours-log.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

// Schema for validation - kept for future use
// const createHoursLogSchema = z.object({...})

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Verify trainer or admin role
    const hasRole = await verifyRole(auth, 'trainer');
    if (!hasRole) {
      return forbiddenResponse('Trainer or admin access required');
    }

    // Apply rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const trainerId = searchParams.get('trainerId');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const status = searchParams.get('status');
      const summary = searchParams.get('summary');

      if (summary) {
        if (trainerId) {
          const summary = await HoursLogService.getHoursSummaryForTrainer(trainerId);
          return NextResponse.json({ summary });
        }
        const summaries = await HoursLogService.getAllHoursSummaries();
        return NextResponse.json({ summaries });
      }

      if (trainerId) {
        const hoursLogs = await HoursLogService.getHoursLogsByTrainerId(trainerId);
        return NextResponse.json({ hoursLogs });
      }

      if (status) {
        const hoursLogs = await HoursLogService.getHoursLogsByStatus(
          status as 'pending' | 'approved' | 'rejected'
        );
        return NextResponse.json({ hoursLogs });
      }

      if (startDate && endDate) {
        const hoursLogs = await HoursLogService.getHoursLogsByDateRange(startDate, endDate);
        return NextResponse.json({ hoursLogs });
      }

      // Get all hours logs
      const hoursLogs = await HoursLogService.getAllHoursLogs();
      return NextResponse.json({ hoursLogs });
    } catch (error) {
      console.error('Hours log fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
