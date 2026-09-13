import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { withApiAuth, verifyRole, verifyTrainerInClub, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { HourlyRateService } from '@/application/services/hourly-rate.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:hourly-rates:trainers');

const createTrainerRateSchema = z.object({
  trainer_id: z.string().uuid(),
  trainer_name: z.string().min(2),
  base_rate: z.number().nonnegative(),
  override_rate: z.number().nonnegative().optional(),
  valid_from: z.string().date(),
  valid_until: z.string().date().optional(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  return withApiAuth(
    request,
    async (auth, body) => {
      const hasPermission = await verifyRole(auth, 'admin');
      if (!hasPermission) {
        return forbiddenResponse('Zugriff nur für Admins');
      }
      if (!auth.clubId) {
        return errorResponse('VALIDATION_ERROR', 'Kein Verein zugeordnet');
      }
      if (!(await verifyTrainerInClub(auth, body.trainer_id))) {
        return forbiddenResponse('Trainer ist nicht in diesem Verein aktiv');
      }

      const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
      if (rateLimitError) {
        return rateLimitError;
      }

      try {
        const trainerRate = await new HourlyRateService(auth).createTrainerRate(auth.clubId, body);
        return NextResponse.json({ success: true, trainerRate });
      } catch (error) {
        log.error('Trainer hourly rate creation error:', error);
        return internalErrorResponse();
      }
    },
    { body: createTrainerRateSchema }
  );
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }
    if (!auth.clubId) {
      return errorResponse('VALIDATION_ERROR', 'Kein Verein zugeordnet');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(request.url);
      const trainerId = searchParams.get('trainerId');
      const service = new HourlyRateService(auth);

      if (trainerId) {
        const trainerRate = await service.getCurrentTrainerRate(trainerId);
        return NextResponse.json({ trainerRate });
      }

      const trainerRates = await service.listTrainerRates(auth.clubId);
      return NextResponse.json({ trainerRates });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Trainer hourly rate fetch error:', error);
      return internalErrorResponse();
    }
  });
}
