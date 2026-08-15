import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { absenceService } from '@/src/application/services/absence-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:absences:[id]:approve');

const approveSchema = z.object({
  approvedBy: z.string().min(1, 'Approved by is required'),
});

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Only admins can approve absences
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

      const validation = approveSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validierung fehlgeschlagen', details: validation.error.issues },
          { status: 400 }
        );
      }

      const updated = await absenceService.approveAbsence(
        id,
        validation.data.approvedBy,
        auth.clubId
      );

      if (!updated) {
        return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 });
      }

      const sessionConflicts = await absenceService.findSessionConflicts(
        updated.trainerId,
        updated.startDate,
        updated.endDate
      );

      return NextResponse.json({ success: true, absence: updated, sessionConflicts });
    } catch (error) {
      log.error('Absence approval error:', error);
      return internalErrorResponse();
    }
  });
}
