import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, verifyOffice, forbiddenResponse } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string; matchdayId: string }> };

/**
 * GET  — Aufstellung abrufen
 * POST — Aufstellung speichern (upsert per position)
 * Body: { positions: [{ position_number, position_type, home_player_ids, away_player_ids }] }
 * Rechte: admin oder Mannschaftsführer-Amt.
 */
export async function GET(request: NextRequest, { params }: Params) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) return forbiddenResponse();
    const { id: leagueId, matchdayId } = await params;
    const sb = auth.supabase as any;

    const { data: league } = await sb
      .from('leagues')
      .select('id')
      .eq('id', leagueId)
      .eq('club_id', auth.clubId)
      .maybeSingle();
    if (!league) return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });

    const { data, error } = await sb
      .from('match_results')
      .select('id, position_number, position_type, home_player_ids, away_player_ids, outcome')
      .eq('match_day_id', matchdayId)
      .eq('club_id', auth.clubId)
      .order('position_number');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ lineup: data ?? [] });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return withApiAuth(request, async (auth) => {
    const canEdit =
      (await verifyRole(auth, 'admin')) || (await verifyOffice(auth, 'mannschaftsfuehrer'));
    if (!canEdit) return forbiddenResponse('Admin oder Mannschaftsführer erforderlich');

    const { id: leagueId, matchdayId } = await params;
    const sb = auth.supabase as any;

    const { data: league } = await sb
      .from('leagues')
      .select('id')
      .eq('id', leagueId)
      .eq('club_id', auth.clubId)
      .maybeSingle();
    if (!league) return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });

    const { positions } = (await request.json()) as {
      positions: Array<{
        position_number: number;
        position_type: 'singles' | 'doubles';
        home_player_ids: string[];
        away_player_ids: string[];
      }>;
    };
    if (!Array.isArray(positions) || positions.length === 0)
      return NextResponse.json({ error: 'positions erforderlich' }, { status: 400 });

    const rows = positions.map((p) => ({
      match_day_id: matchdayId,
      club_id: auth.clubId,
      position_number: p.position_number,
      position_type: p.position_type,
      home_player_ids: p.home_player_ids,
      away_player_ids: p.away_player_ids,
      outcome: 'not_played',
    }));

    const { data, error } = await sb
      .from('match_results')
      .upsert(rows, { onConflict: 'match_day_id,position_number' })
      .select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ lineup: data });
  });
}
