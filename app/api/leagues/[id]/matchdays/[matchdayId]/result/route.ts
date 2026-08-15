import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { ZodError } from 'zod';
import type { Json } from '@/types/supabase';
import { withApiAuth, verifyRole, verifyOffice, forbiddenResponse } from '@/lib/api-auth';
import { ResultUpdateSchema } from '@/lib/types/matchdays';

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

    // `as const` on the array keeps each Promise<...> tuple position separate so
    // TypeScript does not widen the resulting Promise.all type to a homogeneous
    // array of the resulting unions (a.k.a. LUB issue).
    const [resultsRes, matchDayRes] = await Promise.all([
      sb
        .from('match_results')
        .select('*')
        .eq('match_day_id', matchdayId)
        .eq('club_id', clubId)
        .order('position_number'),
      sb
        .from('match_days')
        .select('score_home, score_away, result, status')
        .eq('id', matchdayId)
        .maybeSingle(),
    ] as const);
    const { data: results, error } = resultsRes;
    const { data: matchDay } = matchDayRes;
    if (error) return internalErrorResponse();
    return NextResponse.json({ results: results ?? [], matchDay });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return withApiAuth(request, async (auth) => {
    const canEdit =
      (await verifyRole(auth, 'admin')) || (await verifyOffice(auth, 'mannschaftsfuehrer'));
    if (!canEdit) return forbiddenResponse('Admin oder Mannschaftsführer erforderlich');
    if (!auth.clubId) return forbiddenResponse('Vereinskontext erforderlich');
    const clubId = auth.clubId;

    const { id: leagueId, matchdayId } = await params;

    let body;
    try {
      body = ResultUpdateSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: 'Ungültige Ergebnis-Daten', issues: err.issues },
          { status: 400 }
        );
      }
      throw err;
    }
    const { position_number, home_sets_won, away_sets_won, set_scores, outcome, notes } = body;

    const sb = auth.supabase;
    const { data: league } = await sb
      .from('leagues')
      .select('id')
      .eq('id', leagueId)
      .eq('club_id', clubId)
      .maybeSingle();
    if (!league) return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });

    // set_scores is z.unknown() in the Zod schema because the structure is
    // free-form (per-set scores). Supabase stores it as JSONB → `Json`. This
    // is the single justified boundary cast between an untyped Zod value and
    // the strongly-typed Supabase column type.
    const { error: updateErr } = await sb
      .from('match_results')
      .update({
        home_sets_won,
        away_sets_won,
        set_scores: (set_scores ?? null) as Json | null,
        outcome,
        notes: notes ?? null,
        recorded_by: auth.user.id,
        recorded_at: new Date().toISOString(),
      })
      .eq('match_day_id', matchdayId)
      .eq('club_id', clubId)
      .eq('position_number', position_number);

    if (updateErr) return internalErrorResponse();

    // Spieltag-Gesamtergebnis aus allen Positionen berechnen
    const { data: allResults } = await sb
      .from('match_results')
      .select('outcome')
      .eq('match_day_id', matchdayId)
      .eq('club_id', clubId);

    const all = allResults ?? [];
    const homeWins = all.filter((r) => r.outcome === 'home_won').length;
    const awayWins = all.filter((r) => r.outcome === 'away_won').length;
    const allPlayed = all.every((r) => r.outcome !== 'not_played') && all.length > 0;

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
