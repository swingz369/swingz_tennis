import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { AbsenceService } from '@/application/services/absence.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:absences:[id]:approve');

const approveSchema = z.object({
  approvedBy: z.string().min(1, 'Approved by is required'),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(
    request,
    async (auth, body) => {
      // Only admins can approve absences
      const hasPermission = await verifyRole(auth, 'admin');
      if (!hasPermission) {
        return forbiddenResponse('Zugriff nur für Admins');
      }

      const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
      if (rateLimitError) {
        return rateLimitError;
      }

      if (!auth.clubId) {
        return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 });
      }

      try {
        const { id } = await params;
        const service = new AbsenceService(auth);
        const updated = await service.approveAbsence(id, body.approvedBy, auth.clubId);
        const sessionConflicts = await service.findSessionConflicts(
          updated.trainer_id,
          updated.start_date,
          updated.end_date
        );
        return NextResponse.json({ success: true, absence: updated, sessionConflicts });
      } catch (error) {
        if (error instanceof ApiException) {
          return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
        }
        log.error('Absence approval error:', error);
        return internalErrorResponse();
      }
    },
    { body: approveSchema }
  );
}
