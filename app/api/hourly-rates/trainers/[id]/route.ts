import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { HourlyRateService } from '@/application/services/hourly-rate.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:hourly-rates:trainers:[id]');

const updateTrainerRateSchema = z.object({
  override_rate: z.number().nonnegative().optional(),
  valid_until: z.string().date().optional(),
  reason: z.string().optional(),
});

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
      const trainerRate = await new HourlyRateService(auth).getTrainerRateById(id);
      return NextResponse.json({ trainerRate });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Trainer hourly rate fetch error:', error);
      return internalErrorResponse();
    }
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(
    request,
    async (auth, body) => {
      const hasPermission = await verifyRole(auth, 'admin');
      if (!hasPermission) {
        return forbiddenResponse('Zugriff nur für Admins');
      }

      const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
      if (rateLimitError) {
        return rateLimitError;
      }

      try {
        const { id } = await params;
        const changedBy = auth.user.email ?? auth.user.id;
        const trainerRate = await new HourlyRateService(auth).updateTrainerRate(
          id,
          changedBy,
          body
        );
        return NextResponse.json({ success: true, trainerRate });
      } catch (error) {
        if (error instanceof ApiException) {
          return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
        }
        log.error('Trainer hourly rate update error:', error);
        return internalErrorResponse();
      }
    },
    { body: updateTrainerRateSchema }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      await new HourlyRateService(auth).deleteTrainerRate(id);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Trainer hourly rate delete error:', error);
      return internalErrorResponse();
    }
  });
}
