import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, verifyOffice, forbiddenResponse } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string; matchdayId: string }> };

/**
 * GET  — Alle Einzel-/Doppel-Ergebnisse eines Spieltags
 * PATCH — Ergebnis für eine Position eintragen
 * Body PATCH: { position_number, home_sets_won, away_sets_won, set_scores?, outcome, notes? }
 * Auto-aktualisiert match_days.score_home/away/result nach jedem PATCH.
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

    const [{ data: results, error }, { data: matchDay }] = await Promise.all([
      sb
        .from('match_results')
        .select('*')
        .eq('match_day_id', matchdayId)
        .eq('club_id', auth.clubId)
        .order('position_number'),
      sb
        .from('match_days')
        .select('score_home, score_away, result, status')
        .eq('id', matchdayId)
        .maybeSingle(),
    ]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ results: results ?? [], matchDay });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
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

    const { position_number, home_sets_won, away_sets_won, set_scores, outcome, notes } =
      await request.json();
    if (!position_number || !outcome)
      return NextResponse.json(
        { error: 'position_number und outcome erforderlich' },
        { status: 400 }
      );

    const { error: updateErr } = await sb
      .from('match_results')
      .update({
        home_sets_won: home_sets_won ?? 0,
        away_sets_won: away_sets_won ?? 0,
        set_scores: set_scores ?? null,
        outcome,
        notes: notes ?? null,
        recorded_by: auth.user.id,
        recorded_at: new Date().toISOString(),
      })
      .eq('match_day_id', matchdayId)
      .eq('club_id', auth.clubId)
      .eq('position_number', position_number);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Spieltag-Gesamtergebnis aus allen Positionen berechnen
    const { data: allResults } = await sb
      .from('match_results')
      .select('outcome')
      .eq('match_day_id', matchdayId)
      .eq('club_id', auth.clubId);

    const all = allResults ?? [];
    const homeWins = all.filter((r: { outcome: string }) => r.outcome === 'home_won').length;
    const awayWins = all.filter((r: { outcome: string }) => r.outcome === 'away_won').length;
    const allPlayed =
      all.every((r: { outcome: string }) => r.outcome !== 'not_played') && all.length > 0;

    await sb
      .from('match_days')
      .update({
        score_home: homeWins,
        score_away: awayWins,
        result: allPlayed
          ? homeWins > awayWins
            ? 'win'
            : homeWins < awayWins
              ? 'loss'
              : 'draw'
          : null,
        status: allPlayed ? 'completed' : 'in_progress',
      })
      .eq('id', matchdayId);

    return NextResponse.json({ success: true, scoreHome: homeWins, scoreAway: awayWins });
  });
}
