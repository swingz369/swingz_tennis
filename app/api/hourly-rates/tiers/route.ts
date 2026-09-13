import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { HourlyRateService } from '@/application/services/hourly-rate.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:hourly-rates:tiers');

const createTierSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  base_rate: z.number().nonnegative(),
  training_types: z.array(z.string()).min(1),
  experience_level: z.enum(['beginner', 'intermediate', 'advanced', 'professional']),
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

      const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
      if (rateLimitError) {
        return rateLimitError;
      }

      try {
        const rateTier = await new HourlyRateService(auth).createTier(auth.clubId, body);
        return NextResponse.json({ success: true, rateTier });
      } catch (error) {
        log.error('Hourly rate tier creation error:', error);
        return internalErrorResponse();
      }
    },
    { body: createTierSchema }
  );
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
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
      const activeOnly = searchParams.get('active') === 'true';
      const rateTiers = await new HourlyRateService(auth).listTiers(auth.clubId, activeOnly);
      return NextResponse.json({ rateTiers });
    } catch (error) {
      log.error('Hourly rate tier fetch error:', error);
      return internalErrorResponse();
    }
  });
}
