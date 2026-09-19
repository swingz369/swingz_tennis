import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiException, internalErrorResponse, safeErrorMessage } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { SeasonPlanService } from '@/application/services/season-plan.service';
import type { CreatePlanEntryRequest } from '@/lib/types/season-planning';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:plan-entries');

interface RouteContext {
  params: Promise<{
    id: string; // season_id
  }>;
}

/** Fachliche Fehler im bisherigen Format `{ error: string }`. */
function fail(error: unknown) {
  if (error instanceof ApiException) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: error.status });
  }
  log.error('plan-entries error:', error);
  return internalErrorResponse();
}

/**
 * GET /api/seasons/[id]/plan-entries
 * Get all plan entries for a season
 *
 * Query params:
 * - trainer_id: Filter by trainer
 * - court_id: Filter by court
 * - group_id: Filter by group
 * - day_of_week: Filter by day (0-6)
 * - status: Filter by status
 * - entry_type: Filter by type
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const { searchParams } = new URL(request.url);
      const dayOfWeek = searchParams.get('day_of_week');
      const status = searchParams.get('status');

      const rows = await new SeasonPlanService(auth).list(seasonId, {
        trainerId: searchParams.get('trainer_id') ?? undefined,
        courtId: searchParams.get('court_id') ?? undefined,
        groupId: searchParams.get('group_id') ?? undefined,
        dayOfWeek: dayOfWeek ? parseInt(dayOfWeek) : undefined,
        statuses: status ? status.split(',') : undefined,
        entryType: searchParams.get('entry_type') ?? undefined,
      });
      const entries = rows.map((row) => ({
        ...row,
        trainer_name: row.trainer_name || 'Unknown',
        participant_count: Array.isArray(row.expected_participants)
          ? row.expected_participants.length
          : 0,
      }));
      return NextResponse.json({ success: true, entries, count: entries.length });
    } catch (error) {
      return fail(error);
    }
  });
}

/**
 * POST /api/seasons/[id]/plan-entries
 * Create a new plan entry (manual planning), admin-only.
 *
 * Body: CreatePlanEntryRequest
 */
export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;
        const body: CreatePlanEntryRequest = await request.json();
        const result = await new SeasonPlanService(auth).create(seasonId, body);
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
        return NextResponse.json(
          { success: true, entry: result.entry, message: 'Plan-Eintrag erfolgreich erstellt' },
          { status: 201 }
        );
      } catch (error) {
        return fail(error);
      }
    });
  });
}
