/**
 * lib/services/nuliga-sync.ts — nuLiga-Daten in SwingZ übernehmen.
 *
 * Zwei Seitentypen, eine hinterlegte URL:
 *
 * - **Mannschaftsportrait** (`/wa/teamPortrait`) — die Seite, die ein Sportwart
 *   tatsächlich im Browser offen hat. Sie liefert den eigenen Mannschaftsnamen,
 *   NUR die eigenen Spieltermine und die Meldeliste mit LK und DTB-ID, und sie
 *   verlinkt auf die Gruppenseite. Aus dieser einen URL kommt alles.
 * - **Gruppenseite** (`/wa/groupPage`) — Tabelle plus Spielplan ALLER Paarungen.
 *   Hier muss aus `own_team_name` (oder dem Vereinsnamen) gefiltert werden,
 *   welche Begegnungen unsere sind.
 *
 * Vorher stand diese Logik zweimal fast identisch in Route und Cron, beide Male
 * mit demselben Fehler: jede Begegnung der Gruppe wurde als eigener Spieltag
 * geschrieben, mit hart `is_home: true` und dem Heimteam als "Gegner".
 */

import { createLogger } from '@/lib/logger';
import { berlinWallClock } from '@/lib/berlin-time';
import {
  fetchNuligaGroupPage,
  fetchNuligaTeamPortrait,
  isNuligaTeamPortraitUrl,
  parseNuligaDateTime,
  parseScore,
  type NuligaMatch,
  type NuligaRosterPlayer,
  type NuligaStanding,
} from '@/lib/services/nuliga-scraper';

const log = createLogger('nuliga-sync');

/** Supabase-Client (User- oder Service-Kontext). Beide Aufrufer geben je einen anderen. */

type Sb = any;

export interface SyncableLeague {
  id: string;
  club_id: string;
  name: string;
  own_team_name?: string | null;
}

export interface NuligaSyncResult {
  /** 'portrait' = Mannschaftsportrait, 'group' = Gruppenseite. */
  source: 'portrait' | 'group';
  groupName: string;
  championship: string;
  standings: number;
  matches: number;
  teamsCreated: number;
  teamsUpdated: number;
  matchesCreated: number;
  matchesUpdated: number;
  /** Begegnungen der Gruppe ohne eigene Beteiligung — bewusst nicht importiert. */
  skippedForeign: number;
  /** Übernommene Meldeliste (nur beim Mannschaftsportrait). */
  playersImported: number;
  playersLinked: number;
  /** Aufgelöster Name der eigenen Mannschaft, null = nicht bestimmbar. */
  ownTeam: string | null;
  fetchedAt: string;
}

