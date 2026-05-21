import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { hourlyRateService } from '@/src/application/services/hourly-rate-service.adapter';

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or Admin access required');
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
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      console.error('Trainer hourly rate creation error:', error);
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
      return forbiddenResponse('Trainer or Admin access required');
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
          return NextResponse.json({ error: 'Trainer hourly rate not found' }, { status: 404 });
        }
        return NextResponse.json({ trainerRate });
      }

      const trainerRates = await hourlyRateService.getAllTrainerHourlyRates();
      return NextResponse.json({ trainerRates });
    } catch (error) {
      console.error('Trainer hourly rate fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
