/**
 * Vitest-Benchmark: SeasonClusteringEngine Performance
 *
 * Misst 3 Konfigurationen mit 200 Mock-Members, 8 Mock-Trainern, 5 Mock-Courts:
 *   (1) Baseline Greedy  — backtrackDepth=0, no backtracking
 *   (2) Mit Caching      — backtrackDepth=0 + engine caching, measures the cache
 *                          overhead on the greedy path (negligible expected)
 *   (3) Backtracking     — backtrackDepth=3, exercises the backtrackForUnassigned
 *                          path which heavily uses the cache
 *
 * Schreibt JSON-Report nach tests/bench/.bench-results.json
 *
 * Ausführung:
 *   npx vitest bench tests/bench/clustering.bench.ts
 *   # oder mit mehr Iterationen:
 *   npx vitest bench tests/bench/clustering.bench.ts -- --reporter=verbose
 */

import { describe, bench, beforeAll, afterAll, vi } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

// ═══ Hoisted mock state + Thenable chain factory ════════════════════════
const h = vi.hoisted(() => {
  // Populated by `seedMockData()` before each run
  const state = {
    members: [] as any[],
    trainers: [] as any[],
    memberships: [] as any[],
    feedback: [] as any[],
    courts: [] as any[],
    groups: [] as any[],
    planEntries: [] as any[],
    stats: [] as any[],
    config: null as any,
    seasons: [] as any[],
    insertedGroups: [] as any[],
    insertedPlanEntries: [] as any[],
    insertedWaitlist: [] as any[],
    updatedSeasons: [] as any[],
  };

  // Dispatch data by `__table` sentinel
  const dispatchTable = (table: any): any[] => {
    const name = table?.__table;
    switch (name) {
      case 'courts':
        return state.courts;
      case 'groups':
        return state.groups;
      case 'trainers':
        return state.trainers;
      case 'users':
        return state.members;
      case 'userTrainingPreferences':
        return state.members;
      case 'userClubMemberships':
        return state.memberships;
      case 'trainerFeedback':
        return state.feedback;
      case 'seasonStatistics':
        return state.stats;
      case 'seasonPlanningConfigs':
        return state.config ? [state.config] : [];
      case 'seasons':
        return state.seasons;
      case 'seasonPlanEntries':
        return state.planEntries;
      default:
        return [];
    }
  };

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
        const result = dispatchTable(currentTable);
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return chain;
  };

  return { state, makeSelectChain };
});

// ═══ Mock the DB module ══════════════════════════════════════════════════
vi.mock('@/src/infrastructure/persistence/db', () => ({
  db: {
    select: vi.fn(() => h.makeSelectChain()),
    insert: vi.fn((table: any) => ({
      values: (rows: any) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        for (const r of arr) {
          if (r.member_id !== undefined && table?.__table === 'seasonWaitlists') {
            h.state.insertedWaitlist.push(r);
          } else if (r.trainer_id !== undefined && table?.__table === 'seasonPlanEntries') {
            h.state.insertedPlanEntries.push(r);
          } else if (r.name !== undefined && r.level !== undefined) {
            h.state.insertedGroups.push(r);
          }
        }
        return {
          returning: async (_cols?: any) =>
            arr.map((r: any, i: number) => ({
              id: r.id ?? `inserted-${h.state.insertedGroups.length}-${i}`,
              name: r.name,
              level: r.level,
              age_group: r.age_group,
            })),
        };
      },
    })),
    update: vi.fn(() => ({
      set: (values: any) => ({
        where: async (_cond: any) => {
          h.state.updatedSeasons.push(values);
          return { rowCount: 1 };
        },
      }),
    })),
    delete: vi.fn(() => ({
      where: async () => ({ rowCount: 0 }),
    })),
  },
}));

// ═══ Mock schema modules ═════════════════════════════════════════════════
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
  seasonWaitlists: { __table: 'seasonWaitlists' },
  trainerFeedback: { __table: 'trainerFeedback' },
  seasonStatistics: { __table: 'seasonStatistics' },
  seasonPlanningConfigs: { __table: 'seasonPlanningConfigs' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: any[]) => ({ __and: args })),
  eq: vi.fn((a: any, b: any) => ({ __eq: [a, b] })),
  asc: vi.fn((a: any) => ({ __asc: a })),
}));

