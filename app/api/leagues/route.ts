import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * GET /api/leagues — List leagues for the club
 * POST /api/leagues — Create a new league
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Authentication required');

    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'No club' }, { status: 400 });

    const { data: leagues, error } = await (auth.supabase as any)
      .from('leagues')
      .select('*')
      .eq('club_id', clubId)
      .order('season_year', { ascending: false })
      .order('name');

    if (error) {
      console.error('[Leagues GET] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
    }

    // Fetch teams for all leagues
    const leagueIds = (leagues ?? []).map((l: any) => l.id);
    const teamsByLeague: Record<string, any[]> = {};
    if (leagueIds.length > 0) {
      const { data: teams } = await (auth.supabase as any)
        .from('teams')
        .select('id, league_id, name, points, matches_played, matches_won, matches_lost, position')
        .in('league_id', leagueIds);
      for (const t of teams ?? []) {
        if (!teamsByLeague[t.league_id]) teamsByLeague[t.league_id] = [];
        teamsByLeague[t.league_id].push(t);
      }
    }

    const enriched = (leagues ?? []).map((l: any) => ({ ...l, teams: teamsByLeague[l.id] ?? [] }));

    return NextResponse.json({ leagues: enriched });
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'No club' }, { status: 400 });

    const body = await request.json();
    const { name, season_year, league_type, division, sport, age_group, notes, nuliga_url } = body;

    if (!name || !season_year) {
      return NextResponse.json({ error: 'Name and season year required' }, { status: 400 });
    }

    const { data, error } = await (auth.supabase as any)
      .from('leagues')
      .insert({
        club_id: clubId,
        name,
        season_year,
        league_type: league_type ?? 'regular',
        division: division ?? null,
        sport: sport ?? 'tennis',
        age_group: age_group ?? null,
        notes: notes ?? null,
        nuliga_url: nuliga_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[Leagues POST] Error:', error);
      return NextResponse.json({ error: 'Failed to create league' }, { status: 500 });
    }

    return NextResponse.json({ league: data }, { status: 201 });
  });
}
