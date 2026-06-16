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
import { hoursLogService } from '@/src/application/services/hours-log-service.adapter';
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

      // Admin dispute resolution
      if (isResolve) {
        const isAdmin = await verifyRole(auth, 'admin');
        if (!isAdmin) return forbiddenResponse('Admin access required');

        const { resolution } = body;
        if (!resolution || !['confirmed', 'absent'].includes(resolution)) {
          return NextResponse.json(
            { error: 'resolution must be "confirmed" or "absent"' },
            { status: 400 }
          );
        }

        const updated = await hoursLogService.resolveAttendanceDispute(
          id,
          auth.user.id,
          resolution
        );
        if (!updated) {
          return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, record: updated });
      }

      // Member confirm/dispute
      const { action, reason } = body;
      if (!action || !['confirm', 'dispute'].includes(action)) {
        return NextResponse.json(
          { error: 'action must be "confirm" or "dispute"' },
          { status: 400 }
        );
      }

      if (action === 'dispute' && (!reason || reason.trim().length < 3)) {
        return NextResponse.json(
          { error: 'Dispute requires a reason (min 3 characters)' },
          { status: 400 }
        );
      }

      let record;
      if (action === 'confirm') {
        record = await hoursLogService.memberConfirmAttendance(id, auth.user.id);
      } else {
        record = await hoursLogService.memberDisputeAttendance(id, auth.user.id, reason);
      }

      if (!record) {
        return NextResponse.json({ error: 'Record not found or not authorized' }, { status: 404 });
      }

      return NextResponse.json({ success: true, record });
    } catch (error) {
      log.error('Member confirm error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
