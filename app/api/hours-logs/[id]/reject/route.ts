import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, verifyTrainerInClub, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { ApiException, errorResponse, safeErrorMessage } from '@/lib/api-error';
import { HoursLogService } from '@/application/services/hours-log.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:hours-logs:[id]:reject');

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Only admin and superadmin can reject
    const isAdmin = await verifyRole(auth, 'admin');
    const isSuperadmin = await verifyRole(auth, 'superadmin');

    if (!isAdmin && !isSuperadmin) {
      return forbiddenResponse('Admin oder Superadmin Zugriff erforderlich');
    }

    // Apply rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const body = await _request.json();
      const { reason } = body;

      if (!reason) {
        return NextResponse.json(
          { success: false, error: 'Ablehnungsgrund erforderlich' },
          { status: 400 }
        );
      }

      const service = new HoursLogService(auth);
      const existing = await service.getHoursLogById(id);
      if (!(await verifyTrainerInClub(auth, existing.trainer_id))) {
        return NextResponse.json(
          { success: false, error: 'Stundennachweis nicht gefunden' },
          { status: 404 }
        );
      }

      const hoursLog = await service.rejectHoursLog(id, auth.user.id, reason);

      return NextResponse.json({
        success: true,
        hoursLog,
        message: 'Stundennachweis abgelehnt',
      });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Reject hours log error:', error);
      return NextResponse.json(
        { success: false, error: 'Fehler bei der Ablehnung' },
        { status: 500 }
      );
    }
  });
}
