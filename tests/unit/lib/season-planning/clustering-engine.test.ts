/**
 * Regression-guard for the Sprint-4 MergedPrefRow widening + cast documentation
 * (commit 50efd0b, file: lib/season-planning/clustering-engine.ts).
 *
 * The Sprint-4 fix widened `MergedPrefRow['pref']` to make three fields
 * (`unavailable_dates`, `avoid_member_ids`, `self_assessed_level`)
 * explicitly optional, and documented why `as unknown as MergedPrefRow[]`
 * is the canonical TS escape hatch here (different JSON-cast shapes between
 * `userTrainingPreferences` and `memberSchedulePreferences` rows).
 *
 * This test verifies BOTH data paths survive the cast:
 *   (1) `seasonPrefs` (from `user_training_preferences`) — fields populated
 *   (2) `eligibleBaseline` (from `member_schedule_preferences` after active-
 *       membership + no-seasonPrefs-already-exists filters) — fields null
 *
 * If the Sprint-4 widening is reverted (regression), the baseline rows
 * will be missing the 3 optional fields and downstream consumers will
 * hit runtime "cannot read property X of undefined" errors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ───────────────────────────────────────────────────────────────────────
// Per-table DB mock. SUPERSEDES the previous queue-of-N approach which
// was brittle to call-count drift. New tables added by future Sprints
// return the default empty response, so the test stays focused on the
// 4 known tables in loadMembers.
// ───────────────────────────────────────────────────────────────────────
type DbResponse = { data: unknown[]; error: null };
const DEFAULT_RESP: DbResponse = { data: [], error: null };

const tableResponses = new Map<string, DbResponse>();
function setResp(table: string, resp: DbResponse) {
  tableResponses.set(table, resp);
}
function clearResps() {
  tableResponses.clear();
}

function makeChainable(table: string) {
  const resolve = () => tableResponses.get(table) ?? DEFAULT_RESP;
  return new Proxy(
    {},
    {
      get(_target, prop: string | symbol) {
        if (prop === 'then') {
          return (onResolve: (val: DbResponse) => void) => onResolve(resolve());
        }
        // Return a callable that re-enters the chainable for any
        // intermediate method like .select(...).eq(...).in(...) etc.
        return (..._args: unknown[]) => makeChainable(table);
      },
    }
  );
}

const fromMock = vi.fn((table: string) => makeChainable(table));

vi.mock('@/src/infrastructure/persistence/db', () => ({
  db: { from: fromMock },
}));

// ───────────────────────────────────────────────────────────────────────
// Tests
// ───────────────────────────────────────────────────────────────────────
interface MergedRow {
  user_id: string;
  pref: {
    unavailable_dates: unknown;
    avoid_member_ids: unknown;
    self_assessed_level: unknown;
  };
}

describe('SeasonClusteringEngine.loadMembers — Sprint-4 cast-widening regression guard', () => {
  beforeEach(() => {
    clearResps();
    fromMock.mockClear();
  });

  it('returns MERGED rows from BOTH seasonPrefs AND eligibleBaseline paths', async () => {
    // 1) primary source: user_training_preferences (seasonPrefs path)
    setResp('user_training_preferences', {
      data: [
        {
          user_id: 'utp-alpha',
          pref: {
            preferred_times: 'Tue 18:00',
            unavailable_dates: ['2026-07-01'],
            avoid_member_ids: ['user-x'],
            self_assessed_level: 7,
          },
          user: { id: 'utp-alpha', name: 'Alpha', email: '', role: 'member' },
        },
      ],
      error: null,
    });
    // 2) baseline pref path: member_schedule_preferences
    setResp('member_schedule_preferences', {
      data: [
        {
          user_id: 'baseline-bravo',
          preferred_days: ['Mon'],
          member_schedule: [{ day: 'Mon', time: '18:00' }],
        },
      ],
      error: null,
    });
    // 3) active-baseline filter: user_club_memberships
    setResp('user_club_memberships', {
      data: [
        {
          user_id: 'baseline-bravo',
          club_id: 'club-1',
          role: 'member',
          status: 'active',
        },
      ],
      error: null,
    });
    // 4) trainerFeedback (previous-season data) — empty OK
    setResp('trainer_feedback', DEFAULT_RESP);

    const { SeasonClusteringEngine } = await import('@/lib/season-planning/clustering-engine');
    // Constructor takes positional (seasonId, clubId, config?). Default
    // config is acceptable for the regression test.
    const engine = new SeasonClusteringEngine('s-1', 'c-1');

    // loadMembers is private; access via canonical `as unknown as` cast
    const merged = (await (
      engine as unknown as { loadMembers: () => Promise<MergedRow[]> }
    ).loadMembers()) as MergedRow[];

    // Both input rows survive the spread + cast (regression guard for Sprint-4)
    expect(merged).toHaveLength(2);

    const baselineRow = merged.find((r) => r.user_id === 'baseline-bravo');
    expect(baselineRow).toBeDefined();

    // Sprint-4 widening: utp-only fields are explicit-null on baseline rows
    expect(baselineRow!.pref.unavailable_dates).toBeNull();
    expect(baselineRow!.pref.avoid_member_ids).toBeNull();
    expect(baselineRow!.pref.self_assessed_level).toBeNull();

    // SeasonPrefs row retains its real values (not collapsed to null by the spread)
    const seasonRow = merged.find((r) => r.user_id === 'utp-alpha');
    expect(seasonRow!.pref.self_assessed_level).toBe(7);
    expect(seasonRow!.pref.unavailable_dates).toEqual(['2026-07-01']);
  });

  it('excludes baseline row when its user already has a seasonPref (no duplication)', async () => {
    setResp('user_training_preferences', {
      data: [
        {
          user_id: 'dup',
          pref: {
            preferred_times: 'Tue',
            unavailable_dates: null,
            avoid_member_ids: null,
            self_assessed_level: 5,
          },
          user: { id: 'dup', name: 'Dup' },
        },
      ],
      error: null,
    });
    setResp('member_schedule_preferences', {
      data: [{ user_id: 'dup', preferred_days: ['Mon'], member_schedule: [] }],
      error: null,
    });
    setResp('user_club_memberships', {
      data: [{ user_id: 'dup', club_id: 'c', role: 'member', status: 'active' }],
      error: null,
    });
    setResp('trainer_feedback', DEFAULT_RESP);

    const { SeasonClusteringEngine } = await import('@/lib/season-planning/clustering-engine');
    const engine = new SeasonClusteringEngine('s', 'c');

    const merged = (await (
      engine as unknown as { loadMembers: () => Promise<MergedRow[]> }
    ).loadMembers()) as MergedRow[];

    // Only the seasonPrefs row survives; baseline is filtered out
    expect(merged).toHaveLength(1);
    expect(merged[0].user_id).toBe('dup');
    expect(merged[0].pref.self_assessed_level).toBe(5); // utp value preserved
  });

  it('returns [] without throwing when both sources are empty (cast is safe)', async () => {
    // No setResp() calls → all tables return DEFAULT_RESP empty
    const { SeasonClusteringEngine } = await import('@/lib/season-planning/clustering-engine');
    const engine = new SeasonClusteringEngine('s', 'c');

    const merged = (await (
      engine as unknown as { loadMembers: () => Promise<MergedRow[]> }
    ).loadMembers()) as MergedRow[];
    expect(merged).toEqual([]);
  });
});
