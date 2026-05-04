import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { TrainerAvailabilityService } from '@/src/application/services/trainer-availability.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();

      const { trainerId, date, startTime, endTime, status, notes, recurringPattern } = body;

      if (!trainerId || !date || !startTime || !endTime) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const isAdmin = await verifyRole(auth, 'admin');
      if (!isAdmin && trainerId !== auth.user.id) {
        return forbiddenResponse('You can only create your own availability');
      }

      const availability = await TrainerAvailabilityService.createTrainerAvailability({
        trainerId,
        date,
        startTime,
        endTime,
        status,
        notes,
        recurringPattern,
      });

      return NextResponse.json({ success: true, availability });
    } catch (error) {
      console.error('Trainer availability creation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const trainerId = searchParams.get('trainerId');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const status = searchParams.get('status');
      const available = searchParams.get('available');
      const startTime = searchParams.get('startTime');
      const endTime = searchParams.get('endTime');

      if (available && startDate && startTime && endTime) {
        const availableTrainers = await TrainerAvailabilityService.getAvailableTrainers(
          startDate,
          startTime,
          endTime
        );
        return NextResponse.json({ availableTrainers });
      }

      if (trainerId) {
        const availabilities =
          await TrainerAvailabilityService.getTrainerAvailabilitiesByTrainerId(trainerId);
        return NextResponse.json({ availabilities });
      }

      const query: any = {};
      if (startDate) query.startDate = startDate;
      if (endDate) query.endDate = endDate;
      if (status) query.status = status;

      const availabilities = await TrainerAvailabilityService.queryTrainerAvailabilities(query);
      return NextResponse.json({ availabilities });
    } catch (error) {
      console.error('Trainer availability fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
