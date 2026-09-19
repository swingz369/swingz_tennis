import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══ Repository-Stub: loadConfig liest nur planningConfig ═══════════════
const h = vi.hoisted(() => {
  // The DB row we control per test. Use `null` to simulate NULL columns / no row.
  let dbRow: any = null;
  return {
    setDbRow: (row: any) => {
      dbRow = row;
    },
    repo: { planningConfig: async () => dbRow } as any,
  };
});

// ═══ Import engine AFTER all mocks are registered ════════════════════════
import { SeasonClusteringEngine } from '@/lib/season-planning/clustering-engine';

// ═══ Default config snapshot from clustering-engine.ts ═════════════════
// These match `DEFAULT_CONFIG` in clustering-engine.ts. If you change the
// defaults there, update these here.
const DEFAULT_TREAT_HIGH_FAILURE_AS_HARD = false;
const DEFAULT_BACKTRACK_DEPTH = 3;
// Sprint 4 P0 #3 (Adaptive Backtrack): see migration
// supabase/migrations/20260610_add_unassigned_rate_threshold.sql
const DEFAULT_UNASSIGNED_RATE_THRESHOLD = 0.05;

beforeEach(() => {
  h.setDbRow(null);
  vi.clearAllMocks();
});

describe('SeasonClusteringEngine.loadConfig — typed access + NULL defaults', () => {
  it('loads full config from DB and exposes both new fields with correct values', async () => {
    h.setDbRow({
      club_id: 'c1',
      season_id: 's1',
      // The new columns we want to type-access
      treat_high_failure_as_hard: true,
      backtrack_depth: 3,
      unassigned_rate_threshold: 0.12,
      // Plus a couple of other fields to prove typed access works for the whole row
      max_niveau_span_beginner_months: 5,
      group_max_size: 10,
      slot_duration_minutes: 60,
    });

    const engine = new SeasonClusteringEngine('s1', 'c1', undefined, h.repo) as any;
    await engine.loadConfig();

    // Typed access on the new fields
    expect(engine.config.treatHighFailureAsHard).toBe(true);
    expect(engine.config.backtrackDepth).toBe(3);
    expect(engine.config.unassignedRateThreshold).toBe(0.12);

    // Typed access on other fields proves the row was read end-to-end
    expect(engine.config.maxNiveauSpanBeginner).toBe(5);
    expect(engine.config.groupMaxSize).toBe(10);
    expect(engine.config.slotDurationMinutes).toBe(60);
  });

  it('uses default `false` when treat_high_failure_as_hard is NULL in DB', async () => {
    h.setDbRow({
      club_id: 'c1',
      season_id: 's1',
      // Both new columns explicitly NULL
      treat_high_failure_as_hard: null,
      backtrack_depth: 2, // mixed: one set, one NULL
    });

    const engine = new SeasonClusteringEngine('s1', 'c1', undefined, h.repo) as any;
    await engine.loadConfig();

    expect(engine.config.treatHighFailureAsHard).toBe(DEFAULT_TREAT_HIGH_FAILURE_AS_HARD);
    expect(engine.config.treatHighFailureAsHard).toBe(false);
    // The other field is still read correctly
    expect(engine.config.backtrackDepth).toBe(2);
  });

  it('uses default `3` when backtrack_depth is NULL in DB', async () => {
    h.setDbRow({
      club_id: 'c1',
      season_id: 's1',
      // Both new columns explicitly NULL
      treat_high_failure_as_hard: true, // mixed
      backtrack_depth: null,
    });

    const engine = new SeasonClusteringEngine('s1', 'c1', undefined, h.repo) as any;
    await engine.loadConfig();

    expect(engine.config.backtrackDepth).toBe(DEFAULT_BACKTRACK_DEPTH);
    expect(engine.config.backtrackDepth).toBe(3);
    // The other field is still read correctly
    expect(engine.config.treatHighFailureAsHard).toBe(true);
  });

  it('uses defaults for BOTH fields when both are NULL in DB', async () => {
    h.setDbRow({
      club_id: 'c1',
      season_id: 's1',
      treat_high_failure_as_hard: null,
      backtrack_depth: null,
    });

    const engine = new SeasonClusteringEngine('s1', 'c1', undefined, h.repo) as any;
    await engine.loadConfig();

    expect(engine.config.treatHighFailureAsHard).toBe(false);
    expect(engine.config.backtrackDepth).toBe(3);
  });

  it('keeps constructor config when DB returns no row at all', async () => {
    h.setDbRow(null); // Kein Konfig-Datensatz → nichts wird überschrieben

    const engine = new SeasonClusteringEngine(
      's1',
      'c1',
      {
        treatHighFailureAsHard: true,
        backtrackDepth: 3,
      },
      h.repo
    ) as any;

    await engine.loadConfig();

    // Constructor-supplied config wins because the DB has no row
    expect(engine.config.treatHighFailureAsHard).toBe(true);
    expect(engine.config.backtrackDepth).toBe(3);
  });

  it('DB row always overrides constructor config (even for the new fields)', async () => {
    // Constructor sets the new fields to non-defaults, but the DB row should win
    h.setDbRow({
      club_id: 'c1',
      season_id: 's1',
      treat_high_failure_as_hard: false,
      backtrack_depth: 0,
    });

    const engine = new SeasonClusteringEngine(
      's1',
      'c1',
      {
        treatHighFailureAsHard: true,
        backtrackDepth: 3,
      },
      h.repo
    ) as any;

    await engine.loadConfig();

    // DB values take precedence over constructor overrides
    expect(engine.config.treatHighFailureAsHard).toBe(false);
    expect(engine.config.backtrackDepth).toBe(0);
  });

  it('treats undefined (missing key) same as NULL and uses defaults', async () => {
    // Simulate a row from an older schema version where the columns don't exist
    h.setDbRow({
      club_id: 'c1',
      season_id: 's1',
      max_niveau_span_beginner_months: 4,
      group_max_size: 12,
      // No treat_high_failure_as_hard, no backtrack_depth
    });

    const engine = new SeasonClusteringEngine('s1', 'c1', undefined, h.repo) as any;
    await engine.loadConfig();

    // The ?? operator treats undefined as a missing value → default
    expect(engine.config.treatHighFailureAsHard).toBe(false);
    expect(engine.config.backtrackDepth).toBe(3);
  });

  it('Sprint 4 P0 #3: reads unassigned_rate_threshold from DB and overrides default 0.05', async () => {
    h.setDbRow({
      club_id: 'c1',
      season_id: 's1',
      // Override the default 0.05 with a more aggressive threshold
      unassigned_rate_threshold: 0.1,
    });

    const engine = new SeasonClusteringEngine('s1', 'c1', undefined, h.repo) as any;
    await engine.loadConfig();

    // The DB value is read end-to-end and overrides DEFAULT_CONFIG
    expect(engine.config.unassignedRateThreshold).toBe(0.1);
    expect(engine.config.unassignedRateThreshold).not.toBe(DEFAULT_UNASSIGNED_RATE_THRESHOLD);
  });

  it('Sprint 4 P0 #3: uses default 0.05 when unassigned_rate_threshold is NULL in DB', async () => {
    h.setDbRow({
      club_id: 'c1',
      season_id: 's1',
      unassigned_rate_threshold: null,
    });

    const engine = new SeasonClusteringEngine('s1', 'c1', undefined, h.repo) as any;
    await engine.loadConfig();

    // ?? operator falls back to DEFAULT_CONFIG.unassignedRateThreshold
    expect(engine.config.unassignedRateThreshold).toBe(DEFAULT_UNASSIGNED_RATE_THRESHOLD);
    expect(engine.config.unassignedRateThreshold).toBe(0.05);
  });
});
