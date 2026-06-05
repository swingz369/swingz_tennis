import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { trainerAvailabilityService } from '@/src/application/services/trainer-availability-service.adapter';
import { trainerProfileService } from '@/src/application/services/trainer-profile-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

/**
 * GET /api/trainer-availability
 * Query trainer availability slots. Filterable by trainer_id, start_date, end_date.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
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

      // For trainer role, they can only see their own availability
      if (auth.role === 'trainer') {
        const profile = await trainerProfileService.getTrainerProfileByUserId(auth.user.id);
        if (!profile) {
          return NextResponse.json({ availabilities: [] });
        }
        // Override trainer_id with their own
        const availabilities = await trainerAvailabilityService.queryTrainerAvailabilities({
          trainerId: profile.userId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          status: (status as any) || undefined,
        });
        return NextResponse.json({ availabilities });
      }

      // For admin/superadmin: fetch all trainers in club, then their availabilities
      if (trainerId) {
        const availabilities = await trainerAvailabilityService.queryTrainerAvailabilities({
          trainerId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          status: (status as any) || undefined,
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
      const allAvailabilities = await Promise.all(
        profiles.map((p) =>
          trainerAvailabilityService.queryTrainerAvailabilities({
            trainerId: p.userId,
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
      console.error('Trainer availability GET error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
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
      return forbiddenResponse('Trainer or admin access required');
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
          { error: 'Missing required fields: trainer_id, date, start_time, end_time' },
          { status: 400 }
        );
      }

      // Trainer can only create own availability
      if (auth.role === 'trainer') {
        const profile = await trainerProfileService.getTrainerProfileByUserId(auth.user.id);
        if (!profile || profile.userId !== trainer_id) {
          return forbiddenResponse('You can only create your own availability');
        }
      }

      // Admin: verify the trainer belongs to their club
      if (auth.role !== 'trainer') {
        const clubId = auth.clubId;
        if (clubId) {
          const clubProfiles = await trainerProfileService.getTrainerProfilesByClubId(clubId);
          const isInClub = clubProfiles.some((p) => p.userId === trainer_id);
          if (!isInClub) {
            return NextResponse.json(
              { error: 'Trainer does not belong to your club' },
              { status: 403 }
            );
          }
        }
      }

      const availability = await trainerAvailabilityService.createTrainerAvailability({
        trainerId: trainer_id,
        date,
        startTime: start_time,
        endTime: end_time,
        status: status || 'available',
        notes: notes || undefined,
      });

      return NextResponse.json({ availability }, { status: 201 });
    } catch (error) {
      console.error('Trainer availability POST error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
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
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const searchParams = request.nextUrl.searchParams;
      const availabilityId = searchParams.get('id');

      if (!availabilityId) {
        return NextResponse.json({ error: 'Availability ID required' }, { status: 400 });
      }

      // Look up the availability record
      const availability =
        await trainerAvailabilityService.getTrainerAvailabilityById(availabilityId);
      if (!availability) {
        return NextResponse.json({ error: 'Availability not found' }, { status: 404 });
      }

      // Trainer: can only delete own availability
      if (auth.role === 'trainer') {
        const profile = await trainerProfileService.getTrainerProfileByUserId(auth.user.id);
        if (!profile || profile.userId !== availability.trainerId) {
          return forbiddenResponse('You can only delete your own availability');
        }
      }

      // Admin/Superadmin: verify the availability's trainer belongs to their club
      if (auth.role !== 'trainer') {
        const clubId = auth.clubId;
        if (clubId) {
          const clubProfiles = await trainerProfileService.getTrainerProfilesByClubId(clubId);
          const isInClub = clubProfiles.some((p) => p.userId === availability.trainerId);
          if (!isInClub) {
            return NextResponse.json(
              { error: 'Availability does not belong to your club' },
              { status: 403 }
            );
          }
        }
      }

      await trainerAvailabilityService.deleteTrainerAvailability(availabilityId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Trainer availability DELETE error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
