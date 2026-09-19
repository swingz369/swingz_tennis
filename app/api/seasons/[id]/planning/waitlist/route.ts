import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiException, safeErrorMessage } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { SeasonPlanningService } from '@/application/services/season-planning.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:waitlist');

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

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 30, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const waitlist = await new SeasonPlanningService(auth).waitlist(seasonId);
      return NextResponse.json({
        success: true,
        waitlist,
        totalCount: waitlist.length,
        waitingCount: waitlist.filter((w) => w.status === 'waiting').length,
      });
    } catch (error) {
      return fail(error, 'Interner Fehler');
    }
  });
}

/**
 * POST /api/seasons/[id]/planning/waitlist
 * Manually promote a waitlisted member (when a slot opens)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;
        const { waitlistId, promoteToGroupId } = await request.json();
        await new SeasonPlanningService(auth).promote(seasonId, waitlistId, promoteToGroupId);
        return NextResponse.json({
          success: true,
          message: `Mitglied von Warteliste in Gruppe verschoben`,
        });
      } catch (error) {
        return fail(error, 'Interner Fehler');
      }
    });
  });
}
