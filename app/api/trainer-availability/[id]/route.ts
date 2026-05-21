import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { trainerAvailabilityService } from '@/src/application/services/trainer-availability-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const availability = await trainerAvailabilityService.getTrainerAvailabilityById(id);

      if (!availability) {
        return NextResponse.json({ error: 'Trainer availability not found' }, { status: 404 });
      }

      return NextResponse.json({ availability });
    } catch (error) {
      console.error('Trainer availability fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    const isTrainer = await verifyRole(auth, 'trainer');

    if (!isAdmin && !isTrainer) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;

      if (!isAdmin) {
        const availability = await trainerAvailabilityService.getTrainerAvailabilityById(id);
        if (!availability || availability.trainerId !== auth.user.id) {
          return forbiddenResponse('You can only edit your own availability');
        }
      }

      const body = await _request.json();

      const { date, startTime, endTime, status, notes } = body;

      const updated = await trainerAvailabilityService.updateTrainerAvailability(id, {
        date,
        startTime,
        endTime,
        status,
        notes,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Trainer availability not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, availability: updated });
    } catch (error) {
      console.error('Trainer availability update error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    const isTrainer = await verifyRole(auth, 'trainer');

    if (!isAdmin && !isTrainer) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;

      if (!isAdmin) {
        const availability = await trainerAvailabilityService.getTrainerAvailabilityById(id);
        if (!availability || availability.trainerId !== auth.user.id) {
          return forbiddenResponse('You can only delete your own availability');
        }
      }

      const success = await trainerAvailabilityService.deleteTrainerAvailability(id);

      if (!success) {
        return NextResponse.json({ error: 'Trainer availability not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Trainer availability delete error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
