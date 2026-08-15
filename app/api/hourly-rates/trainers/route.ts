import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { hourlyRateService } from '@/src/application/services/hourly-rate-service.adapter';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:hourly-rates:trainers');

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();

      const { trainerId, trainerName, baseRate, overrideRate, validFrom, validUntil, reason } =
        body;

      if (!trainerId || !trainerName || !baseRate || !validFrom) {
        return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 });
      }

      const trainerRate = await hourlyRateService.createTrainerHourlyRate({
        trainerId,
        trainerName,
        baseRate,
        overrideRate,
        validFrom,
        validUntil,
        reason,
      });

      return NextResponse.json({ success: true, trainerRate });
    } catch (error) {
      log.error('Trainer hourly rate creation error:', error);
      return internalErrorResponse();
    }
  });
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const trainerId = searchParams.get('trainerId');

      if (trainerId) {
        const trainerRate = await hourlyRateService.getTrainerHourlyRateByTrainerId(trainerId);
        if (!trainerRate) {
          return NextResponse.json(
            { error: 'Trainer-Stundensatz nicht gefunden' },
            { status: 404 }
          );
        }
        return NextResponse.json({ trainerRate });
      }

      const trainerRates = await hourlyRateService.getAllTrainerHourlyRates();
      return NextResponse.json({ trainerRates });
    } catch (error) {
      log.error('Trainer hourly rate fetch error:', error);
      return internalErrorResponse();
    }
  });
}
