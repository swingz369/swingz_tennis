/**
 * GET /api/attendance-records/hours-summary?memberId=xxx
 * GET /api/attendance-records/hours-summary?clubId=xxx
 * Returns aggregated attendance and hours summary
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { hoursLogService } from '@/src/application/services/hours-log-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:attendance-records:hours-summary');

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Authentication required');

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const { searchParams } = new URL(request.url);
      const memberId = searchParams.get('memberId');
      const clubId = searchParams.get('clubId');

      if (memberId) {
        // Members can only view their own summary; trainers/admins can view any
        const isOwnData = memberId === auth.user.id;
        const isTrainerOrAdmin = await verifyRole(auth, 'trainer');
        if (!isOwnData && !isTrainerOrAdmin) {
          return forbiddenResponse('Not authorized to view this summary');
        }

        const summary = await hoursLogService.getAttendanceHoursSummaryForMember(memberId);
        if (!summary) {
          return NextResponse.json({ summary: null, message: 'No attendance records found' });
        }
        return NextResponse.json({ summary });
      }

      if (clubId) {
        const isAdmin = await verifyRole(auth, 'admin');
        if (!isAdmin) return forbiddenResponse('Admin access required');

        const summaries = await hoursLogService.getAttendanceHoursSummaryForClub(clubId);
        return NextResponse.json({ summaries });
      }

      // Default: return current user's summary
      const summary = await hoursLogService.getAttendanceHoursSummaryForMember(auth.user.id);
      return NextResponse.json({ summary });
    } catch (error) {
      log.error('Hours summary error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
