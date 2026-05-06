import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { getDb } from '@/src/infrastructure/persistence/client';
import {
  seasons,
  seasonPlanEntries,
  trainers,
  courts,
  groups,
} from '@/src/infrastructure/persistence/schema';
import { and, eq, sql, inArray, desc } from 'drizzle-orm';
import type { CreatePlanEntryRequest, PlanEntryFilter } from '@/lib/types/season-planning';

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
  const db = getDb();
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    const db = getDb();
    try {
      const { id: seasonId } = await context.params;
      const { searchParams } = new URL(request.url);

      // Verify season exists
      const [season] = await getDb().select().from(seasons).where(eq(seasons.id, seasonId));

      if (!season) {
        return NextResponse.json({ error: 'Season not found' }, { status: 404 });
      }

      // Check permissions
      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');

      if (!isAdmin && !isSuperadmin && season.club_id !== auth.clubId) {
        return forbiddenResponse('You do not have access to this season');
      }

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
          group_name: groups.name,
        })
        .from(seasonPlanEntries)
        .leftJoin(trainers, eq(seasonPlanEntries.trainer_id, trainers.id))
        .leftJoin(courts, eq(seasonPlanEntries.court_id, courts.id))
        .leftJoin(groups, eq(seasonPlanEntries.group_id, groups.id))
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
      console.error(`GET /api/seasons/[id]/plan-entries error:`, error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch plan entries' },
        { status: 500 }
      );
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
  const db = getDb();
  return withCSRFProtection(request, async () => {
    const db = getDb();
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      const db = getDb();
      try {
        const { id: seasonId } = await context.params;

        // Only admins can create plan entries
        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');

        if (!isAdmin && !isSuperadmin) {
          return forbiddenResponse('Only admins can create plan entries');
        }

        // Verify season exists
        const [season] = await getDb().select().from(seasons).where(eq(seasons.id, seasonId));

        if (!season) {
          return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }

        // Verify access
        if (!isSuperadmin && season.club_id !== auth.clubId) {
          return forbiddenResponse('You do not have access to this season');
        }

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
        console.error(`POST /api/seasons/[id]/plan-entries error:`, error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to create plan entry' },
          { status: 500 }
        );
      }
    });
  });
}
