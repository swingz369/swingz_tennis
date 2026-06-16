import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { trainerAvailabilityService } from '@/src/application/services/trainer-availability-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainer-availability:conflicts');

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
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      if (!startDate || !endDate) {
        return NextResponse.json(
          { error: 'Start date and end date are required' },
          { status: 400 }
        );
      }

      const conflicts = await trainerAvailabilityService.getAvailabilityConflicts(
        startDate,
        endDate
      );
      return NextResponse.json({ conflicts });
    } catch (error) {
      log.error('Availability conflicts fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
