import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { db } from '@/src/infrastructure/persistence/drizzle';
import {
  seasons,
  userTrainingPreferences,
  seasonPlanEntries,
  planningConflicts,
  seasonPlanningHistory,
} from '@/src/infrastructure/persistence/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { UpdateSeasonRequest } from '@/lib/types/season-planning';

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * GET /api/seasons/[id]
 * Get a single season by ID with full statistics
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id } = params;

      // Fetch season with stats
      const [result] = await db
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
        .where(eq(seasons.id, id))
        .groupBy(seasons.id);

      if (!result) {
        return NextResponse.json({ error: 'Season not found' }, { status: 404 });
      }

      // Verify user has access to this club
      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');

      if (!isAdmin && !isSuperadmin && result.season.club_id !== auth.clubId) {
        return forbiddenResponse('You do not have access to this season');
      }

      // Transform result
      const seasonWithStats = {
        ...result.season,
        total_preferences: Number(result.total_preferences),
        submitted_preferences: Number(result.submitted_preferences),
        planned_entries: Number(result.planned_entries),
        open_conflicts: Number(result.open_conflicts),
        trainers_count: Number(result.trainers_count),
        groups_covered: Number(result.groups_covered),
      };

      return NextResponse.json({
        success: true,
        season: seasonWithStats,
      });
    } catch (error) {
      console.error(`GET /api/seasons/${params.id} error:`, error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch season' },
        { status: 500 }
      );
    }
  });
}

/**
 * PATCH /api/seasons/[id]
 * Update a season
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id } = params;

        // Only admins and superadmins can update seasons
        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');

        if (!isAdmin && !isSuperadmin) {
          return forbiddenResponse('Only admins can update seasons');
        }

        // Fetch existing season
        const [existingSeason] = await db.select().from(seasons).where(eq(seasons.id, id));

        if (!existingSeason) {
          return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }

        // Verify user has access to this club
        if (!isSuperadmin && existingSeason.club_id !== auth.clubId) {
          return forbiddenResponse('You do not have access to this season');
        }

        const body: UpdateSeasonRequest = await request.json();

        // Build update object
        const updateData: Partial<typeof seasons.$inferInsert> = {};

        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.preferences_open !== undefined)
          updateData.preferences_open = body.preferences_open;
        if (body.planning_status !== undefined) updateData.planning_status = body.planning_status;

        if (body.start_date !== undefined) {
          const startDate = new Date(body.start_date);
          if (isNaN(startDate.getTime())) {
            return NextResponse.json({ error: 'Invalid start_date format' }, { status: 400 });
          }
          updateData.start_date = startDate;
        }

        if (body.end_date !== undefined) {
          const endDate = new Date(body.end_date);
          if (isNaN(endDate.getTime())) {
            return NextResponse.json({ error: 'Invalid end_date format' }, { status: 400 });
          }
          updateData.end_date = endDate;
        }

        if (body.preferences_deadline !== undefined) {
          if (body.preferences_deadline === null) {
            updateData.preferences_deadline = null;
          } else {
            const deadline = new Date(body.preferences_deadline);
            if (isNaN(deadline.getTime())) {
              return NextResponse.json(
                { error: 'Invalid preferences_deadline format' },
                { status: 400 }
              );
            }
            updateData.preferences_deadline = deadline;
          }
        }

        if (body.auto_plan_config !== undefined) {
          updateData.auto_plan_config = {
            ...(existingSeason.auto_plan_config as Record<string, unknown>),
            ...body.auto_plan_config,
          };
        }

        // Validate dates if both are present
        if (updateData.start_date && updateData.end_date) {
          if (updateData.start_date >= updateData.end_date) {
            return NextResponse.json(
              { error: 'start_date must be before end_date' },
              { status: 400 }
            );
          }
        }

        // Perform update
        const [updatedSeason] = await db
          .update(seasons)
          .set(updateData)
          .where(eq(seasons.id, id))
          .returning();

        // Log status changes to history
        if (body.planning_status && body.planning_status !== existingSeason.planning_status) {
          await db.insert(seasonPlanningHistory).values({
            season_id: id,
            club_id: existingSeason.club_id,
            action_type:
              body.planning_status === 'published'
                ? 'plan_published'
                : body.planning_status === 'active'
                  ? 'season_activated'
                  : body.planning_status === 'collecting_preferences'
                    ? 'preferences_opened'
                    : 'manual_edit',
            actor_id: auth.userId,
            actor_role: auth.role,
            details: {
              old_status: existingSeason.planning_status,
              new_status: body.planning_status,
            },
          });
        }

        return NextResponse.json({
          success: true,
          season: updatedSeason,
        });
      } catch (error) {
        console.error(`PATCH /api/seasons/${params.id} error:`, error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to update season' },
          { status: 500 }
        );
      }
    });
  });
}

/**
 * DELETE /api/seasons/[id]
 * Delete a season (only if in draft status)
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id } = params;

        // Only admins and superadmins can delete seasons
        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');

        if (!isAdmin && !isSuperadmin) {
          return forbiddenResponse('Only admins can delete seasons');
        }

        // Fetch existing season
        const [existingSeason] = await db.select().from(seasons).where(eq(seasons.id, id));

        if (!existingSeason) {
          return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }

        // Verify user has access to this club
        if (!isSuperadmin && existingSeason.club_id !== auth.clubId) {
          return forbiddenResponse('You do not have access to this season');
        }

        // Only allow deletion of draft seasons
        if (existingSeason.planning_status !== 'draft') {
          return NextResponse.json({ error: 'Only draft seasons can be deleted' }, { status: 400 });
        }

        // Delete season (cascades to related tables)
        await db.delete(seasons).where(eq(seasons.id, id));

        return NextResponse.json({
          success: true,
          message: 'Season deleted successfully',
        });
      } catch (error) {
        console.error(`DELETE /api/seasons/${params.id} error:`, error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to delete season' },
          { status: 500 }
        );
      }
    });
  });
}