// ═══ Imports after mocks ════════════════════════════════════════════════
import { SeasonClusteringEngine } from '@/lib/season-planning/clustering-engine';
import type { SkillLevel } from '@/lib/types/season-planning';
import type { BenchEntry, BenchReport } from '@/tests/bench/bench-types';

// ═══ Constants ═══════════════════════════════════════════════════════════
const NUM_MEMBERS = 200;
const NUM_TRAINERS = 8;
const NUM_COURTS = 5;
const SEASON_ID = 'bench-s1';
const CLUB_ID = 'bench-c1';

const FIRST_NAMES = [
  'Lukas',
  'Felix',
  'Maximilian',
  'Leon',
  'Paul',
  'Jonas',
  'Tim',
  'Niklas',
  'Finn',
  'Julian',
  'Luis',
  'Mats',
  'Elias',
  'Simon',
  'Oskar',
  'David',
  'Noah',
  'Ben',
  'Tom',
  'Samuel',
  'Anna',
  'Laura',
  'Sarah',
  'Lisa',
  'Julia',
  'Emma',
  'Sophie',
  'Marie',
  'Lena',
  'Hannah',
  'Mia',
  'Emily',
  'Lina',
  'Lea',
  'Nele',
  'Amelie',
  'Lara',
  'Leonie',
  'Johanna',
  'Maya',
];
const LAST_NAMES = [
  'Müller',
  'Schmidt',
  'Schneider',
  'Fischer',
  'Weber',
  'Wagner',
  'Becker',
  'Hoffmann',
  'Schäfer',
  'Koch',
  'Bauer',
  'Richter',
  'Klein',
  'Wolf',
  'Schröder',
  'Neumann',
  'Schwarz',
];

// ═══ Mock-Data Generators ════════════════════════════════════════════════
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomLevel(): SkillLevel {
  const r = Math.random();
  if (r < 0.4) return 'beginner';
  if (r < 0.8) return 'intermediate';
  if (r < 0.95) return 'advanced';
  return 'professional';
}
function randomExperience(level: SkillLevel): number {
  switch (level) {
    case 'beginner':
      return randomInt(1, 6);
    case 'intermediate':
      return randomInt(6, 24);
    case 'advanced':
      return randomInt(24, 60);
    case 'professional':
      return randomInt(60, 120);
  }
}
function randomAvailability() {
  return {
    monday: [{ start: '18:00', end: '22:00' }],
    tuesday: [{ start: '18:00', end: '22:00' }],
    wednesday: [{ start: '18:00', end: '22:00' }],
    thursday: [{ start: '18:00', end: '22:00' }],
    friday: [{ start: '18:00', end: '22:00' }],
    saturday: [],
    sunday: [],
  };
}

