import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiException, internalErrorResponse, safeErrorMessage } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { SeasonPlanService } from '@/application/services/season-plan.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:plan-grid');

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/seasons/[id]/plan-grid
 * Kalenderraster der Saison. Admins: alles; Trainer/Mitglieder: nur die eigenen Slots.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      return NextResponse.json(await new SeasonPlanService(auth).grid(seasonId));
    } catch (error) {
      if (error instanceof ApiException) {
        return NextResponse.json({ error: safeErrorMessage(error) }, { status: error.status });
      }
      log.error('GET /api/seasons/[id]/plan-grid error', error);
      return internalErrorResponse();
    }
  });
}
