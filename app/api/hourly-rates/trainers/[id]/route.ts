import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { hourlyRateService } from '@/src/application/services/hourly-rate-service.adapter';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:hourly-rates:trainers:[id]');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      const { id } = await params;
      const trainerRate = await hourlyRateService.getTrainerHourlyRateById(id);

      if (!trainerRate) {
        return NextResponse.json({ error: 'Trainer hourly rate not found' }, { status: 404 });
      }

      return NextResponse.json({ trainerRate });
    } catch (error) {
      log.error('Trainer hourly rate fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const body = await _request.json();

      const { overrideRate, validUntil, reason } = body;

      const updated = await hourlyRateService.updateTrainerHourlyRate(id, {
        overrideRate,
        validUntil,
        reason,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Trainer hourly rate not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, trainerRate: updated });
    } catch (error) {
      log.error('Trainer hourly rate update error:', error);
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
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const success = await hourlyRateService.deleteTrainerHourlyRate(id);

      if (!success) {
        return NextResponse.json({ error: 'Trainer hourly rate not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('Trainer hourly rate delete error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
