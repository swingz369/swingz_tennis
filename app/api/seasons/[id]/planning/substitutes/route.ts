import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiException, safeErrorMessage } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { SeasonPlanningService } from '@/application/services/season-planning.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:substitutes');

interface RouteContext {
  params: Promise<{ id: string }>;
}

function fail(error: unknown, what: string) {
  if (error instanceof ApiException) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: error.status });
  }
  log.error(`${what} error`, error instanceof Error ? error : undefined);
  return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 30, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      return NextResponse.json({
        substitutes: await new SeasonPlanningService(auth).substitutes(seasonId),
      });
    } catch (error) {
      return fail(error, 'GET substitutes');
    }
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 10, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const result = await new SeasonPlanningService(auth).assignSubstitute(
        seasonId,
        await request.json()
      );
      log.info('Substitute trainer assigned', { seasonId, groupId: result.substitute.groupId });
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      return fail(error, 'POST substitutes');
    }
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 10, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const { groupId } = await request.json();
      await new SeasonPlanningService(auth).clearSubstitute(seasonId, groupId);
      log.info('Substitute trainer removed', { seasonId, groupId });
      return NextResponse.json({ success: true });
    } catch (error) {
      return fail(error, 'DELETE substitutes');
    }
  });
}
