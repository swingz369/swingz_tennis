import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { db } from '@/src/infrastructure/persistence/db';
import {
  seasonPlanEntries,
  trainers,
  courts,
  trainingGroups,
} from '@/src/infrastructure/persistence/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { UpdatePlanEntryRequest } from '@/lib/types/season-planning';

interface RouteContext {
  params: Promise<{
    id: string; // season_id
    entryId: string;
  }>;
}

/**
 * GET /api/seasons/[id]/plan-entries/[entryId]
 * Get a single plan entry with full details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    const { id: seasonId, entryId } = await context.params;
    try {
      // Fetch entry with details
      const [result] = await db
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
        .where(and(eq(seasonPlanEntries.id, entryId), eq(seasonPlanEntries.season_id, seasonId)));

      if (!result) {
        return NextResponse.json({ error: 'Plan entry not found' }, { status: 404 });
      }

      // Check permissions
      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');

      if (!isAdmin && !isSuperadmin && result.entry.club_id !== auth.clubId) {
        return forbiddenResponse('You do not have access to this plan entry');
      }

      const entryWithDetails = {
        ...result.entry,
        trainer_name: result.trainer_name || 'Unknown',
        court_name: result.court_name || null,
        group_name: result.group_name || null,
        participant_count: Array.isArray(result.entry.expected_participants)
          ? result.entry.expected_participants.length
          : 0,
      };

      return NextResponse.json({
        success: true,
        entry: entryWithDetails,
      });
    } catch (error) {
      console.error(`GET /api/seasons/[id]/plan-entries/${entryId} error:`, error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch plan entry' },
        { status: 500 }
      );
    }
  });
}

/**
 * PATCH /api/seasons/[id]/plan-entries/[entryId]
 * Update a plan entry
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      const { id: seasonId, entryId } = await context.params;
      try {
        // Only admins can update plan entries
        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');

        if (!isAdmin && !isSuperadmin) {
          return forbiddenResponse('Only admins can update plan entries');
        }

        // Fetch existing entry
        const [existingEntry] = await db
          .select()
          .from(seasonPlanEntries)
          .where(and(eq(seasonPlanEntries.id, entryId), eq(seasonPlanEntries.season_id, seasonId)));

        if (!existingEntry) {
          return NextResponse.json({ error: 'Plan entry not found' }, { status: 404 });
        }

        // Verify access
        if (!isSuperadmin && existingEntry.club_id !== auth.clubId) {
          return forbiddenResponse('You do not have access to this plan entry');
        }

        const body: UpdatePlanEntryRequest = await request.json();

        // Build update object
        const updateData: Partial<typeof seasonPlanEntries.$inferInsert> = {};

        if (body.trainer_id !== undefined) updateData.trainer_id = body.trainer_id;
        if (body.court_id !== undefined) updateData.court_id = body.court_id;
        if (body.group_id !== undefined) updateData.group_id = body.group_id;
        if (body.day_of_week !== undefined) {
          if (body.day_of_week < 0 || body.day_of_week > 6) {
            return NextResponse.json(
              { error: 'day_of_week must be between 0 and 6' },
              { status: 400 }
            );
          }
          updateData.day_of_week = body.day_of_week;
        }
        if (body.start_time !== undefined) updateData.start_time = body.start_time;
        if (body.end_time !== undefined) updateData.end_time = body.end_time;
        if (body.duration_minutes !== undefined)
          updateData.duration_minutes = body.duration_minutes;
        if (body.starts_from_week !== undefined)
          updateData.starts_from_week = body.starts_from_week;
        if (body.ends_at_week !== undefined) updateData.ends_at_week = body.ends_at_week;
        if (body.entry_type !== undefined) updateData.entry_type = body.entry_type;
        if (body.planning_source !== undefined) updateData.planning_source = body.planning_source;
        if (body.max_participants !== undefined)
          updateData.max_participants = body.max_participants;
        if (body.expected_participants !== undefined)
          updateData.expected_participants = body.expected_participants;
        if (body.status !== undefined) updateData.status = body.status;
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.admin_notes !== undefined) updateData.admin_notes = body.admin_notes;

        // Validate time changes
        const finalStartTime = updateData.start_time || existingEntry.start_time;
        const finalEndTime = updateData.end_time || existingEntry.end_time;

        if (finalStartTime >= finalEndTime) {
          return NextResponse.json(
            { error: 'start_time must be before end_time' },
            { status: 400 }
          );
        }

        // Check for conflicts if time/trainer/court changed
        if (
          body.day_of_week !== undefined ||
          body.start_time !== undefined ||
          body.end_time !== undefined ||
          body.trainer_id !== undefined ||
          body.court_id !== undefined
        ) {
          const finalDayOfWeek = updateData.day_of_week ?? existingEntry.day_of_week;
          const finalTrainerId = updateData.trainer_id ?? existingEntry.trainer_id;
          const finalCourtId = updateData.court_id ?? existingEntry.court_id;

          const conflicts = await db
            .select()
            .from(seasonPlanEntries)
            .where(
              and(
                eq(seasonPlanEntries.season_id, seasonId),
                eq(seasonPlanEntries.day_of_week, finalDayOfWeek),
                sql`${seasonPlanEntries.id} != ${entryId}`,
                sql`(
                  (${seasonPlanEntries.start_time} < ${finalEndTime} AND ${seasonPlanEntries.end_time} > ${finalStartTime})
                  AND (
                    ${seasonPlanEntries.trainer_id} = ${finalTrainerId}
                    ${finalCourtId ? sql`OR ${seasonPlanEntries.court_id} = ${finalCourtId}` : sql``}
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
        }

        // Perform update
        const [updatedEntry] = await db
          .update(seasonPlanEntries)
          .set(updateData)
          .where(eq(seasonPlanEntries.id, entryId))
          .returning();

        return NextResponse.json({
          success: true,
          entry: updatedEntry,
          message: 'Plan entry updated successfully',
        });
      } catch (error) {
        console.error(`PATCH /api/seasons/${seasonId}/plan-entries/${entryId} error:`, error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to update plan entry' },
          { status: 500 }
        );
      }
    });
  });
}

/**
 * DELETE /api/seasons/[id]/plan-entries/[entryId]
 * Delete a plan entry
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      const { id: seasonId, entryId } = await context.params;
      try {
        // Only admins can delete plan entries
        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');

        if (!isAdmin && !isSuperadmin) {
          return forbiddenResponse('Only admins can delete plan entries');
        }

        // Fetch existing entry
        const [existingEntry] = await db
          .select()
          .from(seasonPlanEntries)
          .where(and(eq(seasonPlanEntries.id, entryId), eq(seasonPlanEntries.season_id, seasonId)));

        if (!existingEntry) {
          return NextResponse.json({ error: 'Plan entry not found' }, { status: 404 });
        }

        // Verify access
        if (!isSuperadmin && existingEntry.club_id !== auth.clubId) {
          return forbiddenResponse('You do not have access to this plan entry');
        }

        // Cannot delete published entries
        if (existingEntry.status === 'published' || existingEntry.status === 'active') {
          return NextResponse.json(
            { error: 'Cannot delete published or active entries' },
            { status: 400 }
          );
        }

        // Delete entry
        await db.delete(seasonPlanEntries).where(eq(seasonPlanEntries.id, entryId));

        return NextResponse.json({
          success: true,
          message: 'Plan entry deleted successfully',
        });
      } catch (error) {
        console.error(`DELETE /api/seasons/${seasonId}/plan-entries/${entryId} error:`, error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to delete plan entry' },
          { status: 500 }
        );
      }
    });
  });
}
