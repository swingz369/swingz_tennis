/**
 * app/api/member/leagues/route.ts
 *
 * GET — "Meine Mannschaften": in welchen Liga-Kadern stehe ich, und wann ist
 * mein nächstes Spiel?
 *
 * Die Verknüpfung entsteht beim Kader-Import: `league_players.member_id` wird
 * über die DTB-ID (ersatzweise den Namen) gesetzt. Ohne diesen Endpunkt bliebe
 * die Liga-Verwaltung ein reines Admin-Werkzeug — der Spieler selbst sähe von
 * seinen Medenspielen in SwingZ nichts.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { loadMemberCandidates, suggestByName } from '@/lib/services/nuliga-sync';

const log = createLogger('api:member:leagues');

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) return forbiddenResponse();
    if (!auth.clubId) return NextResponse.json({ teams: [] });

    const sb = auth.supabase;

    const { data: entries, error } = await sb
      .from('league_players')
      .select('league_id, position_number, lk')
      .eq('member_id', auth.user.id)
      .eq('club_id', auth.clubId);

    if (error) {
      log.error('Kader-Zuordnung nicht abrufbar', { error: error.message });
      return NextResponse.json({ error: 'Mannschaften nicht abrufbar' }, { status: 500 });
    }
    const suggestions = await findSuggestions(auth.clubId, auth.user.id);
    if (!entries || entries.length === 0) return NextResponse.json({ teams: [], suggestions });

    const leagueIds = entries.map((e: { league_id: string }) => e.league_id);

    const [leaguesRes, matchesRes, standingsRes, rosterRes] = await Promise.all([
      sb
        .from('leagues')
        .select('id, name, season_year, division, age_group, own_team_name')
        .in('id', leagueIds),
      // Alle Spieltage der Liga: die Aufteilung in "kommt noch" und "war" macht
      // der Code unten. Eine Medenrunde hat gut ein Dutzend Spieltage — dafür
      // lohnt keine zweite Abfrage.
      sb
        .from('match_days')
        .select(
          'id, league_id, scheduled_date, opponent, is_home, venue, status, result, score_home, score_away, nuliga_report_url'
        )
        .in('league_id', leagueIds)
        .order('scheduled_date', { ascending: true }),
      // Tabelle: nur Mannschaftsnamen und Zahlen — keine Personen.
      sb
        .from('teams')
        .select(
          'id, league_id, name, position, points, matches_played, matches_won, matches_drawn, matches_lost'
        )
        .in('league_id', leagueIds)
        .order('position', { ascending: true }),
      // Kader der EIGENEN Mannschaft, sichtbar nur für Mitglieder desselben Vereins
      // (RLS + club_id-Filter). Fremde Vereine sind nie enthalten.
      sb
        .from('league_players')
        .select('league_id, name, lk, position_number, member_id')
        .in('league_id', leagueIds)
        .eq('club_id', auth.clubId)
        .order('position_number', { ascending: true, nullsFirst: false }),
    ]);

    const leagueById = new Map<string, Record<string, unknown>>(
      (leaguesRes.data ?? []).map((l: { id: string }) => [l.id, l])
    );

    const teams = entries
      .map((e: { league_id: string; position_number: number | null; lk: string | null }) => {
        const league = leagueById.get(e.league_id);
        if (!league) return null;
        const matches = (matchesRes.data ?? []).filter(
          (m: { league_id: string }) => m.league_id === e.league_id
        );

        const now = Date.now();
        const isFuture = (m: { scheduled_date: string | null }) =>
          m.scheduled_date ? new Date(m.scheduled_date).getTime() >= now : true;

        const upcoming = matches.filter(isFuture);
        // Außerhalb der Saison ist das letzte Ergebnis das, was den Spieler
        // interessiert — sonst stünde ein halbes Jahr lang nur "nichts geplant".
        const played = matches.filter((m: { scheduled_date: string | null }) => !isFuture(m));

        return {
          league_id: e.league_id,
          league_name: league.name,
          season_year: league.season_year,
          division: league.division,
          age_group: league.age_group,
          own_team_name: league.own_team_name,
          position_number: e.position_number,
          lk: e.lk,
          next_match: upcoming[0] ?? null,
          upcoming_count: upcoming.length,
          last_match: played[played.length - 1] ?? null,
          // Vollständige Liste für /member/leagues. Die Dashboard-Karte nutzt
          // nur next_match/last_match und ignoriert das hier.
          matches,
          standings: (standingsRes.data ?? []).filter(
            (t: { league_id: string }) => t.league_id === e.league_id
          ),
          roster: (rosterRes.data ?? [])
            .filter((r: { league_id: string }) => r.league_id === e.league_id)
            .map(
              (r: {
                name: string;
                lk: string | null;
                position_number: number | null;
                member_id: string | null;
              }) => ({
                name: r.name,
                lk: r.lk,
                position_number: r.position_number,
                is_me: r.member_id === auth.user.id,
              })
            ),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ teams, suggestions });
  });
}

/**
 * "Bist du das?" — Kadereinträge, die noch niemandem zugeordnet sind, aber
 * eindeutig auf den Namen dieses Mitglieds passen. Nur über den eigenen Namen
 * gefunden, nie eine Liste fremder Personen. Service-Client, weil die
 * Eindeutigkeit gegen ALLE Vereinsmitglieder geprüft werden muss (RLS zeigt
 * einem Mitglied nur sein eigenes Profil) — zurück geht nur der eigene Treffer.
 */
async function findSuggestions(clubId: string, userId: string) {
  const sb = createServiceClient();
  const [members, { data: open }] = await Promise.all([
    loadMemberCandidates(sb, clubId),
    sb
      .from('league_players')
      .select('id, league_id, name, lk, birth_year')
      .eq('club_id', clubId)
      .is('member_id', null),
  ]);
  const mine = (open ?? []).filter(
    (p) => suggestByName({ name: p.name, birthYear: p.birth_year }, members) === userId
  );
  if (mine.length === 0) return [];

  const { data: leagues } = await sb
    .from('leagues')
    .select('id, name, season_year')
    .in('id', [...new Set(mine.map((p) => p.league_id))]);
  const leagueName = new Map((leagues ?? []).map((l) => [l.id, `${l.name} ${l.season_year}`]));
  return mine.map((p) => ({
    player_id: p.id,
    name: p.name,
    lk: p.lk,
    league_name: leagueName.get(p.league_id) ?? '',
  }));
}
