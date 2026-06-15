import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * GET /api/leagues/[id] — Get league with teams and match days
 * PATCH /api/leagues/[id] — Update league
 * DELETE /api/leagues/[id] — Delete league
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Authentication required');

    const { id } = await params;

    // Fetch league (separate queries to avoid deep type instantiation on new tables)
    const { data: league, error } = await (auth.supabase as any)
      .from('leagues')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    // Fetch teams for this league
    const { data: teams } = await (auth.supabase as any)
      .from('teams')
      .select(
        'id, name, captain_id, position, points, matches_played, matches_won, matches_lost, matches_drawn, notes'
      )
      .eq('league_id', id);

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

    // Fetch match days
    const { data: matchDays } = await (auth.supabase as any)
      .from('match_days')
      .select(
        'id, matchday_number, scheduled_date, opponent, is_home, venue, result, score_home, score_away, status, notes'
      )
      .eq('league_id', id)
      .order('matchday_number', { ascending: true });

    // Enrich team members with user names
    const allMemberIds = new Set<string>();
    for (const m of teamMembers) {
      if (m.member_id) allMemberIds.add(m.member_id);
    }

    let memberNames: Record<string, string> = {};
    let memberDtbIds: Record<string, string | null> = {};
    if (allMemberIds.size > 0) {
      const { data: users } = await (auth.supabase as any)
        .from('users')
        .select('id, full_name, dtb_id')
        .in('id', [...allMemberIds]);

      memberNames = Object.fromEntries(
        (users ?? []).map((u: any) => [u.id, u.full_name ?? 'Unbekannt'])
      );
      memberDtbIds = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.dtb_id ?? null]));
    }

    // Attach members to teams
    const enrichedTeams = (teams ?? []).map((team: any) => ({
      ...team,
      members: teamMembers
        .filter((m) => m.team_id === team.id)
        .map((m) => ({
          ...m,
          name: memberNames[m.member_id] ?? 'Unbekannt',
          dtb_id: memberDtbIds?.[m.member_id] ?? null,
        })),
      team_members: undefined,
    }));

    return NextResponse.json({
      league: { ...league, teams: enrichedTeams, match_days: matchDays ?? [] },
    });
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const { id } = await params;
    const body = await request.json();

    const { data, error } = await (auth.supabase as any)
      .from('leagues')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: 'Failed to update league' }, { status: 500 });
    return NextResponse.json({ league: data });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const { id } = await params;

    const { error } = await (auth.supabase as any)
      .from('leagues')
      .delete()
      .eq('id', id)
      .eq('club_id', auth.clubId);

    if (error) return NextResponse.json({ error: 'Failed to delete league' }, { status: 500 });
    return NextResponse.json({ success: true });
  });
}
