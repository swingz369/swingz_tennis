import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { createLogger } from '@/lib/logger';
import { detectConflictsForSeason } from '@/lib/season-planning/conflict-detector';

const log = createLogger('api:seasons:[id]');

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
        return NextResponse.json({ error: 'Saison nicht gefunden' }, { status: 404 });
      }

      const isSuperadmin = await verifyRole(auth, 'superadmin');
      if (!isSuperadmin) {
        const hasClubAccess = auth.memberships.some((m) => m.club_id === season.club_id);
        if (!hasClubAccess) {
          return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
        }
      }

      // Aggregate real stats from related tables
      const seasonId = season.id;
      const clubId = season.club_id;

      const [
        { count: totalPrefs },
        { count: submittedPrefs },
        { count: plannedEntries },
        openConflictsResult,
        { count: trainerCount },
        { data: groupsData },
      ] = await Promise.all([
        // Erwartete Präferenzen = alle planungsrelevanten Mitglieder des Vereins
        clubId
          ? supabase
              .from('user_club_memberships')
              .select('id', { count: 'exact', head: true })
              .eq('club_id', clubId)
              .eq('role', 'member')
              .eq('is_active', true)
              .eq('include_in_planning', true)
          : Promise.resolve({ count: 0 }),
        supabase
          .from('user_training_preferences')
          .select('id', { count: 'exact', head: true })
          .eq('season_id', seasonId)
          .eq('user_role', 'member')
          .eq('is_submitted', true),
        supabase
          .from('season_plan_entries')
          .select('id', { count: 'exact', head: true })
          .eq('season_id', seasonId),
        detectConflictsForSeason(seasonId, clubId ?? ''),
        clubId
          ? supabase
              .from('user_club_memberships')
              .select('id', { count: 'exact', head: true })
              .eq('club_id', clubId)
              .eq('role', 'trainer')
              .eq('is_active', true)
          : Promise.resolve({ count: 0 }),
        supabase
          .from('season_plan_entries')
          .select('group_id')
          .eq('season_id', seasonId)
          .not('group_id', 'is', null),
      ]);

      const groupsCovered = new Set((groupsData ?? []).map((g: any) => g.group_id).filter(Boolean))
        .size;

      return NextResponse.json({
        season: {
          ...season,
          submitted_preferences: submittedPrefs ?? 0,
          total_preferences: totalPrefs ?? 0,
          planned_entries: plannedEntries ?? 0,
          open_conflicts: openConflictsResult.summary.total,
          trainers_count: trainerCount ?? 0,
          groups_covered: groupsCovered,
        },
      });
    } catch (error) {
      log.error(`GET /api/seasons/[id] error:`, error);
      return internalErrorResponse();
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
          return forbiddenResponse('Nur Admins können Saisons ändern');
        }

        const { data: existing, error: fetchError } = await supabase
          .from('seasons')
          .select('id, club_id, planning_status')
          .eq('id', id)
          .single();

        if (fetchError || !existing) {
          return NextResponse.json({ error: 'Saison nicht gefunden' }, { status: 404 });
        }
        if (!isSuperadmin) {
          const hasClubAccess = auth.memberships.some(
            (m) => m.club_id === existing.club_id && (m.role === 'admin' || m.role === 'superadmin')
          );
          if (!hasClubAccess) return forbiddenResponse('Kein Zugriff auf diese Saison');
        }

        const body = await request.json();

        // Trainingspläne/Sessions/Buchungen werden aus season_type/Zeitraum
        // abgeleitet — nach der Veröffentlichung dürfen sie nicht mehr geändert
        // werden, sonst laufen sie aus dem Ruder der bereits generierten Daten.
        const structuralFields = ['season_type', 'year', 'start_date', 'end_date'] as const;
        if (
          existing.planning_status !== 'draft' &&
          structuralFields.some((field) => body[field] !== undefined)
        ) {
          return NextResponse.json(
            {
              error:
                'Saison-Typ, Jahr und Zeitraum können nach der Veröffentlichung nicht mehr geändert werden.',
            },
            { status: 409 }
          );
        }

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
          'auto_plan_config',
        ] as const;

        const updates: any = { updated_at: new Date().toISOString() };
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

        if (updateError) {
          log.error(`PATCH /api/seasons/[id] supabase error:`, JSON.stringify(updateError));
          return internalErrorResponse();
        }

        return NextResponse.json({ season: updated });
      } catch (error) {
        log.error(`PATCH /api/seasons/[id] error:`, error);
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : (JSON.stringify(error) ?? 'Failed to update season'),
          },
          { status: 500 }
        );
      }
    });
  });
}

/**
 * DELETE /api/seasons/[id]
 * Delete a season (any status)
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
          return forbiddenResponse('Nur Admins können Saisons löschen');
        }

        const { data: existing, error: fetchError } = await supabase
          .from('seasons')
          .select('id, club_id, planning_status')
          .eq('id', id)
          .single();

        if (fetchError || !existing) {
          return NextResponse.json({ error: 'Saison nicht gefunden' }, { status: 404 });
        }
        if (!isSuperadmin) {
          const hasClubAccess = auth.memberships.some(
            (m) => m.club_id === existing.club_id && (m.role === 'admin' || m.role === 'superadmin')
          );
          if (!hasClubAccess) return forbiddenResponse('Kein Zugriff auf diese Saison');
        }
        const { error: deleteError } = await supabase.from('seasons').delete().eq('id', id);
        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });
      } catch (error) {
        log.error(`DELETE /api/seasons/[id] error:`, error);
        return internalErrorResponse();
      }
    });
  });
}
