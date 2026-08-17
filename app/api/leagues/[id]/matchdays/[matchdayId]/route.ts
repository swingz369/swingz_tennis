import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * PATCH /api/leagues/[id]/matchdays/[matchdayId] — Update a match day (e.g. record result)
 * DELETE /api/leagues/[id]/matchdays/[matchdayId] — Delete a match day
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchdayId: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { id: leagueId, matchdayId } = await params;
    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
    }
    const body = await request.json();

    // Verify league belongs to club
    const { data: league } = await auth.supabase
      .from('leagues')
      .select('id')
      .eq('id', leagueId)
      .eq('club_id', auth.clubId)
      .single();

    if (!league) {
      return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });
    }

    const { data, error } = await auth.supabase
      .from('match_days')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', matchdayId)
      .eq('league_id', leagueId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Spieltag konnte nicht aktualisiert werden' },
        { status: 500 }
      );
    }

    return NextResponse.json({ match_day: data });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchdayId: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { id: leagueId, matchdayId } = await params;
    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
    }

    // Verify league belongs to club
    const { data: league } = await auth.supabase
      .from('leagues')
      .select('id')
      .eq('id', leagueId)
      .eq('club_id', auth.clubId)
      .single();

    if (!league) {
      return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });
    }

    const { data, error } = await auth.supabase
      .from('match_days')
      .delete()
      .eq('id', matchdayId)
      .eq('league_id', leagueId)
      .select('id');

    if (error) {
      return NextResponse.json({ error: 'Spieltag konnte nicht gelöscht werden' }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Spieltag nicht gefunden oder keine Berechtigung zum Löschen' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  });
}
