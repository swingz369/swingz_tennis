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

const log = createLogger('api:hourly-rates:tiers:[id]');

const updateTierSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  base_rate: z.number().nonnegative().optional(),
  training_types: z.array(z.string()).min(1).optional(),
  experience_level: z.enum(['beginner', 'intermediate', 'advanced', 'professional']).optional(),
  is_active: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const rateTier = await new HourlyRateService(auth).getTierById(id);
      return NextResponse.json({ rateTier });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Hourly rate tier fetch error:', error);
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
        const rateTier = await new HourlyRateService(auth).updateTier(id, body);
        return NextResponse.json({ success: true, rateTier });
      } catch (error) {
        if (error instanceof ApiException) {
          return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
        }
        log.error('Hourly rate tier update error:', error);
        return internalErrorResponse();
      }
    },
    { body: updateTierSchema }
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
      await new HourlyRateService(auth).deleteTier(id);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Hourly rate tier delete error:', error);
      return internalErrorResponse();
    }
  });
}
