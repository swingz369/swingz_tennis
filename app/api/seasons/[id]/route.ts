import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { getDb } from '@/src/infrastructure/persistence/client';
import { seasons } from '@/src/infrastructure/persistence/schema';
import { eq } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/seasons/[id]
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id } = await context.params;

      const [season] = await getDb().select().from(seasons).where(eq(seasons.id, id));

      if (!season) {
        return NextResponse.json({ error: 'Season not found' }, { status: 404 });
      }

      const isSuperadmin = await verifyRole(auth, 'superadmin');
      if (!isSuperadmin && season.club_id !== auth.clubId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      return NextResponse.json({ season });
    } catch (error) {
      console.error(`GET /api/seasons/[id] error:`, error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch season' },
        { status: 500 }
      );
    }
  });
}

/**
 * PATCH /api/seasons/[id]
 * Update season fields. Only admins of the owning club can update.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      try {
        const { id } = await context.params;

        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');
        if (!isAdmin && !isSuperadmin) {
          return forbiddenResponse('Only admins can update seasons');
        }

        const [existingSeason] = await getDb().select().from(seasons).where(eq(seasons.id, id));
        if (!existingSeason) {
          return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }
        if (!isSuperadmin && existingSeason.club_id !== auth.clubId) {
          return forbiddenResponse('You do not have access to this season');
        }

        const body = await request.json();
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        const allowed = [
          'name',
          'season_type',
          'year',
          'start_date',
          'end_date',
          'preferences_deadline',
          'description',
          'notes',
          'planning_status',
          'preferences_open',
          'is_active',
        ] as const;

        for (const field of allowed) {
          if (body[field] !== undefined) {
            updates[field] = body[field] === '' ? null : body[field];
          }
        }

        const [updated] = await getDb()
          .update(seasons)
          .set(updates)
          .where(eq(seasons.id, id))
          .returning();

        return NextResponse.json({ season: updated });
      } catch (error) {
        console.error(`PATCH /api/seasons/[id] error:`, error);
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
 * Delete a season (only draft seasons)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      try {
        const { id } = await context.params;

        // Only admins and superadmins can delete seasons
        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');

        if (!isAdmin && !isSuperadmin) {
          return forbiddenResponse('Only admins can delete seasons');
        }

        // Fetch existing season
        const [existingSeason] = await getDb().select().from(seasons).where(eq(seasons.id, id));

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
        await getDb().delete(seasons).where(eq(seasons.id, id));

        return NextResponse.json({
          success: true,
          message: 'Season deleted successfully',
        });
      } catch (error) {
        console.error(`DELETE /api/seasons/[id] error:`, error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to delete season' },
          { status: 500 }
        );
      }
    });
  });
}
