import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { ZodError } from 'zod';
import { withApiAuth, verifyRole, verifyOffice, forbiddenResponse } from '@/lib/api-auth';
import { LineupPositionsSchema } from '@/lib/types/matchdays';

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
    if (!auth.clubId) return forbiddenResponse('Vereinskontext erforderlich');
    const clubId = auth.clubId;

    const { id: leagueId, matchdayId } = await params;
    const sb = auth.supabase;

    const { data: league } = await sb
      .from('leagues')
      .select('id')
      .eq('id', leagueId)
      .eq('club_id', clubId)
      .maybeSingle();
    if (!league) return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });

    const { data, error } = await sb
      .from('match_results')
      .select('id, position_number, position_type, home_player_ids, away_player_ids, outcome')
      .eq('match_day_id', matchdayId)
      .eq('club_id', clubId)
      .order('position_number');

    if (error) return internalErrorResponse();
    return NextResponse.json({ lineup: data ?? [] });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return withApiAuth(request, async (auth) => {
    const canEdit =
      (await verifyRole(auth, 'admin')) || (await verifyOffice(auth, 'mannschaftsfuehrer'));
    if (!canEdit) return forbiddenResponse('Admin oder Mannschaftsführer erforderlich');
    if (!auth.clubId) return forbiddenResponse('Vereinskontext erforderlich');
    const clubId = auth.clubId;

    const { id: leagueId, matchdayId } = await params;
    const sb = auth.supabase;

    const { data: league } = await sb
      .from('leagues')
      .select('id')
      .eq('id', leagueId)
      .eq('club_id', clubId)
      .maybeSingle();
    if (!league) return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });

    let positions;
    try {
      positions = LineupPositionsSchema.parse(await request.json()).positions;
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: 'Ungültige Aufstellungsdaten', issues: err.issues },
          { status: 400 }
        );
      }
      throw err;
    }

    const rows = positions.map((p) => ({
      match_day_id: matchdayId,
      club_id: clubId,
      position_number: p.position_number,
      position_type: p.position_type,
      home_player_ids: p.home_player_ids,
      away_player_ids: p.away_player_ids,
      outcome: 'not_played' as const,
    }));

    const { data, error } = await sb
      .from('match_results')
      .upsert(rows, { onConflict: 'match_day_id,position_number' })
      .select();
    if (error) return internalErrorResponse();
    return NextResponse.json({ lineup: data });
  });
}
