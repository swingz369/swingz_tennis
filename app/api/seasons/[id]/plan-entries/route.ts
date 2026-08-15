import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { db } from '@/src/infrastructure/persistence/db';
import {
  seasonPlanEntries,
  trainers,
  courts,
  trainingGroups,
} from '@/src/infrastructure/persistence/schema';
import { and, eq, sql, inArray } from 'drizzle-orm';
import type { CreatePlanEntryRequest } from '@/lib/types/season-planning';
import { createLogger } from '@/lib/logger';
import { authorizeSeasonAccess } from '@/lib/season-auth';

const log = createLogger('api:seasons:[id]:plan-entries');

interface RouteContext {
  params: Promise<{
    id: string; // season_id
  }>;
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

      // Centralized authorization — see lib/season-auth.ts. Reads club_id
      // from the resolved season to enforce membership + role checks once.
      const access = await authorizeSeasonAccess(auth, seasonId, {
        allowedRoles: ['admin', 'trainer', 'member'],
      });
      if (!access.ok) return access.response;

      // Build query conditions
      const conditions = [eq(seasonPlanEntries.season_id, seasonId)];

      const trainerId = searchParams.get('trainer_id');
      const courtId = searchParams.get('court_id');
      const groupId = searchParams.get('group_id');
      const dayOfWeek = searchParams.get('day_of_week');
      const status = searchParams.get('status');
      const entryType = searchParams.get('entry_type');

      if (trainerId) conditions.push(eq(seasonPlanEntries.trainer_id, trainerId));
      if (courtId) conditions.push(eq(seasonPlanEntries.court_id, courtId));
      if (groupId) conditions.push(eq(seasonPlanEntries.group_id, groupId));
      if (dayOfWeek) conditions.push(eq(seasonPlanEntries.day_of_week, parseInt(dayOfWeek)));
      if (status) {
        const statuses = status.split(',');
        if (statuses.length === 1) {
          conditions.push(eq(seasonPlanEntries.status, statuses[0]));
        } else {
          conditions.push(inArray(seasonPlanEntries.status, statuses));
        }
      }
      if (entryType) conditions.push(eq(seasonPlanEntries.entry_type, entryType));

      // Fetch entries with details
      const entries = await db
        .select({
          entry: seasonPlanEntries,
          trainer_name: trainers.name,
          court_name: courts.name,
          group_name: trainingGroups.name,
        })
        .from(seasonPlanEntries)
        .leftJoin(trainers, eq(seasonPlanEntries.trainer_id, trainers.id))
        .leftJoin(courts, eq(seasonPlanEntries.court_id, courts.id))
        .leftJoin(trainingGroups, eq(seasonPlanEntries.group_id, trainingGroups.id))
        .where(and(...conditions))
        .orderBy(seasonPlanEntries.day_of_week, seasonPlanEntries.start_time);

      // Transform results
      const entriesWithDetails = entries.map((row) => ({
        ...row.entry,
        trainer_name: row.trainer_name || 'Unknown',
        court_name: row.court_name || null,
        group_name: row.group_name || null,
        participant_count: Array.isArray(row.entry.expected_participants)
          ? row.entry.expected_participants.length
          : 0,
      }));

      return NextResponse.json({
        success: true,
        entries: entriesWithDetails,
        count: entriesWithDetails.length,
      });
    } catch (error) {
      log.error(`GET /api/seasons/[id]/plan-entries error:`, error);
      return internalErrorResponse();
    }
  });
}

