/**
 * Tests für lib/services/nuliga-sync.ts.
 *
 * Der Fehler, den diese Tests festhalten: der alte Sync schrieb JEDE Begegnung
 * der Gruppe als eigenen Spieltag, mit hart `is_home: true` und dem Heimteam
 * als "Gegner". Bei einer Vierergruppe entstanden 6 statt 3 Spieltage, und bei
 * Auswärtsspielen stand der eigene Verein in der Gegner-Spalte.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { NuligaGroupPage, NuligaStanding } from '@/lib/services/nuliga-scraper';
import type * as NuligaScraperModule from '@/lib/services/nuliga-scraper';

const fetchGroupPage = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/nuliga-scraper', async (importOriginal) => {
  const actual = await importOriginal<typeof NuligaScraperModule>();
  return { ...actual, fetchNuligaGroupPage: fetchGroupPage };
});

const { resolveOwnTeam, syncLeagueFromNuliga, normalizeTeamName } =
  await import('@/lib/services/nuliga-sync');

// ── Testdoubles ────────────────────────────────────────────────────────────

function standing(rank: number, teamName: string): NuligaStanding {
  return {
    rank,
    teamName,
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    matchPoints: '0:0',
    sets: '0:0',
    games: '0:0',
  };
}

/** Minimaler Supabase-Stub: merkt sich Inserts/Updates, liefert leere Tabellen. */
function fakeSupabase(clubName = 'TC Rheinland') {
  const inserted: Record<string, Record<string, unknown>[]> = {};
  const updated: Record<string, Record<string, unknown>[]> = {};

  const builder = (table: string) => {
    const q: Record<string, unknown> = {};
    const chain = () => q;
    Object.assign(q, {
      select: chain,
      eq: chain,
      in: chain,
      order: chain,
      not: chain,
      delete: chain,
      single: () => Promise.resolve({ data: { name: clubName } }),
      maybeSingle: () => Promise.resolve({ data: { name: clubName } }),
      insert: (row: Record<string, unknown>) => {
        (inserted[table] ??= []).push(row);
        return Promise.resolve({ data: null, error: null });
      },
      update: (row: Record<string, unknown>) => {
        (updated[table] ??= []).push(row);
        return q;
      },
      // Awaitable: eine Query ohne .single() liefert eine leere Trefferliste.
      then: (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: [] }),
    });
    return q;
  };

  return { sb: { from: builder }, inserted, updated };
}

const league = { id: 'lg1', club_id: 'club1', name: 'Herren 40' };

function groupPage(overrides: Partial<NuligaGroupPage> = {}): NuligaGroupPage {
  return {
    championship: 'Medenrunde 2026',
    groupName: 'Bezirksliga Gr. 001',
    standings: [standing(1, 'TC Rheinland II'), standing(2, 'TC Bonn'), standing(3, 'TV Köln')],
    matches: [],
    fetchedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  fetchGroupPage.mockReset();
});

// ── resolveOwnTeam ─────────────────────────────────────────────────────────

describe('resolveOwnTeam', () => {
  const standings = [standing(1, 'TC Rheinland II'), standing(2, 'TC Bonn')];

  it('kanonisiert die Schreibweise aus der Tabelle', () => {
    expect(resolveOwnTeam(standings, '  tc rheinland  II ')).toBe('TC Rheinland II');
  });

  it('fällt auf den Vereinsnamen zurück, wenn er eindeutig passt', () => {
    expect(resolveOwnTeam(standings, null, 'TC Rheinland')).toBe('TC Rheinland II');
  });

  it('rät nicht, wenn mehrere Mannschaften des Vereins in der Gruppe stehen', () => {
    const zwei = [...standings, standing(3, 'TC Rheinland III')];
    expect(resolveOwnTeam(zwei, null, 'TC Rheinland')).toBeNull();
  });

  it('gibt null zurück, wenn nichts bekannt ist', () => {
    expect(resolveOwnTeam(standings, null, null)).toBeNull();
  });
});

describe('normalizeTeamName', () => {
  it('ignoriert Groß-/Kleinschreibung und Mehrfach-Leerzeichen', () => {
    expect(normalizeTeamName('  TC   Rheinland  II ')).toBe('tc rheinland ii');
  });
});

// ── Spielplan-Filter ───────────────────────────────────────────────────────

