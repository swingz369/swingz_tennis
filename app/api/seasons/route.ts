import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/src/infrastructure/persistence/drizzle';
import {
  seasons,
  userTrainingPreferences,
  seasonPlanEntries,
  planningConflicts,
} from '@/src/infrastructure/persistence/schema';
import { and, eq, sql, desc, gte, lte, or, inArray } from 'drizzle-orm';
import type { CreateSeasonRequest, SeasonFilter } from '@/lib/types/season-planning';

/**
 * GET /api/seasons
 * Fetch all seasons for a club with optional filtering
 *
 * Query params:
 * - club_id (required if not admin)
 * - season_type: 'summer' | 'winter'
 * - year: number
 * - planning_status: string | string[]
 * - is_active: boolean
 *
 * Returns: Array of seasons with statistics
 */
export async function GET(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { searchParams } = new URL(request.url);

      // Parse filters
      const clubId = searchParams.get('club_id') || auth.clubId;
      const seasonType = searchParams.get('season_type');
      const year = searchParams.get('year');
      const planningStatus = searchParams.get('planning_status');
      const isActive = searchParams.get('is_active');

      if (!clubId) {
        return NextResponse.json({ error: 'club_id is required' }, { status: 400 });
      }

      // Verify user has access to this club
      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');

      if (!isAdmin && !isSuperadmin && clubId !== auth.clubId) {
        return forbiddenResponse('You do not have access to this club');
      }

      // Build query conditions
      const conditions = [eq(seasons.club_id, clubId)];

      if (seasonType) {
        conditions.push(eq(seasons.season_type, seasonType));
      }

      if (year) {
        conditions.push(eq(seasons.year, parseInt(year)));
      }

      if (planningStatus) {
        const statuses = planningStatus.split(',');
        if (statuses.length === 1) {
          conditions.push(eq(seasons.planning_status, statuses[0]));
        } else {
          conditions.push(inArray(seasons.planning_status, statuses));
        }
      }

      if (isActive !== null && isActive !== undefined) {
        conditions.push(eq(seasons.is_active, isActive === 'true'));
      }

      // Fetch seasons with stats using subqueries
      const results = await db
        .select({
          season: seasons,
          total_preferences: sql<number>`COUNT(DISTINCT ${userTrainingPreferences.id})`,
          submitted_preferences: sql<number>`COUNT(DISTINCT CASE WHEN ${userTrainingPreferences.is_submitted} THEN ${userTrainingPreferences.id} END)`,
          planned_entries: sql<number>`COUNT(DISTINCT ${seasonPlanEntries.id})`,
          open_conflicts: sql<number>`COUNT(DISTINCT CASE WHEN ${planningConflicts.status} = 'open' THEN ${planningConflicts.id} END)`,
          trainers_count: sql<number>`COUNT(DISTINCT CASE WHEN ${userTrainingPreferences.user_role} = 'trainer' THEN ${userTrainingPreferences.id} END)`,
          groups_covered: sql<number>`COUNT(DISTINCT ${seasonPlanEntries.group_id})`,
        })
        .from(seasons)
        .leftJoin(userTrainingPreferences, eq(seasons.id, userTrainingPreferences.season_id))
        .leftJoin(seasonPlanEntries, eq(seasons.id, seasonPlanEntries.season_id))
        .leftJoin(planningConflicts, eq(seasons.id, planningConflicts.season_id))
        .where(and(...conditions))
        .groupBy(seasons.id)
        .orderBy(desc(seasons.created_at));

      // Transform results
      const seasonsWithStats = results.map((row) => ({
        ...row.season,
        total_preferences: Number(row.total_preferences),
        submitted_preferences: Number(row.submitted_preferences),
        planned_entries: Number(row.planned_entries),
        open_conflicts: Number(row.open_conflicts),
        trainers_count: Number(row.trainers_count),
        groups_covered: Number(row.groups_covered),
      }));

      return NextResponse.json({
        success: true,
        seasons: seasonsWithStats,
        count: seasonsWithStats.length,
      });
    } catch (error) {
      console.error('GET /api/seasons error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch seasons' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/seasons
 * Create a new season
 *
 * Body: CreateSeasonRequest
 *
 * Returns: Created season object
 */
export async function POST(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      // Only admins and superadmins can create seasons
      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');

      if (!isAdmin && !isSuperadmin) {
        return forbiddenResponse('Only admins can create seasons');
      }

      const body: CreateSeasonRequest = await request.json();

      // Validate required fields
      if (
        !body.club_id ||
        !body.name ||
        !body.season_type ||
        !body.year ||
        !body.start_date ||
        !body.end_date
      ) {
        return NextResponse.json(
          {
            error:
              'Missing required fields: club_id, name, season_type, year, start_date, end_date',
          },
          { status: 400 }
        );
      }

      // Verify user has access to this club
      if (!isSuperadmin && body.club_id !== auth.clubId) {
        return forbiddenResponse('You do not have access to this club');
      }

      // Validate dates
      const startDate = new Date(body.start_date);
      const endDate = new Date(body.end_date);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }

      if (startDate >= endDate) {
        return NextResponse.json({ error: 'start_date must be before end_date' }, { status: 400 });
      }

      // Check for overlapping seasons of same type
      const overlappingSeasons = await db
        .select()
        .from(seasons)
        .where(
          and(
            eq(seasons.club_id, body.club_id),
            eq(seasons.season_type, body.season_type),
            eq(seasons.year, body.year)
          )
        );

      if (overlappingSeasons.length > 0) {
        return NextResponse.json(
          { error: `A ${body.season_type} season for year ${body.year} already exists` },
          { status: 409 }
        );
      }

      // Create season
      const [newSeason] = await db
        .insert(seasons)
        .values({
          club_id: body.club_id,
          name: body.name,
          season_type: body.season_type,
          year: body.year,
          start_date: startDate,
          end_date: endDate,
          preferences_deadline: body.preferences_deadline
            ? new Date(body.preferences_deadline)
            : null,
          description: body.description || null,
          notes: body.notes || null,
          created_by: auth.userId,
          planning_status: 'draft',
          preferences_open: false,
          is_active: false,
          auto_plan_enabled: true,
          auto_plan_config: body.auto_plan_config || {
            max_iterations: 1000,
            optimization_goals: [
              'minimize_conflicts',
              'balance_trainer_load',
              'maximize_preferences',
            ],
            allow_overbooking: false,
            prefer_consistent_timeslots: true,
          },
        })
        .returning();

      return NextResponse.json(
        {
          success: true,
          season: newSeason,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('POST /api/seasons error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to create season' },
        { status: 500 }
      );
    }
  });
}
