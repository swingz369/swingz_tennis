import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiException, safeErrorMessage } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { SeasonPlanningService } from '@/application/services/season-planning.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:inactive-weeks');

interface RouteContext {
  params: Promise<{ id: string }>;
}

function fail(error: unknown, fallback: string) {
  if (error instanceof ApiException) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: error.status });
  }
  log.error(fallback, error instanceof Error ? error : undefined);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** GET — welche Gruppe in welcher Saisonwoche ausfällt (nur is_active=false ist gesetzt). */
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 30, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      return NextResponse.json({
        weeks: await new SeasonPlanningService(auth).listWeeks(seasonId),
      });
    } catch (error) {
      return fail(error, 'Interner Fehler');
    }
  });
}

/** POST — Wochen einer Gruppe aktivieren/deaktivieren. Body: { weeks: [{ groupId, weekNumber, isActive }] } */
export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 10, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const body = await request.json();
      const updated = await new SeasonPlanningService(auth).setWeeks(seasonId, body.weeks ?? []);
      log.info('Inactive weeks updated', { seasonId, count: updated });
      return NextResponse.json({ success: true, updated });
    } catch (error) {
      return fail(error, 'Interner Fehler');
    }
  });
}
