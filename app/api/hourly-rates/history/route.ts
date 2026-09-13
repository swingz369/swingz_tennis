import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { errorResponse, internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { HourlyRateService } from '@/application/services/hourly-rate.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:hourly-rates:history');

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
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
      const trainerId = searchParams.get('trainerId');
      const service = new HourlyRateService(auth);

      const history = trainerId
        ? await service.getHistoryForTrainer(trainerId)
        : await service.getHistory(auth.clubId);

      return NextResponse.json({ history });
    } catch (error) {
      log.error('Rate history fetch error:', error);
      return internalErrorResponse();
    }
  });
}
