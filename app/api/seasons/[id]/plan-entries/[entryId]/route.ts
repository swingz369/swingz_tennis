import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiException, internalErrorResponse, safeErrorMessage } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { SeasonPlanService } from '@/application/services/season-plan.service';
import type { UpdatePlanEntryRequest } from '@/lib/types/season-planning';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:plan-entries:[entryId]');

interface RouteContext {
  params: Promise<{
    id: string; // season_id
    entryId: string;
  }>;
}

/** Fachliche Fehler im bisherigen Format `{ error: string }`. */
function fail(error: unknown) {
  if (error instanceof ApiException) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: error.status });
  }
  log.error('plan-entries/[entryId] error:', error instanceof Error ? error : undefined);
  return internalErrorResponse();
}

/** GET /api/seasons/[id]/plan-entries/[entryId] — ein Plan-Eintrag mit Details */
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId, entryId } = await context.params;
      const entry = await new SeasonPlanService(auth).get(seasonId, entryId);
      return NextResponse.json({
        success: true,
        entry: {
          ...entry,
          trainer_name: entry.trainer_name || 'Unknown',
          participant_count: Array.isArray(entry.expected_participants)
            ? entry.expected_participants.length
            : 0,
        },
      });
    } catch (error) {
      return fail(error);
    }
  });
}

/** PATCH /api/seasons/[id]/plan-entries/[entryId] — Plan-Eintrag ändern (nur Admins) */
export async function PATCH(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId, entryId } = await context.params;
        const body: UpdatePlanEntryRequest = await request.json();
        const result = await new SeasonPlanService(auth).update(seasonId, entryId, body);
        if ('conflicts' in result) {
          return NextResponse.json(
            {
              error: 'Terminkonflikt erkannt',
              details: 'Trainer or court is already booked at this time',
              conflicts: result.conflicts,
            },
            { status: 409 }
          );
        }
        return NextResponse.json({
          success: true,
          entry: result.entry,
          promoted: result.promoted,
          message: 'Plan-Eintrag erfolgreich aktualisiert',
        });
      } catch (error) {
        return fail(error);
      }
    });
  });
}

/** DELETE /api/seasons/[id]/plan-entries/[entryId] — Plan-Eintrag löschen (nur Admins) */
export async function DELETE(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId, entryId } = await context.params;
        await new SeasonPlanService(auth).remove(seasonId, entryId);
        return NextResponse.json({ success: true, message: 'Plan-Eintrag erfolgreich gelöscht' });
      } catch (error) {
        return fail(error);
      }
    });
  });
}
