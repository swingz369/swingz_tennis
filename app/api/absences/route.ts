import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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
import { CreateAbsenceSchema } from '@/lib/validation-schemas';

const log = createLogger('api:absences');

export async function POST(request: NextRequest) {
  return withApiAuth(
    request,
    async (auth, body) => {
      // Only trainers and admins can create absences
      const hasPermission = await verifyRole(auth, 'trainer');
      if (!hasPermission) {
        return forbiddenResponse('Zugriff nur für Trainer oder Admins');
      }

      const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
      if (rateLimitError) {
        return rateLimitError;
      }

      if (!auth.clubId) {
        return NextResponse.json({ error: 'Kein Club-Kontext ausgewählt' }, { status: 400 });
      }

      try {
        const absence = await new AbsenceService(auth).createAbsence(body, auth.clubId);
        return NextResponse.json({ success: true, absence });
      } catch (error) {
        if (error instanceof ApiException) {
          return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
        }
        log.error('Absence creation error:', error);
        return internalErrorResponse();
      }
    },
    { body: CreateAbsenceSchema }
  );
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    // Members can view absences
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    if (!auth.clubId) {
      return NextResponse.json({ absences: [] });
    }
    const clubId = auth.clubId;

    try {
      const { searchParams } = new URL(request.url);
      const trainerId = searchParams.get('trainerId');
      const status = searchParams.get('status');
      const type = searchParams.get('type');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const active = searchParams.get('active');
      const service = new AbsenceService(auth);

      if (active) {
        const today = new Date().toISOString().split('T')[0];
        const absences = await service.getActiveAbsencesForDate(today, clubId);
        return NextResponse.json({ absences });
      }

      if (trainerId) {
        const absences = await service.getAbsencesByTrainerId(trainerId, clubId);
        return NextResponse.json({ absences });
      }

      if (status) {
        const absences = await service.getAbsencesByStatus(
          status as 'pending' | 'approved' | 'rejected',
          clubId
        );
        return NextResponse.json({ absences });
      }

      if (type) {
        const absences = await service.getAbsencesByType(
          type as 'sick' | 'vacation' | 'personal' | 'other',
          clubId
        );
        return NextResponse.json({ absences });
      }

      if (startDate && endDate) {
        const absences = await service.getAbsencesByDateRange(startDate, endDate, clubId);
        return NextResponse.json({ absences });
      }

      // Get all absences, scoped to the caller's active club
      const absences = await service.getAllAbsences(clubId);
      return NextResponse.json({ absences });
    } catch (error) {
      log.error('Absence fetch error:', error);
      return internalErrorResponse();
    }
  });
}
