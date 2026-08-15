import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * PATCH /api/leagues/[id]/teams/[teamId] — Update a team
 * DELETE /api/leagues/[id]/teams/[teamId] — Delete a team
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { id: leagueId, teamId } = await params;
    const body = await request.json();

    // Verify league belongs to club
    const { data: league } = await (auth.supabase as any)
      .from('leagues')
      .select('id')
      .eq('id', leagueId)
      .eq('club_id', auth.clubId)
      .single();

    if (!league) {
      return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });
    }

    const { data, error } = await (auth.supabase as any)
      .from('teams')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', teamId)
      .eq('club_id', auth.clubId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Mannschaft konnte nicht aktualisiert werden' },
        { status: 500 }
      );
    }

    return NextResponse.json({ team: data });
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

    // `.select()`: ohne das meldet ein Delete, das RLS oder der club_id-Filter
    // auf null Zeilen reduziert hat, trotzdem Erfolg — die UI log dann.
    const { data, error } = await (auth.supabase as any)
      .from('teams')
      .delete()
      .eq('id', teamId)
      .eq('club_id', auth.clubId)
      .select('id');

    if (error) {
      return NextResponse.json(
        { error: 'Mannschaft konnte nicht gelöscht werden' },
        { status: 500 }
      );
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Team nicht gefunden oder keine Berechtigung zum Löschen' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  });
}
