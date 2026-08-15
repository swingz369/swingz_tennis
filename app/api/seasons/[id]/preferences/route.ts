import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { db } from '@/src/infrastructure/persistence/db';
import { seasons, userTrainingPreferences, users } from '@/src/infrastructure/persistence/schema';
import { and, eq, desc } from 'drizzle-orm';
import type { SubmitPreferencesRequest } from '@/lib/types/season-planning';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:preferences');

interface RouteContext {
  params: Promise<{
    id: string; // season_id
  }>;
}

/**
 * GET /api/seasons/[id]/preferences
 * Get all user preferences for a season
 *
 * Admin/Superadmin: See all preferences
 * Others: See only their own preference
 *
 * Query params:
 * - user_id: Filter by user (admin only)
 * - is_submitted: Filter by submission status
 * - user_role: Filter by role (admin only)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const { searchParams } = new URL(request.url);

      // Verify season exists
      const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));

      if (!season) {
        return NextResponse.json({ error: 'Season not found' }, { status: 404 });
      }

      // Verify user has access to this club
      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');

      if (!isAdmin && !isSuperadmin) {
        const hasClubAccess = auth.memberships.some((m) => m.club_id === season.club_id);
        if (!hasClubAccess) {
          return forbiddenResponse('Kein Zugriff auf diese Saison');
        }
      }

      // Build query conditions
      const conditions = [eq(userTrainingPreferences.season_id, seasonId)];

      // Non-admins can only see their own preferences
      if (!isAdmin && !isSuperadmin) {
        conditions.push(eq(userTrainingPreferences.user_id, auth.user?.id));
      } else {
        // Admin filters
        const userIdFilter = searchParams.get('user_id');
        const userRoleFilter = searchParams.get('user_role');
        const isSubmittedFilter = searchParams.get('is_submitted');

        if (userIdFilter) {
          conditions.push(eq(userTrainingPreferences.user_id, userIdFilter));
        }

        if (userRoleFilter) {
          conditions.push(eq(userTrainingPreferences.user_role, userRoleFilter));
        }

        if (isSubmittedFilter !== null) {
          conditions.push(eq(userTrainingPreferences.is_submitted, isSubmittedFilter === 'true'));
        }
      }

      // Fetch preferences with user details
      const preferences = await db
        .select({
          preference: userTrainingPreferences,
          user_name: users.full_name,
          user_email: users.email,
        })
        .from(userTrainingPreferences)
        .leftJoin(users, eq(userTrainingPreferences.user_id, users.id))
        .where(and(...conditions))
        .orderBy(desc(userTrainingPreferences.submitted_at));

      return NextResponse.json({
        success: true,
        preferences: preferences.map((p) => ({
          ...p.preference,
          user_name: p.user_name,
          user_email: p.user_email,
        })),
        count: preferences.length,
      });
    } catch (error) {
      log.error(`GET /api/seasons/[id]/preferences error:`, error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch preferences' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/seasons/[id]/preferences
 * Submit or update user preferences for a season
 *
 * Body: SubmitPreferencesRequest
 */
export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;

        // Verify season exists
        const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));

        if (!season) {
          return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }

        // Verify user has access to this club
        const hasClubAccess = auth.memberships.some((m) => m.club_id === season.club_id);
        if (!hasClubAccess) {
          return forbiddenResponse('Kein Zugriff auf diese Saison');
        }

        // Check if preferences are open
        if (!season.preferences_open) {
          return NextResponse.json(
            { error: 'Preferences are not open for this season' },
            { status: 400 }
          );
        }

        // Check deadline
        if (season.preferences_deadline && new Date() > season.preferences_deadline) {
          return NextResponse.json({ error: 'Preferences deadline has passed' }, { status: 400 });
        }

        const body: SubmitPreferencesRequest = await request.json();

        // Validate required fields
        if (!body.user_role || !body.weekly_availability) {
          return NextResponse.json(
            { error: 'Missing required fields: user_role, weekly_availability' },
            { status: 400 }
          );
        }

        // Check if preference already exists
        const [existingPreference] = await db
          .select()
          .from(userTrainingPreferences)
          .where(
            and(
              eq(userTrainingPreferences.season_id, seasonId),
              eq(userTrainingPreferences.user_id, auth.user?.id)
            )
          );

        if (existingPreference) {
          // Update existing preference
          const [updated] = await db
            .update(userTrainingPreferences)
            .set({
              user_role: body.user_role,
              preferred_level: body.preferred_level || null,
              preferred_age_group: body.preferred_age_group || null,
              preferred_group_ids: body.preferred_group_ids || [],
              weekly_availability: body.weekly_availability,
              unavailable_dates: body.unavailable_dates || [],
              max_sessions_per_week: body.max_sessions_per_week || null,
              preferred_court_ids: body.preferred_court_ids || [],
              can_teach_groups: body.can_teach_groups || [],
              priority: body.priority || 5,
              special_requests: body.special_requests || null,
              notes: body.notes || null,
              is_submitted: true,
              submitted_at: new Date(),
            })
            .where(eq(userTrainingPreferences.id, existingPreference.id))
            .returning();

          return NextResponse.json({
            success: true,
            preference: updated,
            message: 'Preferences updated successfully',
          });
        } else {
          // Create new preference
          const [newPreference] = await db
            .insert(userTrainingPreferences)
            .values({
              season_id: seasonId,
              user_id: auth.user?.id,
              club_id: season.club_id,
              user_role: body.user_role,
              preferred_level: body.preferred_level || null,
              preferred_age_group: body.preferred_age_group || null,
              preferred_group_ids: body.preferred_group_ids || [],
              weekly_availability: body.weekly_availability,
              unavailable_dates: body.unavailable_dates || [],
              max_sessions_per_week: body.max_sessions_per_week || null,
              preferred_court_ids: body.preferred_court_ids || [],
              can_teach_groups: body.can_teach_groups || [],
              priority: body.priority || 5,
              special_requests: body.special_requests || null,
              notes: body.notes || null,
              is_submitted: true,
              submitted_at: new Date(),
            })
            .returning();

          return NextResponse.json(
            {
              success: true,
              preference: newPreference,
              message: 'Preferences submitted successfully',
            },
            { status: 201 }
          );
        }
      } catch (error) {
        log.error(`POST /api/seasons/[id]/preferences error:`, error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to submit preferences' },
          { status: 500 }
        );
      }
    });
  });
}