/**
 * POST /api/seasons/[id]/plan-entries
 * Create a new plan entry (manual planning)
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

        // POST is admin-only (state-changing endpoint). Note we include
        // 'superadmin' in `allowedRoles` so a club-scoped superadmin
        // (e.g. one who holds superadmin role in this club but not
        // globally) is preserved at parity with the original semantics.
        // The helper's platform-staff fast path separately handles
        // global superadmin/owner (no membership lookup needed).
        const access = await authorizeSeasonAccess(auth, seasonId, {
          allowedRoles: ['admin', 'superadmin'],
        });
        if (!access.ok) return access.response;
        const { season } = access;

        const body: CreatePlanEntryRequest = await request.json();

        // Validate required fields
        if (
          !body.trainer_id ||
          body.day_of_week === undefined ||
          !body.start_time ||
          !body.end_time ||
          !body.duration_minutes
        ) {
          return NextResponse.json(
            {
              error:
                'Missing required fields: trainer_id, day_of_week, start_time, end_time, duration_minutes',
            },
            { status: 400 }
          );
        }

        // Validate day of week
        if (body.day_of_week < 0 || body.day_of_week > 6) {
          return NextResponse.json(
            { error: 'day_of_week must be between 0 (Monday) and 6 (Sunday)' },
            { status: 400 }
          );
        }

        // Vereinsrealität: regulärer Trainingsbetrieb findet nicht sonntags statt
        // (Sonntag ist spielfrei/Turniertag). Andere entry_types (z.B. Turniere)
        // dürfen weiterhin auf Sonntag fallen.
        const resolvedEntryType = body.entry_type || 'training';
        if (body.day_of_week === 6 && resolvedEntryType === 'training') {
          return NextResponse.json(
            { error: 'Trainingsstunden können nicht auf einen Sonntag gelegt werden (nur Mo-Sa).' },
            { status: 400 }
          );
        }

        // Validate time format (HH:MM:SS)
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
        if (!timeRegex.test(body.start_time) || !timeRegex.test(body.end_time)) {
          return NextResponse.json({ error: 'Times must be in HH:MM:SS format' }, { status: 400 });
        }

        // Validate start_time < end_time
        if (body.start_time >= body.end_time) {
          return NextResponse.json(
            { error: 'start_time must be before end_time' },
            { status: 400 }
          );
        }

        // Check for conflicts (same day/time, same trainer or court)
        const conflicts = await db
          .select()
          .from(seasonPlanEntries)
          .where(
            and(
              eq(seasonPlanEntries.season_id, seasonId),
              eq(seasonPlanEntries.day_of_week, body.day_of_week),
              sql`(
                (${seasonPlanEntries.start_time} < ${body.end_time} AND ${seasonPlanEntries.end_time} > ${body.start_time})
                AND (
                  ${seasonPlanEntries.trainer_id} = ${body.trainer_id}
                  ${body.court_id ? sql`OR ${seasonPlanEntries.court_id} = ${body.court_id}` : sql``}
                )
              )`
            )
          );

        if (conflicts.length > 0) {
          return NextResponse.json(
            {
              error: 'Scheduling conflict detected',
              details: 'Trainer or court is already booked at this time',
              conflicts: conflicts.map((c) => ({
                id: c.id,
                day_of_week: c.day_of_week,
                start_time: c.start_time,
                end_time: c.end_time,
              })),
            },
            { status: 409 }
          );
        }

        // Create plan entry
        const [newEntry] = await db
          .insert(seasonPlanEntries)
          .values({
            season_id: seasonId,
            club_id: season.club_id,
            trainer_id: body.trainer_id,
            court_id: body.court_id || null,
            group_id: body.group_id || null,
            day_of_week: body.day_of_week,
            start_time: body.start_time,
            end_time: body.end_time,
            duration_minutes: body.duration_minutes,
            starts_from_week: body.starts_from_week || 1,
            ends_at_week: body.ends_at_week || null,
            entry_type: body.entry_type || 'training',
            planning_source: body.planning_source || 'manual',
            max_participants: body.max_participants || 10,
            expected_participants: body.expected_participants || [],
            notes: body.notes || null,
            admin_notes: body.admin_notes || null,
            status: 'planned',
          })
          .returning();

        return NextResponse.json(
          {
            success: true,
            entry: newEntry,
            message: 'Plan entry created successfully',
          },
          { status: 201 }
        );
      } catch (error) {
        log.error(`POST /api/seasons/[id]/plan-entries error:`, error);
        return internalErrorResponse();
      }
    });
  });
}
