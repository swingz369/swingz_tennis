import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { TrialTrainingService } from '@/src/application/services/trial-training.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Only admins and trainers can view trial training stats
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const stats = await TrialTrainingService.getTrialTrainingStats();
      return NextResponse.json({ stats });
    } catch (error) {
      console.error('Trial training stats error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