function emptyResult(overrides: Partial<NuligaSyncResult>): NuligaSyncResult {
  return {
    source: 'group',
    groupName: '',
    championship: '',
    standings: 0,
    matches: 0,
    teamsCreated: 0,
    teamsUpdated: 0,
    matchesCreated: 0,
    matchesUpdated: 0,
    skippedForeign: 0,
    playersImported: 0,
    playersLinked: 0,
    ownTeam: null,
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Vergleichsform für Mannschaftsnamen: Kleinschreibung, Mehrfach-Leerzeichen weg. */
export function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Welche Mannschaft der Gruppe ist unsere? (nur für den Gruppenseiten-Pfad —
 * das Mannschaftsportrait sagt es selbst)
 *
 * 1. `own_team_name` gesetzt → diese, kanonisiert auf die Schreibweise der Tabelle.
 * 2. Sonst: genau ein Tabelleneintrag, der mit dem Vereinsnamen beginnt.
 * 3. Sonst null — dann wird der Spielplan NICHT importiert, statt ihn zu raten.
 */
export function resolveOwnTeam(
  standings: NuligaStanding[],
  ownTeamName?: string | null,
  clubName?: string | null
): string | null {
  if (ownTeamName?.trim()) {
    const wanted = normalizeTeamName(ownTeamName);
    const hit = standings.find((s) => normalizeTeamName(s.teamName) === wanted);
    return hit?.teamName ?? ownTeamName.trim();
  }

  if (clubName?.trim()) {
    const prefix = normalizeTeamName(clubName);
    const candidates = standings.filter((s) => normalizeTeamName(s.teamName).startsWith(prefix));
    if (candidates.length === 1) return candidates[0].teamName;
  }

  return null;
}

/**
 * Einstiegspunkt: erkennt den Seitentyp und übernimmt die Daten.
 * Wirft, wenn der Abruf fehlschlägt (der Aufrufer protokolliert).
 */
export async function syncLeagueFromNuliga(
  sb: Sb,
  league: SyncableLeague,
  nuligaUrl: string
): Promise<NuligaSyncResult> {
  return isNuligaTeamPortraitUrl(nuligaUrl)
    ? syncFromTeamPortrait(sb, league, nuligaUrl)
    : syncFromGroupPage(sb, league, nuligaUrl);
}

// ── Pfad 1: Mannschaftsportrait ────────────────────────────────────────────

async function syncFromTeamPortrait(
  sb: Sb,
  league: SyncableLeague,
  url: string
): Promise<NuligaSyncResult> {
  const portrait = await fetchNuligaTeamPortrait(url);
  const ownTeam = portrait.teamName;

  if (!ownTeam) {
    log.warn('Mannschaftsportrait ohne Mannschaftsnamen', { leagueId: league.id, url });
    return emptyResult({ source: 'portrait', fetchedAt: portrait.fetchedAt });
  }

  const matchStats = await upsertMatches(sb, league, ownTeam, portrait.matches);
  const rosterStats = await upsertRoster(sb, league, portrait.players, url);

  // Die Tabelle steht nur auf der Gruppenseite — die verlinkt das Portrait.
  let teamsCreated = 0;
  let teamsUpdated = 0;
  let standingsCount = 0;
  let groupName = portrait.leagueName ?? '';
  let championship = '';

  if (portrait.groupPageUrl) {
    try {
      const group = await fetchNuligaGroupPage(portrait.groupPageUrl);
      const teamStats = await upsertStandings(sb, league, group.standings);
      teamsCreated = teamStats.created;
      teamsUpdated = teamStats.updated;
      standingsCount = group.standings.length;
      groupName = group.groupName || groupName;
      championship = group.championship;
    } catch (err) {
      // Die Tabelle ist Beiwerk — Spieltermine und Kader sind schon übernommen.
      log.warn('Gruppentabelle konnte nicht geladen werden, Rest ist übernommen', {
        leagueId: league.id,
        error: err instanceof Error ? err.message : 'unbekannt',
      });
    }
  }

  return {
    source: 'portrait',
    groupName,
    championship,
    standings: standingsCount,
    matches: portrait.matches.length,
    teamsCreated,
    teamsUpdated,
    matchesCreated: matchStats.created,
    matchesUpdated: matchStats.updated,
    skippedForeign: matchStats.skipped,
    playersImported: rosterStats.imported,
    playersLinked: rosterStats.linked,
    ownTeam,
    fetchedAt: portrait.fetchedAt,
  };
}

// ── Pfad 2: Gruppenseite ───────────────────────────────────────────────────

async function syncFromGroupPage(
  sb: Sb,
  league: SyncableLeague,
  url: string
): Promise<NuligaSyncResult> {
  const data = await fetchNuligaGroupPage(url);

  // Die Tabelle enthält legitim ALLE Mannschaften der Gruppe, auch fremde.
  const teamStats = await upsertStandings(sb, league, data.standings);

  let clubName: string | null = null;
  if (!league.own_team_name) {
    const { data: club } = await sb.from('clubs').select('name').eq('id', league.club_id).single();
    clubName = club?.name ?? null;
  }
  const ownTeam = resolveOwnTeam(data.standings, league.own_team_name, clubName);

  if (!ownTeam) {
    log.warn('Eigene Mannschaft nicht bestimmbar — Spielplan übersprungen', {
      leagueId: league.id,
      leagueName: league.name,
    });
    return emptyResult({
      source: 'group',
      groupName: data.groupName,
      championship: data.championship,
      standings: data.standings.length,
      matches: data.matches.length,
      teamsCreated: teamStats.created,
      teamsUpdated: teamStats.updated,
      skippedForeign: data.matches.length,
      fetchedAt: data.fetchedAt,
    });
  }

  const matchStats = await upsertMatches(sb, league, ownTeam, data.matches);

  return {
    source: 'group',
    groupName: data.groupName,
    championship: data.championship,
    standings: data.standings.length,
    matches: data.matches.length,
    teamsCreated: teamStats.created,
    teamsUpdated: teamStats.updated,
    matchesCreated: matchStats.created,
    matchesUpdated: matchStats.updated,
    skippedForeign: matchStats.skipped,
    playersImported: 0,
    playersLinked: 0,
    ownTeam,
    fetchedAt: data.fetchedAt,
  };
}

// ── Bausteine ──────────────────────────────────────────────────────────────

async function upsertStandings(
  sb: Sb,
  league: SyncableLeague,
  standings: NuligaStanding[]
): Promise<{ created: number; updated: number }> {
  const { data: existingTeams } = await sb
    .from('teams')
    .select('id, name, position, points, matches_played, matches_won, matches_lost, matches_drawn')
    .eq('league_id', league.id);

  const teamByName = new Map<string, Record<string, unknown> & { id: string }>(
    (existingTeams ?? []).map((t: { name: string }) => [normalizeTeamName(t.name), t]) as [
      string,
      Record<string, unknown> & { id: string },
    ][]
  );

  let created = 0;
  let updated = 0;

  for (const standing of standings) {
    const existing = teamByName.get(normalizeTeamName(standing.teamName));
    const row = {
      position: standing.rank,
      points: standing.points,
      matches_played: standing.matchesPlayed,
      matches_won: standing.wins,
      matches_lost: standing.losses,
      matches_drawn: standing.draws,
    };

    if (existing) {
      if (Object.entries(row).some(([k, v]) => existing[k] !== v)) {
        await sb.from('teams').update(row).eq('id', existing.id);
        updated++;
      }
    } else {
      await sb
        .from('teams')
        .insert({ club_id: league.club_id, league_id: league.id, name: standing.teamName, ...row });
      created++;
    }
  }

  return { created, updated };
}

async function upsertMatches(
  sb: Sb,
  league: SyncableLeague,
  ownTeam: string,
  matches: NuligaMatch[]
): Promise<{ created: number; updated: number; skipped: number }> {
  const own = normalizeTeamName(ownTeam);

  const { data: existingMatchDays } = await sb
    .from('match_days')
    .select(
      'id, matchday_number, opponent, is_home, scheduled_date, status, score_home, score_away, nuliga_report_url'
    )
    .eq('league_id', league.id);

  // Altlast aus dem fehlerhaften Sync: Zeilen, in denen die eigene Mannschaft
  // als Gegner steht, sind fachlich unmöglich.
  const bogus = (existingMatchDays ?? []).filter(
    (md: { opponent: string }) => normalizeTeamName(md.opponent) === own
  );
  if (bogus.length > 0) {
    await sb
      .from('match_days')
      .delete()
      .in(
        'id',
        bogus.map((md: { id: string }) => md.id)
      );
    log.info('Fehlerhafte Spieltage entfernt (Gegner = eigene Mannschaft)', {
      leagueId: league.id,
      count: bogus.length,
    });
  }

  // Schlüssel = Gegner + Heim/Auswärts. In einer Medenrunde spielt man jeden
  // Gegner genau einmal daheim und einmal auswärts; das Datum taugt nicht als
  // Schlüssel, weil eine Terminverlegung sonst eine Dublette erzeugt.
  const matchKey = (opponent: string, isHome: boolean) =>
    `${normalizeTeamName(opponent)}|${isHome ? 'h' : 'a'}`;

  const existingByKey = new Map<string, Record<string, unknown> & { id: string }>();
  for (const md of existingMatchDays ?? []) {
    if (bogus.some((b: { id: string }) => b.id === md.id)) continue;
    existingByKey.set(matchKey(md.opponent, md.is_home), md);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let matchdayNumber = 0;

  for (const match of matches) {
    const isOwnHome = normalizeTeamName(match.homeTeam) === own;
    const isOwnAway = normalizeTeamName(match.awayTeam) === own;

    if (!isOwnHome && !isOwnAway) {
      skipped++;
      continue;
    }

    matchdayNumber++;

    const opponent = isOwnHome ? match.awayTeam : match.homeTeam;
    const scores = parseScore(match.matchPoints);
    // nuLiga zählt immer Heim:Gast. Gespeichert wird aus EIGENER Sicht, weil
    // `result` und die UI ("✓ Sieg") diese Sicht voraussetzen — das
    // Ergebnisformular beschriftet score_home entsprechend mit "Eigene".
    const ownScore = scores ? (isOwnHome ? scores.home : scores.away) : null;
    const oppScore = scores ? (isOwnHome ? scores.away : scores.home) : null;

    let result: string | null = null;
    if (match.status === 'completed' && ownScore !== null && oppScore !== null) {
      result = ownScore > oppScore ? 'win' : ownScore < oppScore ? 'loss' : 'draw';
    }

    const row = {
      scheduled_date: toBerlinInstant(match.date),
      opponent,
      is_home: isOwnHome,
      result,
      score_home: ownScore,
      score_away: oppScore,
      status: match.status === 'completed' ? 'completed' : 'scheduled',
      nuliga_report_url: match.reportUrl,
    };

    const existing = existingByKey.get(matchKey(opponent, isOwnHome));

    if (existing) {
      const changed = Object.entries(row).some(([k, v]) => {
        if (k === 'scheduled_date') {
          const before = existing.scheduled_date
            ? new Date(existing.scheduled_date as string).getTime()
            : null;
          const after = v ? new Date(v as string).getTime() : null;
          return before !== after;
        }
        return existing[k] !== v;
      });
      if (changed) {
        await sb
          .from('match_days')
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        updated++;
      }
    } else {
      await sb
        .from('match_days')
        .insert({ league_id: league.id, matchday_number: matchdayNumber, ...row });
      created++;
    }
  }

  return { created, updated, skipped };
}

/**
 * Meldeliste übernehmen. Die Liste vom Verband ist die Wahrheit — wer nicht
 * mehr gemeldet ist, verschwindet auch bei uns.
 *
 * Zuordnung zum Vereinsmitglied: zuerst über die DTB-ID (stabil, eindeutig),
 * ersatzweise über den Klarnamen.
 */
export async function upsertRoster(
  sb: Sb,
  league: SyncableLeague,
  players: NuligaRosterPlayer[],
  sourceUrl: string
): Promise<{ imported: number; linked: number }> {
  if (players.length === 0) return { imported: 0, linked: 0 };

  const { data: memberships } = await sb
    .from('user_club_memberships')
    .select('user_id')
    .eq('club_id', league.club_id)
    .eq('is_active', true);

  const memberIds = (memberships ?? []).map((m: { user_id: string }) => m.user_id);
  const byDtbId = new Map<string, string>();
  const byName = new Map<string, string>();

  if (memberIds.length > 0) {
    const { data: users } = await sb
      .from('users')
      .select('id, full_name, dtb_id')
      .in('id', memberIds);
    for (const u of users ?? []) {
      if (u.dtb_id) byDtbId.set(String(u.dtb_id).trim(), u.id);
      if (u.full_name) byName.set(normalizeTeamName(u.full_name), u.id);
    }
  }

  const rows = players.map((p) => ({
    league_id: league.id,
    club_id: league.club_id,
    member_id:
      (p.dtbId ? byDtbId.get(p.dtbId.trim()) : undefined) ??
      byName.get(normalizeTeamName(p.name)) ??
      null,
    name: p.name,
    lk: p.lk,
    position_number: p.position,
    source_url: sourceUrl,
    synced_at: new Date().toISOString(),
  }));

  await sb.from('league_players').delete().eq('league_id', league.id).eq('club_id', league.club_id);
  const { error } = await sb.from('league_players').insert(rows);
  if (error) throw new Error(`Kader konnte nicht gespeichert werden: ${error.message}`);

  return { imported: rows.length, linked: rows.filter((r) => r.member_id).length };
}

/**
 * nuLiga-Datum ("Sa. 27.06.2026 10:00") in einen Zeitpunkt übersetzen.
 * Ohne Umrechnung landete die Wandzeit auf Vercel als UTC in der Spalte und
 * wäre im Sommer zwei Stunden zu spät angezeigt worden.
 */
function toBerlinInstant(nuligaDate: string): string | null {
  const withTime = parseNuligaDateTime(nuligaDate);
  if (!withTime) return null;

  const [datePart, timePart] = withTime.split('T');
  const base = new Date(`${datePart}T00:00:00Z`);
  const [h, m] = timePart ? timePart.split(':').map(Number) : [0, 0];
  return berlinWallClock(base, h, m).toISOString();
}
