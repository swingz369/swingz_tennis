import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';

interface RouteContext {
  params: Promise<{ id: string }>;
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
      const supabase = auth.supabase;

      const { data: season, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !season) {
        return NextResponse.json({ error: 'Season not found' }, { status: 404 });
      }

      const isSuperadmin = await verifyRole(auth, 'superadmin');
      if (!isSuperadmin && season.club_id !== auth.clubId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Attach basic stats
      const { count: submittedPreferences } = await supabase
        .from('season_preferences')
        .select('*', { count: 'exact', head: true })
        .eq('season_id', id)
        .eq('submitted', true);

      const { count: totalPreferences } = await supabase
        .from('season_preferences')
        .select('*', { count: 'exact', head: true })
        .eq('season_id', id);

      const { count: plannedEntries } = await supabase
        .from('season_plan_entries')
        .select('*', { count: 'exact', head: true })
        .eq('season_id', id);

      const { count: openConflicts } = await supabase
        .from('planning_conflicts')
        .select('*', { count: 'exact', head: true })
        .eq('season_id', id)
        .eq('resolved', false);

      const { count: trainersCount } = await supabase
        .from('season_trainer_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('season_id', id);

      const { count: groupsCovered } = await supabase
        .from('season_plan_entries')
        .select('group_id', { count: 'exact', head: true })
        .eq('season_id', id);

      return NextResponse.json({
        season: {
          ...season,
          submitted_preferences: submittedPreferences ?? 0,
          total_preferences: totalPreferences ?? 0,
          planned_entries: plannedEntries ?? 0,
          open_conflicts: openConflicts ?? 0,
          trainers_count: trainersCount ?? 0,
          groups_covered: groupsCovered ?? 0,
        },
      });
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
        const supabase = auth.supabase;

        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');
        if (!isAdmin && !isSuperadmin) {
          return forbiddenResponse('Only admins can update seasons');
        }

        const { data: existing, error: fetchError } = await supabase
          .from('seasons')
          .select('id, club_id, planning_status')
          .eq('id', id)
          .single();

        if (fetchError || !existing) {
          return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }
        if (!isSuperadmin && existing.club_id !== auth.clubId) {
          return forbiddenResponse('You do not have access to this season');
        }

        const body = await request.json();
        const allowed = [
          'name', 'season_type', 'year', 'start_date', 'end_date',
          'preferences_deadline', 'description', 'notes',
          'planning_status', 'preferences_open', 'is_active',
        ] as const;

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const field of allowed) {
          if (body[field] !== undefined) {
            updates[field] = body[field] === '' ? null : body[field];
          }
        }

        const { data: updated, error: updateError } = await supabase
          .from('seasons')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (updateError) throw updateError;

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
        const supabase = auth.supabase;

        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');
        if (!isAdmin && !isSuperadmin) {
          return forbiddenResponse('Only admins can delete seasons');
        }

        const { data: existing, error: fetchError } = await supabase
          .from('seasons')
          .select('id, club_id, planning_status')
          .eq('id', id)
          .single();

        if (fetchError || !existing) {
          return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }
        if (!isSuperadmin && existing.club_id !== auth.clubId) {
          return forbiddenResponse('You do not have access to this season');
        }
        if (existing.planning_status !== 'draft') {
          return NextResponse.json(
            { error: 'Only draft seasons can be deleted' },
            { status: 400 }
          );
        }

        const { error: deleteError } = await supabase.from('seasons').delete().eq('id', id);
        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });
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
