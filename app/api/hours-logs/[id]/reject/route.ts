import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, verifyTrainerInClub, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { hoursLogService } from '@/src/application/services/hours-log-service.adapter';
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

      const existing = await hoursLogService.getHoursLogById(id);
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Stundennachweis nicht gefunden' },
          { status: 404 }
        );
      }
      if (!(await verifyTrainerInClub(auth, existing.trainerId))) {
        return NextResponse.json(
          { success: false, error: 'Stundennachweis nicht gefunden' },
          { status: 404 }
        );
      }

      const hoursLog = await hoursLogService.rejectHoursLog(id, auth.user.id, reason);

      return NextResponse.json({
        success: true,
        hoursLog,
        message: 'Stundennachweis abgelehnt',
      });
    } catch (error) {
      log.error('Reject hours log error:', error);
      return NextResponse.json(
        { success: false, error: 'Fehler bei der Ablehnung' },
        { status: 500 }
      );
    }
  });
}
