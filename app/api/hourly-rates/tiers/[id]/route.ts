import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { hourlyRateService } from '@/src/application/services/hourly-rate-service.adapter';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:hourly-rates:tiers:[id]');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const rateTier = await hourlyRateService.getHourlyRateTierById(id);

      if (!rateTier) {
        return NextResponse.json({ error: 'Hourly rate tier not found' }, { status: 404 });
      }

      return NextResponse.json({ rateTier });
    } catch (error) {
      log.error('Hourly rate tier fetch error:', error);
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

      const { name, description, baseRate, trainingTypes, experienceLevel, isActive } = body;

      const updated = await hourlyRateService.updateHourlyRateTier(id, {
        name,
        description,
        baseRate,
        trainingTypes,
        experienceLevel,
        isActive,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Hourly rate tier not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, rateTier: updated });
    } catch (error) {
      log.error('Hourly rate tier update error:', error);
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
      const success = await hourlyRateService.deleteHourlyRateTier(id);

      if (!success) {
        return NextResponse.json({ error: 'Hourly rate tier not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('Hourly rate tier delete error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
