import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══ Hoisted mock state + Thenable chain factory ════════════════════════
const h = vi.hoisted(() => {
  // The DB row we control per test. Use `null` to simulate NULL columns.
  let dbRow: any = null;

  // Thenable chain that dispatches by the `__table` sentinel set in the schema mock.
  const makeSelectChain = () => {
    let currentTable: any = null;
    const chain: any = {
      from: (t: any) => {
        currentTable = t;
        return chain;
      },
      innerJoin: (t: any) => {
        currentTable = t;
        return chain;
      },
      leftJoin: (t: any) => {
        currentTable = t;
        return chain;
      },
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      groupBy: () => chain,
      then: (resolve: any, reject: any) => {
        const name = currentTable?.__table;
        if (name === 'seasonPlanningConfigs') {
          // loadConfig does `const [dbConfig] = await ...` so we always return an
          // array of length 0 or 1. When `dbRow` is null, return an empty array
          // (the [destructure] yields undefined, the if-check skips assignment).
          return Promise.resolve(dbRow ? [dbRow] : []).then(resolve, reject);
        }
        return Promise.resolve([]).then(resolve, reject);
      },
    };
    return chain;
  };

  return {
    getDbRow: () => dbRow,
    setDbRow: (row: any) => {
      dbRow = row;
    },
    makeSelectChain,
  };
});

// ═══ Mock the DB module ══════════════════════════════════════════════════
vi.mock('@/src/infrastructure/persistence/db', () => ({
  db: {
    select: vi.fn(() => h.makeSelectChain()),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// ═══ Mock the schema modules with __table sentinels ══════════════════════
vi.mock('@/src/infrastructure/persistence/schema', () => ({
  seasons: { __table: 'seasons' },
  users: { __table: 'users' },
  trainers: { __table: 'trainers' },
  userTrainingPreferences: { __table: 'userTrainingPreferences' },
  groups: { __table: 'groups' },
  courts: { __table: 'courts' },
  seasonPlanEntries: { __table: 'seasonPlanEntries' },
  userClubMemberships: { __table: 'userClubMemberships' },
  trainerClubs: { __table: 'trainerClubs' },
}));

vi.mock('@/src/infrastructure/persistence/season-planning-schema', () => ({
  // Minimal shape — loadConfig only reads these two columns
  seasonPlanningConfigs: { __table: 'seasonPlanningConfigs' },
  seasonWaitlists: { __table: 'seasonWaitlists' },
  trainerFeedback: { __table: 'trainerFeedback' },
  seasonStatistics: { __table: 'seasonStatistics' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ __and: args })),
  eq: vi.fn((a: any, b: any) => ({ __eq: [a, b] })),
  asc: vi.fn((a: any) => ({ __asc: a })),
}));

// ═══ Import engine AFTER all mocks are registered ════════════════════════
import { SeasonClusteringEngine } from '@/lib/season-planning/clustering-engine';

// ═══ Default config snapshot from clustering-engine.ts ═════════════════
// These match `DEFAULT_CONFIG` in clustering-engine.ts. If you change the
// defaults there, update these here.
const DEFAULT_TREAT_HIGH_FAILURE_AS_HARD = false;
const DEFAULT_BACKTRACK_DEPTH = 0;

beforeEach(() => {
  h.setDbRow(null);
  vi.clearAllMocks();
});

describe('SeasonClusteringEngine.loadConfig — typed access + NULL defaults', () => {
  it('loads full config from DB and exposes both new fields with correct values', async () => {
    h.setDbRow({
      club_id: 'c1',
      season_id: 's1',
      // The two new columns we want to type-access
      treat_high_failure_as_hard: true,
      backtrack_depth: 3,
      // Plus a couple of other fields to prove typed access works for the whole row
      max_niveau_span_beginner_months: 5,
      group_max_size: 10,
      slot_duration_minutes: 60,
    });

    const engine = new SeasonClusteringEngine('s1', 'c1') as any;
    await engine.loadConfig();

    // Typed access on the new fields
    expect(engine.config.treatHighFailureAsHard).toBe(true);
    expect(engine.config.backtrackDepth).toBe(3);

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

    const engine = new SeasonClusteringEngine('s1', 'c1') as any;
    await engine.loadConfig();

    expect(engine.config.treatHighFailureAsHard).toBe(DEFAULT_TREAT_HIGH_FAILURE_AS_HARD);
    expect(engine.config.treatHighFailureAsHard).toBe(false);
    // The other field is still read correctly
    expect(engine.config.backtrackDepth).toBe(2);
  });

  it('uses default `0` when backtrack_depth is NULL in DB', async () => {
    h.setDbRow({
      club_id: 'c1',
      season_id: 's1',
      // Both new columns explicitly NULL
      treat_high_failure_as_hard: true, // mixed
      backtrack_depth: null,
    });

    const engine = new SeasonClusteringEngine('s1', 'c1') as any;
    await engine.loadConfig();

    expect(engine.config.backtrackDepth).toBe(DEFAULT_BACKTRACK_DEPTH);
    expect(engine.config.backtrackDepth).toBe(0);
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

    const engine = new SeasonClusteringEngine('s1', 'c1') as any;
    await engine.loadConfig();

    expect(engine.config.treatHighFailureAsHard).toBe(false);
    expect(engine.config.backtrackDepth).toBe(0);
  });

  it('keeps constructor config when DB returns no row at all', async () => {
    h.setDbRow(null); // Empty array from select → [destructure] → undefined → no assignment

    const engine = new SeasonClusteringEngine('s1', 'c1', {
      treatHighFailureAsHard: true,
      backtrackDepth: 3,
    }) as any;

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

    const engine = new SeasonClusteringEngine('s1', 'c1', {
      treatHighFailureAsHard: true,
      backtrackDepth: 3,
    }) as any;

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

    const engine = new SeasonClusteringEngine('s1', 'c1') as any;
    await engine.loadConfig();

    // The ?? operator treats undefined as a missing value → default
    expect(engine.config.treatHighFailureAsHard).toBe(false);
    expect(engine.config.backtrackDepth).toBe(0);
  });
});
