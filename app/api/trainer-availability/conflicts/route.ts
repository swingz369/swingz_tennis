import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { TrainerAvailabilityService } from '@/application/services/trainer-availability.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainer-availability:conflicts');

export async function GET(request: NextRequest) {
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
      const { searchParams } = new URL(request.url);
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      if (!startDate || !endDate) {
        return NextResponse.json(
          { error: 'Start- und Enddatum sind erforderlich' },
          { status: 400 }
        );
      }

      const conflicts = await new TrainerAvailabilityService(auth).getAvailabilityConflicts(
        startDate,
        endDate
      );
      return NextResponse.json({ conflicts });
    } catch (error) {
      log.error('Availability conflicts fetch error:', error);
      return internalErrorResponse();
    }
  });
}
