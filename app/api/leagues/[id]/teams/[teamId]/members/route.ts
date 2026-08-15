import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * POST /api/leagues/[id]/teams/[teamId]/members — Add member(s) to a team
 * DELETE /api/leagues/[id]/teams/[teamId]/members — Remove a member from a team (via body.member_id)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { teamId } = await params;
    const body = await request.json();
    const { member_ids, role, position_number } = body;

    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return NextResponse.json({ error: 'member_ids-Array erforderlich' }, { status: 400 });
    }

    // Verify team belongs to the club
    const { data: team } = await (auth.supabase as any)
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .eq('club_id', auth.clubId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Mannschaft nicht gefunden' }, { status: 404 });
    }

    const rows = member_ids.map((memberId: string) => ({
      team_id: teamId,
      member_id: memberId,
      role: role ?? 'player',
      position_number: position_number ?? null,
    }));

    const { data, error } = await (auth.supabase as any).from('team_members').insert(rows).select();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Mitglied bereits in der Mannschaft' }, { status: 409 });
      }
      return NextResponse.json(
        { error: 'Mitglieder konnten nicht hinzugefügt werden' },
        { status: 500 }
      );
    }

    return NextResponse.json({ members: data }, { status: 201 });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { teamId } = await params;
    const body = await request.json();
    const { member_id } = body;

    if (!member_id) {
      return NextResponse.json({ error: 'member_id erforderlich' }, { status: 400 });
    }

    const { error } = await (auth.supabase as any)
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('member_id', member_id);

    if (error) {
      return NextResponse.json({ error: 'Mitglied konnte nicht entfernt werden' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
