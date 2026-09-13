/**
 * GET /api/attendance-records/hours-summary?memberId=xxx
 * GET /api/attendance-records/hours-summary?clubId=xxx
 * Returns aggregated attendance and hours summary
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { AttendanceRecordService } from '@/application/services/attendance-record.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:attendance-records:hours-summary');

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const { searchParams } = new URL(request.url);
      const memberId = searchParams.get('memberId');
      const clubId = searchParams.get('clubId');
      const service = new AttendanceRecordService(auth);

      if (memberId) {
        // Members can only view their own summary; trainers/admins can view any
        const isOwnData = memberId === auth.user.id;
        const isTrainerOrAdmin = await verifyRole(auth, 'trainer');
        if (!isOwnData && !isTrainerOrAdmin) {
          return forbiddenResponse('Keine Berechtigung für diese Übersicht');
        }

        const summary = await service.getAttendanceHoursSummaryForMember(memberId);
        if (!summary) {
          return NextResponse.json({
            summary: null,
            message: 'Keine Anwesenheitseinträge gefunden',
          });
        }
        return NextResponse.json({ summary });
      }

      if (clubId) {
        const isAdmin = await verifyRole(auth, 'admin');
        if (!isAdmin) return forbiddenResponse('Zugriff nur für Admins');

        const summaries = await service.getAttendanceHoursSummaryForClub(clubId);
        return NextResponse.json({ summaries });
      }

      // Default: return current user's summary
      const summary = await service.getAttendanceHoursSummaryForMember(auth.user.id);
      return NextResponse.json({ summary });
    } catch (error) {
      log.error('Hours summary error:', error);
      return internalErrorResponse();
    }
  });
}
