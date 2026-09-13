/**
 * POST /api/attendance-records/batch-confirm
 * Trainer batch-confirms attendance records (Stundenbestätigung)
 * Body: { recordIds: string[] }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { AttendanceRecordService } from '@/application/services/attendance-record.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:attendance-records:batch-confirm');

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) return forbiddenResponse('Zugriff nur für Trainer oder Admins');

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const body = await request.json();
      const { recordIds } = body;

      if (!Array.isArray(recordIds) || recordIds.length === 0) {
        return NextResponse.json({ error: 'recordIds-Array erforderlich' }, { status: 400 });
      }

      if (recordIds.length > 100) {
        return NextResponse.json({ error: 'Maximal 100 Datensätze pro Batch' }, { status: 400 });
      }

      const confirmed = await new AttendanceRecordService(auth).batchConfirmAttendance(recordIds);
      return NextResponse.json({ success: true, confirmed });
    } catch (error) {
      log.error('Batch confirm error:', error);
      return internalErrorResponse();
    }
  });
}
