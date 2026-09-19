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
import { describe, it, expect, beforeEach } from 'vitest';

// ───────────────────────────────────────────────────────────────────────
// Repository-Stub (ADR-005): `loadMembers()` liest über SeasonClusteringRepository.
// Die Stub-Methoden liefern die Zeilenform des echten Repositorys (Präferenz +
// Nutzerfelder, bereits zusammengesetzt).
// ───────────────────────────────────────────────────────────────────────
type Resp = { season: unknown[]; baseline: unknown[]; memberships: unknown[] };
let resp: Resp;
function setResp(patch: Partial<Resp>) {
  resp = { ...resp, ...patch };
}
function clearResps() {
  resp = { season: [], baseline: [], memberships: [] };
}
const repoStub = {
  submittedMemberPrefs: async () => resp.season,
  baselineMemberPrefs: async () => resp.baseline,
  activeMemberships: async () => resp.memberships,
  findSeason: async () => null,
  trainerFeedback: async () => [],
  userProfiles: async () => [],
} as never;

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
  });

  it('returns MERGED rows from BOTH seasonPrefs AND eligibleBaseline paths', async () => {
    // 1) primary source: user_training_preferences (seasonPrefs path)
    setResp({
      season: [
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
      ],
    });
    // 2) baseline pref path: member_schedule_preferences
    setResp({
      baseline: [
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
      ],
    });
    // 3) active-baseline filter: user_club_memberships
    setResp({ memberships: [{ user_id: 'baseline-bravo', role: 'member' }] });

    const { SeasonClusteringEngine } = await import('@/lib/season-planning/clustering-engine');
    // Constructor takes positional (seasonId, clubId, config?). Default
    // config is acceptable for the regression test.
    const engine = new SeasonClusteringEngine(
      's0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000001',
      undefined,
      repoStub
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
    setResp({
      season: [
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
      ],
    });
    setResp({
      baseline: [
        {
          pref: { user_id: 'dup', preferred_days: ['Mon'] },
          user_name: 'Dup',
          user_email: '',
          user_experience: 0,
          user_skill_level: null,
        },
      ],
    });
    setResp({ memberships: [{ user_id: 'dup', role: 'member' }] });

    const { SeasonClusteringEngine } = await import('@/lib/season-planning/clustering-engine');
    const engine = new SeasonClusteringEngine(
      's0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000001',
      undefined,
      repoStub
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
      'c0000000-0000-0000-0000-000000000001',
      undefined,
      repoStub
    );

    const merged = (await (
      engine as unknown as { loadMembers: () => Promise<MemberResultRow[]> }
    ).loadMembers()) as MemberResultRow[];
    expect(merged).toEqual([]);
  });
});
