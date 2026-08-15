import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { absenceService } from '@/src/application/services/absence-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:absences:[id]:reject');

const rejectSchema = z.object({
  rejectedBy: z.string().min(1, 'Rejected by is required'),
  reason: z.string().optional(),
});

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Only admins can reject absences
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 });
    }

    try {
      const { id } = await params;
      const body = await _request.json();

      const validation = rejectSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validierung fehlgeschlagen', details: validation.error.issues },
          { status: 400 }
        );
      }

      const updated = await absenceService.rejectAbsence(
        id,
        validation.data.rejectedBy,
        auth.clubId
      );

      if (!updated) {
        return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 });
      }

      return NextResponse.json({ success: true, absence: updated });
    } catch (error) {
      log.error('Absence rejection error:', error);
      return internalErrorResponse();
    }
  });
}
