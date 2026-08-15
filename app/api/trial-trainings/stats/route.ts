import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { trialTrainingService } from '@/src/application/services/trial-training-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trial-trainings:stats');

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Only admins and trainers can view trial training stats
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const stats = await trialTrainingService.getTrialTrainingStats();
      return NextResponse.json({ stats });
    } catch (error) {
      log.error('Trial training stats error:', error);
      return internalErrorResponse();
    }
  });
}