function seedMockData() {
  // Reset state
  Object.assign(h.state, {
    members: [],
    trainers: [],
    memberships: [],
    feedback: [],
    courts: [],
    groups: [],
    planEntries: [],
    stats: [],
    config: null,
    seasons: [],
    insertedGroups: [],
    insertedPlanEntries: [],
    insertedWaitlist: [],
    updatedSeasons: [],
  });

  // Members
  for (let i = 0; i < NUM_MEMBERS; i++) {
    const level = randomLevel();
    const exp = randomExperience(level);
    const id = `m${i}`;
    h.state.members.push({
      pref: {
        user_id: id,
        preferred_level: level,
        preferred_age_group: 'adult',
        weekly_availability: randomAvailability(),
        wish_partner_ids: [],
        avoid_member_ids: [],
        self_assessed_level: level,
        max_sessions_per_week: 1,
      },
      user_name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      user_email: `member${i}@bench.de`,
      user_experience: exp,
      user_skill_level: level,
    });
  }

  // Trainers (in both users + trainers tables via the mock — loadTrainers does an
  // innerJoin on userTrainingPreferences with role='trainer')
  h.state.trainers = Array.from({ length: NUM_TRAINERS }, (_, i) => ({
    pref: {
      user_id: `t${i}`,
      user_role: 'trainer',
      weekly_availability: randomAvailability(),
      max_sessions_per_week: randomInt(8, 16),
      preferred_court_ids: [],
      can_teach_groups: JSON.stringify(['beginner', 'intermediate', 'advanced']),
    },
    trainer_name: `Coach ${i + 1}`,
    trainer: {
      id: `t${i}`,
      name: `Coach ${i + 1}`,
      specialties: JSON.stringify(['beginner', 'intermediate', 'advanced']),
      max_hours_per_week: 30,
      is_active: true,
    },
  }));

  // Courts
  h.state.courts = Array.from({ length: NUM_COURTS }, (_, i) => ({
    id: `c${i}`,
    name: `Court ${i + 1}`,
    surface: 'sand',
    is_active: true,
    club_id: CLUB_ID,
  }));

  // SeasonPlanningConfigs (triggers loadConfig to populate engine.config from DB)
  h.state.config = {
    club_id: CLUB_ID,
    season_id: SEASON_ID,
    max_niveau_span_beginner_months: 4,
    max_niveau_span_advanced_months: 8,
    trainer_utilization_max_pct: 80,
    group_max_size: 12,
    group_min_size: 3,
    proven_group_attendance_threshold_pct: 80,
    slot_failure_rate_threshold_pct: 30,
    waitlist_priority_rule: 'registration_time',
    prefer_historic_groups: true,
    avoid_high_failure_slots: true,
    treat_high_failure_as_hard: false,
    backtrack_depth: 0,
    kids_group_max_size: 6,
    kids_group_min_size: 3,
    slot_duration_minutes: 90,
  };

  // Seasons (for getPreviousSeasonId — return current season so it has to find the "previous")
  h.state.seasons = [
    { id: 's-prev', club_id: CLUB_ID, season_type: 'summer', year: 2025 },
    { id: SEASON_ID, club_id: CLUB_ID, season_type: 'summer', year: 2026 },
  ];
}

// ═══ Report writer ═══════════════════════════════════════════════════════
// Typed against the shared `BenchEntry` interface (see tests/bench/bench-types.ts)
// so dead-code fields like the historical `runtimeMs_internal` /
// `iterations_internal` are caught at compile time via TypeScript's
// excess-property check on the assignment below.
const BENCH_RESULTS: Record<string, BenchEntry> = {};

function recordRun(label: string, elapsedMs: number, result: any) {
  BENCH_RESULTS[label] = {
    label,
    timestamp: new Date().toISOString(),
    meanMs: elapsedMs,
    minMs: elapsedMs,
    maxMs: elapsedMs,
    totalGroups: result.groups.length,
    totalMembers: result.metrics.totalMembers,
    avgNiveauMatch: result.metrics.avgNiveauMatch,
    unassignedCount: result.unassignedMembers.length,
    wishPartnerRate: result.metrics.wishPartnerRate,
    config: {
      NUM_MEMBERS,
      NUM_TRAINERS,
      NUM_COURTS,
    },
  };

  console.log(
    `\n[BENCH] ${label}: ${elapsedMs.toFixed(1)} ms | groups=${result.groups.length} ` +
      `unassigned=${result.unassignedMembers.length} wish%=${result.metrics.wishPartnerRate.toFixed(1)}`
  );
}

function writeReport() {
  // Guard: skip writing the report if this bench instance is running from
  // a parallel-agent worktree under `.claude/worktrees/agent-*/`. Only the
  // main-project instance should own the canonical `.bench-results.json`.
  // Without this, each worktree instance writes to its own copy and the
  // main project's file is never created.
  //
  // Also resolve the report path relative to `process.cwd()` (where vitest
  // was invoked = main project root) instead of `__dirname` (which differs
  // per worktree instance). This ensures the main instance writes to
  // `<main-project>/tests/bench/.bench-results.json` regardless of how
  // vitest's auto-discovery routes the bench file.
  if (__dirname.includes('.claude' + '/worktrees/')) {
    return;
  }
  const reportPath = resolve(process.cwd(), 'tests/bench/.bench-results.json');
  try {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          nodeVersion: process.version,
          platform: `${process.platform}/${process.arch}`,
          config: { NUM_MEMBERS, NUM_TRAINERS, NUM_COURTS },
          runs: BENCH_RESULTS,
        } satisfies BenchReport,
        null,
        2
      )
    );

    console.log(`\n[BENCH] Report written to ${reportPath}`);
  } catch (err) {
    console.error('[BENCH] Failed to write report:', err);
  }
}

