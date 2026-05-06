import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';
import { HourlyRateService } from '@/src/application/services/hourly-rate.service';

export async function POST(_request: NextRequest) {
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
      const body = await _request.json();

      const { name, description, baseRate, trainingTypes, experienceLevel } = body;

      if (!name || !baseRate || !trainingTypes || !experienceLevel) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const rateTier = await HourlyRateService.createHourlyRateTier({
        name,
        description,
        baseRate,
        trainingTypes,
        experienceLevel,
      });

      return NextResponse.json({ success: true, rateTier });
    } catch (error) {
      console.error('Hourly rate tier creation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function GET(_request: NextRequest) {
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
      const { searchParams } = new URL(_request.url);
      const active = searchParams.get('active');

      if (active) {
        const rateTiers = await HourlyRateService.getActiveHourlyRateTiers();
        return NextResponse.json({ rateTiers });
      }

      const rateTiers = await HourlyRateService.getAllHourlyRateTiers();
      return NextResponse.json({ rateTiers });
    } catch (error) {
      console.error('Hourly rate tier fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
