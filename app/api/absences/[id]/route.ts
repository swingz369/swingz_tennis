import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { absenceService } from '@/src/application/services/absence-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:absences:[id]');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Absence not found' }, { status: 404 });
    }

    try {
      const { id } = await params;
      const absence = await absenceService.getAbsenceById(id, auth.clubId);

      if (!absence) {
        return NextResponse.json({ error: 'Absence not found' }, { status: 404 });
      }

      return NextResponse.json({ absence });
    } catch (error) {
      log.error('Absence fetch error:', error);
      return internalErrorResponse();
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    // Only trainers and admins can update absences
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Absence not found' }, { status: 404 });
    }

    try {
      const { id } = await params;
      const body = await _request.json();

      const { type, startDate, endDate, status, reason, notes } = body;

      const updated = await absenceService.updateAbsence(
        id,
        {
          type,
          startDate,
          endDate,
          status,
          reason,
          notes,
        },
        auth.clubId
      );

      if (!updated) {
        return NextResponse.json({ error: 'Absence not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, absence: updated });
    } catch (error) {
      log.error('Absence update error:', error);
      return internalErrorResponse();
    }
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    // Only admins can delete absences
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Absence not found' }, { status: 404 });
    }

    try {
      const { id } = await params;
      const success = await absenceService.deleteAbsence(id, auth.clubId);

      if (!success) {
        return NextResponse.json({ error: 'Absence not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('Absence delete error:', error);
      return internalErrorResponse();
    }
  });
}