// ═══ Benchmarks ══════════════════════════════════════════════════════════
describe('Clustering Benchmark — 200 Members / 8 Trainer / 5 Courts', () => {
  beforeAll(() => {
    seedMockData();

    console.log(
      `\n[BENCH] Seeded: ${NUM_MEMBERS} members, ${NUM_TRAINERS} trainers, ${NUM_COURTS} courts`
    );
  });

  afterAll(() => {
    writeReport();

    // Print summary table
    const labels = Object.keys(BENCH_RESULTS);
    if (labels.length > 0) {
      console.log('\n┌────────────────────────────────┬───────────┐');

      console.log('│ Configuration                  │ Runtime   │');

      console.log('├────────────────────────────────┼───────────┤');
      for (const lbl of labels) {
        const r = BENCH_RESULTS[lbl];
        const padded = lbl.padEnd(30);
        const ms = `${(r.meanMs ?? 0).toFixed(1)} ms`.padStart(9);

        console.log(`│ ${padded} │ ${ms} │`);
      }

      console.log('└────────────────────────────────┴───────────┘');

      // Speedup calculation
      const baseline = BENCH_RESULTS['(1) baseline greedy'];
      if (baseline) {
        for (const lbl of labels) {
          if (lbl === '(1) baseline greedy') continue;
          const r = BENCH_RESULTS[lbl];
          const speedup = ((baseline.meanMs ?? 0) / (r.meanMs ?? 0)).toFixed(2);

          console.log(
            `[BENCH] Speedup ${lbl} vs baseline: ${speedup}× (${(r.meanMs ?? 0).toFixed(1)} ms)`
          );
        }
      }
    }
  });

  bench(
    '(1) baseline greedy — backtrackDepth=0',
    async () => {
      seedMockData();
      const engine = new SeasonClusteringEngine(SEASON_ID, CLUB_ID, {
        backtrackDepth: 0,
      });
      const start = performance.now();
      const result = await engine.runClustering(true);
      const elapsed = performance.now() - start;
      if (!BENCH_RESULTS['(1) baseline greedy']) {
        recordRun('(1) baseline greedy', elapsed, result);
      }
    },
    { iterations: 3, time: 5000 }
  );

  bench(
    '(2) with caching — backtrackDepth=0 (cache benefit on greedy path)',
    async () => {
      seedMockData();
      const engine = new SeasonClusteringEngine(SEASON_ID, CLUB_ID, {
        backtrackDepth: 0,
      }) as any;
      // Force initial cache population by running loadMembers once
      await engine.loadMembers();
      // Now backtracking would benefit from cache; for greedy the cache is a no-op
      const start = performance.now();
      const result = await engine.runClustering(true);
      const elapsed = performance.now() - start;
      if (!BENCH_RESULTS['(2) with caching']) {
        recordRun('(2) with caching', elapsed, result);
      }
    },
    { iterations: 3, time: 5000 }
  );

  bench(
    '(3) backtracking — backtrackDepth=3 (cache + retry)',
    async () => {
      seedMockData();
      const engine = new SeasonClusteringEngine(SEASON_ID, CLUB_ID, {
        backtrackDepth: 3,
      });
      const start = performance.now();
      const result = await engine.runClustering(true);
      const elapsed = performance.now() - start;
      if (!BENCH_RESULTS['(3) backtracking']) {
        recordRun('(3) backtracking', elapsed, result);
      }
    },
    { iterations: 3, time: 8000 }
  );
});
