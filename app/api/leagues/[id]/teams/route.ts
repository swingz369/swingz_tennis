import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:leagues:[id]:teams');

/**
 * GET /api/leagues/[id]/teams — List teams for a league
 * POST /api/leagues/[id]/teams — Create a new team in a league
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Authentication required');

    const { id } = await params;

    const { data: teams, error } = await (auth.supabase as any)
      .from('teams')
      .select(
        'id, name, captain_id, position, points, matches_played, matches_won, matches_lost, matches_drawn, notes, league_id'
      )
      .eq('league_id', id)
      .order('position', { ascending: true, nullsFirst: true });

    if (error) {
      log.error('[Teams GET] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }

    // Fetch team members for all teams
    const teamIds = (teams ?? []).map((t: any) => t.id);
    let teamMembers: any[] = [];
    if (teamIds.length > 0) {
      const { data: members } = await (auth.supabase as any)
        .from('team_members')
        .select('id, team_id, member_id, role, position_number, is_active')
        .in('team_id', teamIds);
      teamMembers = members ?? [];
    }

    // Enrich with user names
    const allMemberIds = new Set<string>();
    for (const m of teamMembers) {
      if (m.member_id) allMemberIds.add(m.member_id);
    }

    let memberNames: Record<string, string> = {};
    if (allMemberIds.size > 0) {
      const { data: users } = await auth.supabase
        .from('users')
        .select('id, full_name')
        .in('id', [...allMemberIds]);

      memberNames = Object.fromEntries(
        (users ?? []).map((u) => [u.id, u.full_name ?? 'Unbekannt'])
      );
    }

    const enrichedTeams = (teams ?? []).map((team: any) => ({
      ...team,
      members: teamMembers
        .filter((m) => m.team_id === team.id)
        .map((m) => ({ ...m, name: memberNames[m.member_id] ?? 'Unbekannt' })),
    }));

    return NextResponse.json({ teams: enrichedTeams });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const { id } = await params;
    const body = await request.json();
    const { name, captain_id, position, notes } = body;

    if (!name) {
      return NextResponse.json({ error: 'Team name required' }, { status: 400 });
    }

    // Verify league belongs to club
    const { data: league } = await (auth.supabase as any)
      .from('leagues')
      .select('id')
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .single();

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    const { data, error } = await (auth.supabase as any)
      .from('teams')
      .insert({
        league_id: id,
        club_id: auth.clubId,
        name,
        captain_id: captain_id ?? null,
        position: position ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) {
      log.error('[Teams POST] Error:', error);
      return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
    }

    return NextResponse.json({ team: { ...data, members: [] } }, { status: 201 });
  });
}
