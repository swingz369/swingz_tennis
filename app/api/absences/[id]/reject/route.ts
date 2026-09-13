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

const log = createLogger('api:absences:[id]:reject');

const rejectSchema = z.object({
  rejectedBy: z.string().min(1, 'Rejected by is required'),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(
    request,
    async (auth, body) => {
      // Only admins can reject absences
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
        const updated = await new AbsenceService(auth).rejectAbsence(
          id,
          body.rejectedBy,
          auth.clubId,
          body.reason
        );
        return NextResponse.json({ success: true, absence: updated });
      } catch (error) {
        if (error instanceof ApiException) {
          return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
        }
        log.error('Absence rejection error:', error);
        return internalErrorResponse();
      }
    },
    { body: rejectSchema }
  );
}
