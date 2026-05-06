import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { getDb } from '@/src/infrastructure/persistence/client';
import { seasons, userTrainingPreferences, users } from '@/src/infrastructure/persistence/schema';
import { and, eq } from 'drizzle-orm';
import type { UpdatePreferencesRequest } from '@/lib/types/season-planning';

interface RouteContext {
  params: Promise<{
    id: string; // season_id
    userId: string;
  }>;
}

/**
 * GET /api/seasons/[id]/preferences/[userId]
 * Get a specific user's preference for a season
 *
 * Users can only view their own preference
 * Admins can view any preference
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const db = getDb();
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    const db = getDb();
    const { id: seasonId, userId } = await context.params;
    try {
      // Verify season exists
      const [season] = await getDb().select().from(seasons).where(eq(seasons.id, seasonId));

      if (!season) {
        return NextResponse.json({ error: 'Season not found' }, { status: 404 });
      }

      // Check permissions
      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');
      const isOwnPreference = userId === auth.user?.id;

      if (!isOwnPreference && !isAdmin && !isSuperadmin) {
        return forbiddenResponse('You can only view your own preferences');
      }

      // Fetch preference with user details
      const [result] = await db
        .select({
          preference: userTrainingPreferences,
          user_name: users.full_name,
          user_email: users.email,
        })
        .from(userTrainingPreferences)
        .leftJoin(users, eq(userTrainingPreferences.user_id, users.id))
        .where(
          and(
            eq(userTrainingPreferences.season_id, seasonId),
            eq(userTrainingPreferences.user_id, userId)
          )
        );

      if (!result) {
        return NextResponse.json({ error: 'Preference not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        preference: {
          ...result.preference,
          user_name: result.user_name,
          user_email: result.user_email,
        },
      });
    } catch (error) {
      console.error(`GET /api/seasons/[id]/preferences/${userId} error:`, error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch preference' },
        { status: 500 }
      );
    }
  });
}

/**
 * PATCH /api/seasons/[id]/preferences/[userId]
 * Update a user's preference (draft mode, not submitted)
 *
 * Users can only update their own preference
 * Admins can update any preference
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const db = getDb();
  return withCSRFProtection(request, async () => {
    const db = getDb();
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      const db = getDb();
      const { id: seasonId, userId } = await context.params;
      try {
        // Check permissions
        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');
        const isOwnPreference = userId === auth.user?.id;

        if (!isOwnPreference && !isAdmin && !isSuperadmin) {
          return forbiddenResponse('You can only update your own preferences');
        }

        // Verify season exists
        const [season] = await getDb().select().from(seasons).where(eq(seasons.id, seasonId));

        if (!season) {
          return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }

        // Check if preferences are still open
        if (!season.preferences_open && !isAdmin && !isSuperadmin) {
          return NextResponse.json(
            { error: 'Preferences are not open for this season' },
            { status: 400 }
          );
        }

        // Fetch existing preference
        const [existingPreference] = await db
          .select()
          .from(userTrainingPreferences)
          .where(
            and(
              eq(userTrainingPreferences.season_id, seasonId),
              eq(userTrainingPreferences.user_id, userId)
            )
          );

        if (!existingPreference) {
          return NextResponse.json({ error: 'Preference not found' }, { status: 404 });
        }

        const body: UpdatePreferencesRequest = await request.json();

        // Build update object
        const updateData: Partial<typeof userTrainingPreferences.$inferInsert> = {};

        if (body.user_role !== undefined) updateData.user_role = body.user_role;
        if (body.preferred_level !== undefined) updateData.preferred_level = body.preferred_level;
        if (body.preferred_age_group !== undefined)
          updateData.preferred_age_group = body.preferred_age_group;
        if (body.preferred_group_ids !== undefined)
          updateData.preferred_group_ids = body.preferred_group_ids;
        if (body.weekly_availability !== undefined)
          updateData.weekly_availability = body.weekly_availability;
        if (body.unavailable_dates !== undefined)
          updateData.unavailable_dates = body.unavailable_dates;
        if (body.max_sessions_per_week !== undefined)
          updateData.max_sessions_per_week = body.max_sessions_per_week;
        if (body.preferred_court_ids !== undefined)
          updateData.preferred_court_ids = body.preferred_court_ids;
        if (body.can_teach_groups !== undefined)
          updateData.can_teach_groups = body.can_teach_groups;
        if (body.priority !== undefined) updateData.priority = body.priority;
        if (body.special_requests !== undefined)
          updateData.special_requests = body.special_requests;
        if (body.notes !== undefined) updateData.notes = body.notes;

        // Handle submission
        if (body.is_submitted !== undefined) {
          updateData.is_submitted = body.is_submitted;
          if (body.is_submitted) {
            updateData.submitted_at = new Date();
          }
        }

        // Perform update
        const [updatedPreference] = await db
          .update(userTrainingPreferences)
          .set(updateData)
          .where(eq(userTrainingPreferences.id, existingPreference.id))
          .returning();

        return NextResponse.json({
          success: true,
          preference: updatedPreference,
          message: 'Preference updated successfully',
        });
      } catch (error) {
        console.error(`PATCH /api/seasons/[id]/preferences/${userId} error:`, error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to update preference' },
          { status: 500 }
        );
      }
    });
  });
}

/**
 * DELETE /api/seasons/[id]/preferences/[userId]
 * Delete a user's preference
 *
 * Users can only delete their own preference
 * Admins can delete any preference
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const db = getDb();
  return withCSRFProtection(request, async () => {
    const db = getDb();
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      const db = getDb();
      const { id: seasonId, userId } = await context.params;
      try {
        // Check permissions
        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');
        const isOwnPreference = userId === auth.user?.id;

        if (!isOwnPreference && !isAdmin && !isSuperadmin) {
          return forbiddenResponse('You can only delete your own preferences');
        }

        // Fetch existing preference
        const [existingPreference] = await db
          .select()
          .from(userTrainingPreferences)
          .where(
            and(
              eq(userTrainingPreferences.season_id, seasonId),
              eq(userTrainingPreferences.user_id, userId)
            )
          );

        if (!existingPreference) {
          return NextResponse.json({ error: 'Preference not found' }, { status: 404 });
        }

        // Delete preference
        await db
          .delete(userTrainingPreferences)
          .where(eq(userTrainingPreferences.id, existingPreference.id));

        return NextResponse.json({
          success: true,
          message: 'Preference deleted successfully',
        });
      } catch (error) {
        console.error(`DELETE /api/seasons/${seasonId}/preferences/${userId} error:`, error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to delete preference' },
          { status: 500 }
        );
      }
    });
  });
}
