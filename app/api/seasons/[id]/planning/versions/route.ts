import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiException, safeErrorMessage } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { SeasonPlanningService } from '@/application/services/season-planning.service';
import { applySlotsToPlanEntries } from '@/lib/season-planning/apply-plan';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:versions');

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
  const rateLimitError = await checkRateLimitOrFail(request, { max: 60, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const rows = await new SeasonPlanningService(auth).versions(seasonId);
      return NextResponse.json({
        success: true,
        versions: rows.map((r) => ({
          id: r.id,
          label: r.label,
          createdAt: r.created_at,
          createdByName: r.created_by_name,
          groupCount: Array.isArray(r.slots) ? r.slots.length : 0,
        })),
      });
    } catch (error) {
      return fail(error, 'Planstände nicht abrufbar');
    }
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;
        const body = await request.json();
        const version = await new SeasonPlanningService(auth).saveVersion(
          seasonId,
          body?.slots,
          body?.label
        );
        return NextResponse.json({ success: true, version });
      } catch (error) {
        return fail(error, 'Stand konnte nicht gesichert werden');
      }
    });
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;
        const { versionId } = await request.json();
        // Prüfung + Lesen über den Service (RLS); das Anwenden übernimmt weiter die Plan-Lib.
        const slots = await new SeasonPlanningService(auth).versionSlots(seasonId, versionId);
        const result = await applySlotsToPlanEntries(seasonId, slots);
        return NextResponse.json({ success: true, slots, ...result });
      } catch (error) {
        return fail(error, 'Planstand konnte nicht wiederhergestellt werden');
      }
    });
  });
}
