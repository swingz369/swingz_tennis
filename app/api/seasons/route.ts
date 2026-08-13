/**
 * GET /api/seasons — Fetch seasons for a club using Supabase client
 * POST /api/seasons — Create a new season
 *
 * Rewritten to use Supabase client directly instead of Drizzle ORM
 * (Drizzle requires DATABASE_URL which is not always available).
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons');

function isTableNotFound(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    (error.message?.includes('relation') ?? false) ||
    (error.message?.includes('does not exist') ?? false)
  );
}

function migrationRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'Season planning database tables not yet configured.',
      detail: 'The seasons table does not exist. Run the migration script to create it.',
      migration_command:
        'psql "$DATABASE_URL" -f supabase/migrations/20260506_season_planning_system.sql',
    },
    { status: 503 }
  );
}

export async function GET(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { searchParams } = new URL(request.url);

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

      if (!isAdmin && !isSuperadmin) {
        const hasClubAccess = auth.memberships.some((m) => m.club_id === clubId);
        if (!hasClubAccess) {
          return forbiddenResponse('You do not have access to this club');
        }
      }

      const supabase = auth.supabase;

      let query = supabase
        .from('seasons')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });

      if (seasonType) {
        query = query.eq('season_type', seasonType);
      }

      if (year) {
        query = query.eq('year', parseInt(year));
      }

      if (planningStatus) {
        const statuses = planningStatus.split(',');
        if (statuses.length === 1) {
          query = query.eq('planning_status', statuses[0]);
        } else {
          query = query.in('planning_status', statuses);
        }
      }

      if (isActive !== null && isActive !== undefined && isActive !== '') {
        query = query.eq('is_active', isActive === 'true');
      }

      const { data: seasonsData, error } = await query;

      if (error) {
        // Table may not exist yet — return empty list gracefully
        if (
          error.code === '42P01' ||
          error.message?.includes('relation') ||
          error.message?.includes('does not exist')
        ) {
          log.warn('⚠️  Seasons table not found. Run required migration.');
          return NextResponse.json({
            success: true,
            seasons: [],
            count: 0,
            warning: 'Season planning feature not yet available. Database migration required.',
          });
        }
        log.error('GET /api/seasons error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        seasons: seasonsData ?? [],
        count: (seasonsData ?? []).length,
      });
    } catch (error) {
      log.error('GET /api/seasons error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch seasons' },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');

      if (!isAdmin && !isSuperadmin) {
        return forbiddenResponse('Only admins can create seasons');
      }

      const body = await request.json();

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

      if (!isSuperadmin) {
        const hasClubAccess = auth.memberships.some(
          (m) => m.club_id === body.club_id && (m.role === 'admin' || m.role === 'superadmin')
        );
        if (!hasClubAccess) return forbiddenResponse('You do not have access to this club');
      }

      const startDate = new Date(body.start_date);
      const endDate = new Date(body.end_date);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Ungültiges Datumsformat. Bitte Start- und Enddatum prüfen.' },
          { status: 400 }
        );
      }

      if (startDate >= endDate) {
        return NextResponse.json({ error: 'start_date must be before end_date' }, { status: 400 });
      }

      const supabase = auth.supabase;

      // Check for duplicate season
      const { data: existing, error: checkError } = await supabase
        .from('seasons')
        .select('id')
        .eq('club_id', body.club_id)
        .eq('season_type', body.season_type)
        .eq('year', body.year)
        .maybeSingle();

      // Table may not exist yet — return graceful error instead of 500
      if (checkError && isTableNotFound(checkError)) {
        return migrationRequiredResponse();
      }

      if (existing) {
        return NextResponse.json(
          {
            error: `Für ${body.season_type === 'winter' ? 'die Wintersaison' : 'die Sommersaison'} ${body.year} existiert bereits eine Saison.`,
          },
          { status: 409 }
        );
      }

      const { data: newSeason, error: insertError } = await supabase
        .from('seasons')
        .insert({
          club_id: body.club_id,
          name: body.name,
          season_type: body.season_type,
          year: body.year,
          start_date: body.start_date,
          end_date: body.end_date,
          preferences_deadline: body.preferences_deadline || null,
          description: body.description || null,
          notes: body.notes || null,
          created_by: auth.user?.id,
          planning_status: 'collecting_preferences',
          preferences_open: true,
          is_active: false,
          auto_plan_enabled: true,
        })
        .select()
        .single();

      if (insertError) {
        log.error('POST /api/seasons insert error:', insertError);
        // Table may not exist yet — return graceful error instead of 500
        if (isTableNotFound(insertError)) {
          return migrationRequiredResponse();
        }
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, season: newSeason }, { status: 201 });
    } catch (error) {
      log.error('POST /api/seasons error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to create season' },
        { status: 500 }
      );
    }
  });
}
