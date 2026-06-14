/**
 * POST /api/attendance-records/batch-confirm
 * Trainer batch-confirms attendance records (Stundenbestätigung)
 * Body: { recordIds: string[] }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { hoursLogService } from '@/src/application/services/hours-log-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) return forbiddenResponse('Trainer or admin access required');

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const body = await request.json();
      const { recordIds } = body;

      if (!Array.isArray(recordIds) || recordIds.length === 0) {
        return NextResponse.json({ error: 'recordIds array required' }, { status: 400 });
      }

      if (recordIds.length > 100) {
        return NextResponse.json({ error: 'Maximum 100 records per batch' }, { status: 400 });
      }

      const confirmed = await hoursLogService.batchConfirmAttendance(recordIds, auth.user.id);
      return NextResponse.json({ success: true, confirmed });
    } catch (error) {
      console.error('Batch confirm error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
