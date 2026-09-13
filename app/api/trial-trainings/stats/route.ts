import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { TrialTrainingService } from '@/application/services/trial-training.service';
import { getUserDb } from '@/infrastructure/db';
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

    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
    }

    try {
      const trialTrainingService = new TrialTrainingService(getUserDb(auth));
      const stats = await trialTrainingService.getTrialTrainingStats(clubId);
      return NextResponse.json({ stats });
    } catch (error) {
      log.error('Trial training stats error:', error);
      return internalErrorResponse();
    }
  });
}