describe('syncLeagueFromNuliga — Spielplan', () => {
  const matches = [
    // eigenes Heimspiel
    {
      date: 'Sa. 27.06.2026 10:00',
      homeTeam: 'TC Rheinland II',
      awayTeam: 'TC Bonn',
      matchPoints: '6:3',
      sets: null,
      games: null,
      status: 'completed' as const,
      reportUrl: 'https://htv.liga.nu/report?id=1',
    },
    // fremde Begegnung — darf NICHT importiert werden
    {
      date: 'Sa. 27.06.2026 10:00',
      homeTeam: 'TC Bonn',
      awayTeam: 'TV Köln',
      matchPoints: '5:4',
      sets: null,
      games: null,
      status: 'completed' as const,
      reportUrl: null,
    },
    // eigenes Auswärtsspiel, verloren
    {
      date: 'Sa. 04.07.2026 10:00',
      homeTeam: 'TV Köln',
      awayTeam: 'TC Rheinland II',
      matchPoints: '7:2',
      sets: null,
      games: null,
      status: 'completed' as const,
      reportUrl: null,
    },
  ];

  it('importiert nur Begegnungen mit eigener Beteiligung', async () => {
    fetchGroupPage.mockResolvedValue(groupPage({ matches }));
    const { sb, inserted } = fakeSupabase();

    const result = await syncLeagueFromNuliga(
      sb,
      { ...league, own_team_name: 'TC Rheinland II' },
      'https://htv.liga.nu/x'
    );

    expect(result.matchesCreated).toBe(2);
    expect(result.skippedForeign).toBe(1);
    expect(inserted.match_days).toHaveLength(2);
    expect(inserted.match_days.map((m) => m.opponent)).toEqual(['TC Bonn', 'TV Köln']);
  });

  it('setzt is_home und den Gegner aus eigener Sicht', async () => {
    fetchGroupPage.mockResolvedValue(groupPage({ matches }));
    const { sb, inserted } = fakeSupabase();

    await syncLeagueFromNuliga(
      sb,
      { ...league, own_team_name: 'TC Rheinland II' },
      'https://htv.liga.nu/x'
    );

    const [heim, auswaerts] = inserted.match_days;
    expect(heim.is_home).toBe(true);
    expect(auswaerts.is_home).toBe(false);
    expect(auswaerts.opponent).toBe('TV Köln');
  });

  it('dreht den Spielstand beim Auswärtsspiel auf die eigene Sicht', async () => {
    fetchGroupPage.mockResolvedValue(groupPage({ matches }));
    const { sb, inserted } = fakeSupabase();

    await syncLeagueFromNuliga(
      sb,
      { ...league, own_team_name: 'TC Rheinland II' },
      'https://htv.liga.nu/x'
    );

    const [heim, auswaerts] = inserted.match_days;
    expect([heim.score_home, heim.score_away, heim.result]).toEqual([6, 3, 'win']);
    // nuLiga meldet 7:2 für den Gastgeber TV Köln ⇒ aus unserer Sicht 2:7.
    expect([auswaerts.score_home, auswaerts.score_away, auswaerts.result]).toEqual([2, 7, 'loss']);
  });

  it('speichert den Spielbericht-Link', async () => {
    fetchGroupPage.mockResolvedValue(groupPage({ matches }));
    const { sb, inserted } = fakeSupabase();

    await syncLeagueFromNuliga(
      sb,
      { ...league, own_team_name: 'TC Rheinland II' },
      'https://htv.liga.nu/x'
    );

    expect(inserted.match_days[0].nuliga_report_url).toBe('https://htv.liga.nu/report?id=1');
  });

  it('übernimmt die Uhrzeit als Berliner Wandzeit (Sommer: 10:00 = 08:00 UTC)', async () => {
    fetchGroupPage.mockResolvedValue(groupPage({ matches }));
    const { sb, inserted } = fakeSupabase();

    await syncLeagueFromNuliga(
      sb,
      { ...league, own_team_name: 'TC Rheinland II' },
      'https://htv.liga.nu/x'
    );

    expect(inserted.match_days[0].scheduled_date).toBe('2026-06-27T08:00:00.000Z');
  });

  it('lässt den Spielplan unangetastet, wenn die eigene Mannschaft unbekannt ist', async () => {
    fetchGroupPage.mockResolvedValue(
      groupPage({
        matches,
        standings: [standing(1, 'TC Rheinland II'), standing(2, 'TC Rheinland III')],
      })
    );
    const { sb, inserted } = fakeSupabase('TC Rheinland');

    const result = await syncLeagueFromNuliga(sb, league, 'https://htv.liga.nu/x');

    expect(result.ownTeam).toBeNull();
    expect(result.matchesCreated).toBe(0);
    expect(inserted.match_days).toBeUndefined();
    // Die Tabelle enthält legitim alle Mannschaften — die wird trotzdem übernommen.
    expect(result.teamsCreated).toBe(2);
  });
});
