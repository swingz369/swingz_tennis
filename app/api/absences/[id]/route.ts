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
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:absences:[id]');

const updateAbsenceSchema = z.object({
  type: z.enum(['sick', 'vacation', 'personal', 'other']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 });
    }

    try {
      const { id } = await params;
      const absence = await new AbsenceService(auth).getAbsenceById(id, auth.clubId);
      return NextResponse.json({ absence });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Absence fetch error:', error);
      return internalErrorResponse();
    }
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(
    request,
    async (auth, body) => {
      // Only trainers and admins can update absences
      const hasPermission = await verifyRole(auth, 'trainer');
      if (!hasPermission) {
        return forbiddenResponse('Zugriff nur für Trainer oder Admins');
      }

      const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
      if (rateLimitError) {
        return rateLimitError;
      }

      if (!auth.clubId) {
        return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 });
      }

      try {
        const { id } = await params;
        const updated = await new AbsenceService(auth).updateAbsence(id, body, auth.clubId);
        return NextResponse.json({ success: true, absence: updated });
      } catch (error) {
        if (error instanceof ApiException) {
          return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
        }
        log.error('Absence update error:', error);
        return internalErrorResponse();
      }
    },
    { body: updateAbsenceSchema }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(request, async (auth) => {
    // Only admins can delete absences
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
      await new AbsenceService(auth).deleteAbsence(id, auth.clubId);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Absence delete error:', error);
      return internalErrorResponse();
    }
  });
}
