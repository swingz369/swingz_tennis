import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { TrainerAvailabilityService } from '@/application/services/trainer-availability.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { resolveTrainerRecordId } from '@/lib/trainers/trainer-record';

const log = createLogger('api:trainer-availability:[id]');

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      const { id } = await params;
      const availability = await new TrainerAvailabilityService(auth).getTrainerAvailabilityById(
        id
      );
      return NextResponse.json({ availability });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Trainer availability fetch error:', error);
      return internalErrorResponse();
    }
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    const isTrainer = await verifyRole(auth, 'trainer');

    if (!isAdmin && !isTrainer) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const service = new TrainerAvailabilityService(auth);

      if (!isAdmin) {
        const availability = await service.getTrainerAvailabilityById(id).catch(() => null);
        const ownRecordId = await resolveTrainerRecordId(auth.user.id);
        if (!availability || !ownRecordId || availability.trainer_id !== ownRecordId) {
          return forbiddenResponse('Du kannst nur deine eigene Verfügbarkeit bearbeiten');
        }
      }

      const body = await request.json();
      const { date, startTime, endTime, status, notes } = body;

      const updated = await service.updateTrainerAvailability(id, {
        date,
        startTime,
        endTime,
        status,
        notes,
      });

      return NextResponse.json({ success: true, availability: updated });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Trainer availability update error:', error);
      return internalErrorResponse();
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    const isTrainer = await verifyRole(auth, 'trainer');

    if (!isAdmin && !isTrainer) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const service = new TrainerAvailabilityService(auth);

      if (!isAdmin) {
        const availability = await service.getTrainerAvailabilityById(id).catch(() => null);
        const ownRecordId = await resolveTrainerRecordId(auth.user.id);
        if (!availability || !ownRecordId || availability.trainer_id !== ownRecordId) {
          return forbiddenResponse('Du kannst nur deine eigene Verfügbarkeit löschen');
        }
      }

      await service.deleteTrainerAvailability(id);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Trainer availability delete error:', error);
      return internalErrorResponse();
    }
  });
}
