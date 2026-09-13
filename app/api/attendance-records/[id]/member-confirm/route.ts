/**
 * PATCH /api/attendance-records/[id]/member-confirm
 * Member confirms or disputes their attendance record
 * Body: { action: 'confirm' | 'dispute', reason?: string }
 *
 * PATCH /api/attendance-records/[id]/member-confirm?resolve=true
 * Admin resolves a dispute
 * Body: { resolution: 'confirmed' | 'absent' }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { AttendanceRecordService } from '@/application/services/attendance-record.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:attendance-records:[id]:member-confirm');

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const { id } = await params;
      const body = await request.json();
      const url = new URL(request.url);
      const isResolve = url.searchParams.get('resolve') === 'true';
      const service = new AttendanceRecordService(auth);

      // Admin dispute resolution
      if (isResolve) {
        const isAdmin = await verifyRole(auth, 'admin');
        if (!isAdmin) return forbiddenResponse('Zugriff nur für Admins');

        const { resolution } = body;
        if (!resolution || !['confirmed', 'absent'].includes(resolution)) {
          return NextResponse.json(
            { error: 'resolution muss "confirmed" oder "absent" sein' },
            { status: 400 }
          );
        }

        const updated = await service.resolveAttendanceDispute(id, auth.user.id, resolution);
        return NextResponse.json({ success: true, record: updated });
      }

      // Member confirm/dispute
      const { action, reason } = body;
      if (!action || !['confirm', 'dispute'].includes(action)) {
        return NextResponse.json(
          { error: 'action muss "confirm" oder "dispute" sein' },
          { status: 400 }
        );
      }

      if (action === 'dispute' && (!reason || reason.trim().length < 3)) {
        return NextResponse.json(
          { error: 'Ein Einspruch benötigt einen Grund (mind. 3 Zeichen)' },
          { status: 400 }
        );
      }

      const record =
        action === 'confirm'
          ? await service.memberConfirmAttendance(id, auth.user.id)
          : await service.memberDisputeAttendance(id, auth.user.id, reason);

      return NextResponse.json({ success: true, record });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Member confirm error:', error);
      return internalErrorResponse();
    }
  });
}
