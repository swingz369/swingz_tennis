import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { TrainerAvailabilityService } from '@/application/services/trainer-availability.service';
import { trainerProfileService } from '@/src/application/services/trainer-profile-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { resolveTrainerRecordId, resolveTrainerRecordIds } from '@/lib/trainers/trainer-record';

const log = createLogger('api:trainer-availability');

/**
 * GET /api/trainer-availability
 * Query trainer availability slots. Filterable by trainer_id, start_date, end_date.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const searchParams = request.nextUrl.searchParams;
      const trainerId = searchParams.get('trainer_id');
      const startDate = searchParams.get('start_date');
      const endDate = searchParams.get('end_date');
      const status = searchParams.get('status');
      const service = new TrainerAvailabilityService(auth);

      // For trainer role, they can only see their own availability
      if (auth.role === 'trainer') {
        // trainer_availabilities.trainer_id ist ein FK auf trainers.id — nicht auf
        // users.id. Vorher stand hier profile.userId; für die 35 von 65 Trainern
        // mit abweichender trainers.id fand die Abfrage nie etwas.
        const ownTrainerId = await resolveTrainerRecordId(auth.user.id);
        if (!ownTrainerId) {
          return NextResponse.json({ availabilities: [] });
        }
        const availabilities = await service.queryTrainerAvailabilities({
          trainerId: ownTrainerId,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
          ...(status ? { status: status as any } : {}),
        });
        return NextResponse.json({ availabilities });
      }

      // For admin/superadmin: fetch all trainers in club, then their availabilities
      if (trainerId) {
        // Die Oberfläche schickt die User-ID des Trainers; aufgelöst wird auf die
        // trainers.id, auf die der Fremdschlüssel zeigt.
        const recordId = (await resolveTrainerRecordId(trainerId)) ?? trainerId;
        const availabilities = await service.queryTrainerAvailabilities({
          trainerId: recordId,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
          ...(status ? { status: status as any } : {}),
        });
        return NextResponse.json({ availabilities });
      }

      // Use the resolved club from auth context (deterministic, cookie-aware)
      const clubId = auth.clubId;
      if (!clubId) {
        return NextResponse.json({ availabilities: [] });
      }

      const profiles = await trainerProfileService.getTrainerProfilesByClubId(clubId);
      if (profiles.length === 0) {
        return NextResponse.json({ availabilities: [] });
      }

      // Collect availabilities for all trainers in the club
      const recordIds = await resolveTrainerRecordIds(profiles.map((p) => p.userId));
      const allAvailabilities = await Promise.all(
        [...recordIds.values()].map((recordId) =>
          service.queryTrainerAvailabilities({
            trainerId: recordId,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            status: (status as any) || undefined,
          })
        )
      );

      return NextResponse.json({
        availabilities: allAvailabilities.flat(),
      });
    } catch (error) {
      log.error('Trainer availability GET error:', error);
      return internalErrorResponse();
    }
  });
}

/**
 * POST /api/trainer-availability
 * Create a new trainer availability slot.
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await request.json();
      const { trainer_id, date, start_time, end_time, status, notes } = body;

      if (!trainer_id || !date || !start_time || !end_time) {
        return NextResponse.json(
          { error: 'Pflichtfelder fehlen: trainer_id, date, start_time, end_time' },
          { status: 400 }
        );
      }

      // `trainer_id` kommt als User-ID aus der Oberfläche; gespeichert wird die
      // trainers.id, auf die der Fremdschlüssel zeigt.
      const targetRecordId = await resolveTrainerRecordId(trainer_id);
      if (!targetRecordId) {
        return NextResponse.json({ error: 'Kein Trainerdatensatz gefunden' }, { status: 404 });
      }

      // Trainer can only create own availability
      if (auth.role === 'trainer') {
        const ownRecordId = await resolveTrainerRecordId(auth.user.id);
        if (!ownRecordId || ownRecordId !== targetRecordId) {
          return forbiddenResponse('Du kannst nur deine eigene Verfügbarkeit anlegen');
        }
      }

      // Admin: verify the trainer belongs to their club
      if (auth.role !== 'trainer') {
        const clubId = auth.clubId;
        if (clubId) {
          const clubProfiles = await trainerProfileService.getTrainerProfilesByClubId(clubId);
          const clubRecordIds = await resolveTrainerRecordIds(clubProfiles.map((p) => p.userId));
          const isInClub = [...clubRecordIds.values()].includes(targetRecordId);
          if (!isInClub) {
            return NextResponse.json(
              { error: 'Trainer gehört nicht zu deinem Verein' },
              { status: 403 }
            );
          }
        }
      }

      const availability = await new TrainerAvailabilityService(auth).createTrainerAvailability({
        trainerId: targetRecordId,
        date,
        startTime: start_time,
        endTime: end_time,
        status: status || 'available',
        notes: notes || undefined,
      });

      return NextResponse.json({ availability }, { status: 201 });
    } catch (error) {
      log.error('Trainer availability POST error:', error);
      return internalErrorResponse();
    }
  });
}

/**
 * DELETE /api/trainer-availability?id=...
 * Delete a trainer availability slot.
 */
export async function DELETE(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const searchParams = request.nextUrl.searchParams;
      const availabilityId = searchParams.get('id');

      if (!availabilityId) {
        return NextResponse.json({ error: 'Verfügbarkeits-ID erforderlich' }, { status: 400 });
      }

      const service = new TrainerAvailabilityService(auth);

      // Look up the availability record
      let availability;
      try {
        availability = await service.getTrainerAvailabilityById(availabilityId);
      } catch (error) {
        if (error instanceof ApiException) {
          return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
        }
        throw error;
      }

      // Trainer: can only delete own availability. availability.trainer_id ist eine
      // trainers.id — verglichen wird deshalb mit der aufgelösten eigenen ID.
      if (auth.role === 'trainer') {
        const ownRecordId = await resolveTrainerRecordId(auth.user.id);
        if (!ownRecordId || ownRecordId !== availability.trainer_id) {
          return forbiddenResponse('Du kannst nur deine eigene Verfügbarkeit löschen');
        }
      }

      // Admin/Superadmin: verify the availability's trainer belongs to their club
      if (auth.role !== 'trainer') {
        const clubId = auth.clubId;
        if (clubId) {
          const clubProfiles = await trainerProfileService.getTrainerProfilesByClubId(clubId);
          const clubRecordIds = await resolveTrainerRecordIds(clubProfiles.map((p) => p.userId));
          const isInClub = [...clubRecordIds.values()].includes(availability.trainer_id);
          if (!isInClub) {
            return NextResponse.json(
              { error: 'Verfügbarkeit gehört nicht zu deinem Verein' },
              { status: 403 }
            );
          }
        }
      }

      await service.deleteTrainerAvailability(availabilityId);
      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('Trainer availability DELETE error:', error);
      return internalErrorResponse();
    }
  });
}
