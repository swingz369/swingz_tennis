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
 * This test verifies BOTH data paths survive the cast, observed through
 * `loadMembers()`'s public return shape (id/selfAssessedLevel/avoidMemberIds):
 *   (1) `seasonPrefs` (from `user_training_preferences`) — fields populated
 *   (2) `eligibleBaseline` (from `member_schedule_preferences` after active-
 *       membership + no-seasonPrefs-already-exists filters) — fields null
 *
 * If the Sprint-4 widening is reverted (regression), the baseline rows
 * will be missing the 3 optional fields and downstream consumers will
 * hit runtime "cannot read property X of undefined" errors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  userTrainingPreferences,
  memberSchedulePreferences,
  userClubMemberships,
  trainerFeedback,
} from '@/src/infrastructure/persistence/schema';

// ───────────────────────────────────────────────────────────────────────
// Per-table DB mock, Drizzle-style: `loadMembers()` calls
// `db.select({...}).from(table).innerJoin(...).where(...)`, which resolves
// (when awaited) directly to a plain row array — not a Supabase-style
// `{ data, error }` envelope. Keyed by the real table object (imported
// above) so `.from(userTrainingPreferences)` picks the right canned rows.
// ───────────────────────────────────────────────────────────────────────
const tableResponses = new Map<unknown, unknown[]>();
function setResp(table: unknown, rows: unknown[]) {
  tableResponses.set(table, rows);
}
function clearResps() {
  tableResponses.clear();
}

function makeChainable(table: unknown) {
  const resolve = () => tableResponses.get(table) ?? [];
  const chain: unknown = new Proxy(
    {},
    {
      get(_target, prop: string | symbol) {
        if (prop === 'then') {
          return (onResolve: (val: unknown[]) => void) => onResolve(resolve());
        }
        // Any intermediate method (.innerJoin(...), .where(...), .orderBy(...))
        // just re-enters the same table-bound chain.
        return (..._args: unknown[]) => chain;
      },
    }
  );
  return chain;
}

const selectMock = vi.fn(() => ({
  from: (table: unknown) => makeChainable(table),
}));

vi.mock('@/src/infrastructure/persistence/db', () => ({
  db: { select: selectMock },
}));

// ───────────────────────────────────────────────────────────────────────
// Tests
// ───────────────────────────────────────────────────────────────────────
interface MemberResultRow {
  id: string;
  selfAssessedLevel: unknown;
  avoidMemberIds: unknown[];
}

describe('SeasonClusteringEngine.loadMembers — Sprint-4 cast-widening regression guard', () => {
  beforeEach(() => {
    clearResps();
    selectMock.mockClear();
  });

  it('returns MERGED rows from BOTH seasonPrefs AND eligibleBaseline paths', async () => {
    // 1) primary source: user_training_preferences (seasonPrefs path)
    setResp(userTrainingPreferences, [
      {
        pref: {
          user_id: 'utp-alpha',
          preferred_times: 'Tue 18:00',
          unavailable_dates: ['2026-07-01'],
          avoid_member_ids: ['user-x'],
          self_assessed_level: 7,
        },
        user_name: 'Alpha',
        user_email: '',
        user_experience: 0,
        user_skill_level: null,
      },
    ]);
    // 2) baseline pref path: member_schedule_preferences
    setResp(memberSchedulePreferences, [
      {
        pref: {
          user_id: 'baseline-bravo',
          preferred_days: ['Mon'],
          weekly_availability: [{ day: 'Mon', time: '18:00' }],
        },
        user_name: 'Bravo',
        user_email: '',
        user_experience: 0,
        user_skill_level: null,
      },
    ]);
    // 3) active-baseline filter: user_club_memberships
    setResp(userClubMemberships, [{ user_id: 'baseline-bravo', role: 'member' }]);
    // 4) trainerFeedback (previous-season data) — empty OK
    setResp(trainerFeedback, []);

    const { SeasonClusteringEngine } = await import('@/lib/season-planning/clustering-engine');
    // Constructor takes positional (seasonId, clubId, config?). Default
    // config is acceptable for the regression test.
    const engine = new SeasonClusteringEngine(
      's0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000001'
    );

    // loadMembers is private; access via canonical `as unknown as` cast
    const merged = (await (
      engine as unknown as { loadMembers: () => Promise<MemberResultRow[]> }
    ).loadMembers()) as MemberResultRow[];

    // Both input rows survive the merge (regression guard for Sprint-4)
    expect(merged).toHaveLength(2);

    const baselineRow = merged.find((r) => r.id === 'baseline-bravo');
    expect(baselineRow).toBeDefined();

    // Sprint-4 widening: utp-only fields default safely on baseline rows
    expect(baselineRow!.selfAssessedLevel).toBeNull();
    expect(baselineRow!.avoidMemberIds).toEqual([]);

    // SeasonPrefs row retains its real values (not collapsed to null by the merge)
    const seasonRow = merged.find((r) => r.id === 'utp-alpha');
    expect(seasonRow!.selfAssessedLevel).toBe(7);
    expect(seasonRow!.avoidMemberIds).toEqual(['user-x']);
  });

  it('excludes baseline row when its user already has a seasonPref (no duplication)', async () => {
    setResp(userTrainingPreferences, [
      {
        pref: {
          user_id: 'dup',
          preferred_times: 'Tue',
          unavailable_dates: null,
          avoid_member_ids: null,
          self_assessed_level: 5,
        },
        user_name: 'Dup',
        user_email: '',
        user_experience: 0,
        user_skill_level: null,
      },
    ]);
    setResp(memberSchedulePreferences, [
      {
        pref: { user_id: 'dup', preferred_days: ['Mon'] },
        user_name: 'Dup',
        user_email: '',
        user_experience: 0,
        user_skill_level: null,
      },
    ]);
    setResp(userClubMemberships, [{ user_id: 'dup', role: 'member' }]);
    setResp(trainerFeedback, []);

    const { SeasonClusteringEngine } = await import('@/lib/season-planning/clustering-engine');
    const engine = new SeasonClusteringEngine(
      's0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000001'
    );

    const merged = (await (
      engine as unknown as { loadMembers: () => Promise<MemberResultRow[]> }
    ).loadMembers()) as MemberResultRow[];

    // Only the seasonPrefs row survives; baseline is filtered out
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('dup');
    expect(merged[0].selfAssessedLevel).toBe(5); // utp value preserved
  });

  it('returns [] without throwing when both sources are empty (cast is safe)', async () => {
    // No setResp() calls → all tables return []
    const { SeasonClusteringEngine } = await import('@/lib/season-planning/clustering-engine');
    const engine = new SeasonClusteringEngine(
      's0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000001'
    );

    const merged = (await (
      engine as unknown as { loadMembers: () => Promise<MemberResultRow[]> }
    ).loadMembers()) as MemberResultRow[];
    expect(merged).toEqual([]);
  });
});
