import { internalErrorResponse } from '@/lib/api-error';
import { NextResponse, type NextRequest } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { getSeasonCalendarData } from '@/lib/season-planning/season-calendar.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:calendar');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rateLimit = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimit) return rateLimit;

  return withApiAuth(request, async (auth) => {
    // verifyRole() is async — missing await here meant the check always
    // received a (truthy) Promise, so `!verifyRole(...)` was always false and
    // the guard never fired for any authenticated user, regardless of role.
    if (!(await verifyRole(auth, 'admin'))) {
      return forbiddenResponse('Nur Admins dürfen den Saisonkalender einsehen');
    }

    const { id: seasonId } = await context.params;
    if (!seasonId) {
      return NextResponse.json({ error: 'season_id erforderlich' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const bundeslandOverride = searchParams.get('bundesland') ?? undefined;

    try {
      const data = await getSeasonCalendarData(
        auth.supabase as unknown as Parameters<typeof getSeasonCalendarData>[0],
        seasonId,
        bundeslandOverride
      );
      return NextResponse.json({ ok: true, data });
    } catch (err) {
      log.error('Saisonkalender konnte nicht geladen werden', { err, seasonId });
      return internalErrorResponse();
    }
  });
}
