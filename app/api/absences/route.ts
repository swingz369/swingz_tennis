import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { absenceService } from '@/src/application/services/absence-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:absences');

import {
  CreateAbsenceSchema,
  validateRequestBody,
  formatValidationErrors,
} from '@/lib/validation-schemas';

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    // Only trainers and admins can create absences
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Club-Kontext ausgewählt' }, { status: 400 });
    }

    try {
      const body = await request.json();

      // Validate request body with Zod
      const validation = validateRequestBody(CreateAbsenceSchema, body);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: formatValidationErrors((validation as any).errors),
          },
          { status: 400 }
        );
      }

      const absence = await absenceService.createAbsence(validation.data as any, auth.clubId);

      return NextResponse.json({ success: true, absence });
    } catch (error) {
      log.error('Absence creation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    // Members can view absences
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
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

      if (active) {
        const today = new Date().toISOString().split('T')[0];
        const absences = await absenceService.getActiveAbsencesForDate(today, clubId);
        return NextResponse.json({ absences });
      }

      if (trainerId) {
        const absences = await absenceService.getAbsencesByTrainerId(trainerId, clubId);
        return NextResponse.json({ absences });
      }

      if (status) {
        const absences = await absenceService.getAbsencesByStatus(
          status as 'pending' | 'approved' | 'rejected',
          clubId
        );
        return NextResponse.json({ absences });
      }

      if (type) {
        const absences = await absenceService.getAbsencesByType(
          type as 'sick' | 'vacation' | 'personal' | 'other',
          clubId
        );
        return NextResponse.json({ absences });
      }

      if (startDate && endDate) {
        const absences = await absenceService.getAbsencesByDateRange(startDate, endDate, clubId);
        return NextResponse.json({ absences });
      }

      // Get all absences, scoped to the caller's active club
      const absences = await absenceService.getAllAbsences(clubId);
      return NextResponse.json({ absences });
    } catch (error) {
      log.error('Absence fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
