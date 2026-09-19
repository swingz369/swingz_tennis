// GET+PUT /api/seasons/[id]/planning/config
// Manages the per-season planning config (treat_high_failure_as_hard, backtrack_depth, etc.)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiException, internalErrorResponse, safeErrorMessage } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { SeasonPlanningConfigService } from '@/application/services/season-planning-config.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:config');

interface RouteContext {
  params: Promise<{ id: string }>;
}

function fail(error: unknown) {
  if (error instanceof ApiException) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: error.status });
  }
  log.error('planning config error:', error);
  return internalErrorResponse();
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 60, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const config = await new SeasonPlanningConfigService(auth).get(seasonId);
      return NextResponse.json({
        success: true,
        config,
        // Frontend-friendly defaults so the UI can render before the row exists
        defaults: { treat_high_failure_as_hard: false, backtrack_depth: 0 },
      });
    } catch (error) {
      return fail(error);
    }
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 30, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const body = await request.json();
      if (!body || typeof body !== 'object') {
        throw new ApiException('VALIDATION_ERROR', 'Body muss ein JSON-Objekt sein');
      }
      const config = await new SeasonPlanningConfigService(auth).save(seasonId, body);
      return NextResponse.json({ success: true, config });
    } catch (error) {
      return fail(error);
    }
  });
}
