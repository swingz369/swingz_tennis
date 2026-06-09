/**
 * Vitest-Scaling-Benchmark: SeasonClusteringEngine Performance
 *
 * Misst 3 Konfigurationen (Baseline / Caching / Backtracking) mit 4 Datensatz-
 * Grössen: 200 / 500 / 1000 / 2000 Members. Schreibt JSON-Report nach
 * tests/bench/.scaling-results.json.
 *
 * Zweck: Skalierungs-Verhalten dokumentieren (O(n), O(n²), ...)
 *
 * Ausführung:
 *   npx vitest bench tests/bench/clustering-scaling.bench.ts
 */

import { describe, bench, beforeAll, afterAll, vi } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

// ═══ Hoisted mock state + Thenable chain factory ════════════════════════
const h = vi.hoisted(() => {
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

// ═══ Scaling Config ═════════════════════════════════════════════════════
const DATASET_SIZES = [200, 500, 1000, 2000] as const;
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

function seedMockData(numMembers: number) {
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

  for (let i = 0; i < numMembers; i++) {
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

  h.state.courts = Array.from({ length: NUM_COURTS }, (_, i) => ({
    id: `c${i}`,
    name: `Court ${i + 1}`,
    surface: 'sand',
    is_active: true,
    club_id: CLUB_ID,
  }));

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

  h.state.seasons = [
    { id: 's-prev', club_id: CLUB_ID, season_type: 'summer', year: 2025 },
    { id: SEASON_ID, club_id: CLUB_ID, season_type: 'summer', year: 2026 },
  ];
}

// ═══ Report writer ═══════════════════════════════════════════════════════
const SCALING_RESULTS: Record<string, any> = {};

function recordRun(label: string, elapsedMs: number, result: any, numMembers: number) {
  SCALING_RESULTS[label] = {
    label,
    numMembers,
    timestamp: new Date().toISOString(),
    meanMs: elapsedMs,
    totalGroups: result.groups.length,
    unassignedCount: result.unassignedMembers.length,
    wishPartnerRate: result.metrics.wishPartnerRate,
  };
  // eslint-disable-next-line no-console
  console.log(
    `\n[SCALING] ${label}: ${elapsedMs.toFixed(1)} ms | members=${numMembers} ` +
      `groups=${result.groups.length} unassigned=${result.unassignedMembers.length}`
  );
}

function writeReport() {
  const reportPath = resolve(__dirname, '.scaling-results.json');
  try {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          nodeVersion: process.version,
          platform: `${process.platform}/${process.arch}`,
          config: { DATASET_SIZES: [...DATASET_SIZES], NUM_TRAINERS, NUM_COURTS },
          runs: SCALING_RESULTS,
        },
        null,
        2
      )
    );
    // eslint-disable-next-line no-console
    console.log(`\n[SCALING] Report written to ${reportPath}`);
  } catch (err) {
    console.error('[SCALING] Failed to write report:', err);
  }
}

// ═══ Scaling Benchmarks ══════════════════════════════════════════════════
describe('Clustering Scaling Benchmark — 200/500/1000/2000 Members', () => {
  beforeAll(() => {
    // eslint-disable-next-line no-console
    console.log(
      `\n[SCALING] Will test sizes: ${DATASET_SIZES.join(', ')} members ` +
        `(${NUM_TRAINERS} trainers, ${NUM_COURTS} courts)`
    );
  });

  afterAll(() => {
    writeReport();

    // Print summary table
    const labels = Object.keys(SCALING_RESULTS);
    if (labels.length > 0) {
      // eslint-disable-next-line no-console
      console.log('\n┌─────────────────────────────────────┬─────────┬──────────┐');
      // eslint-disable-next-line no-console
      console.log('│ Configuration                       │ Members │ Runtime  │');
      // eslint-disable-next-line no-console
      console.log('├─────────────────────────────────────┼─────────┼──────────┤');
      for (const lbl of labels) {
        const r = SCALING_RESULTS[lbl];
        const padded = lbl.padEnd(37);
        const mem = String(r.numMembers).padStart(7);
        const ms = `${r.meanMs.toFixed(1)} ms`.padStart(8);
        // eslint-disable-next-line no-console
        console.log(`│ ${padded} │ ${mem} │ ${ms} │`);
      }
      // eslint-disable-next-line no-console
      console.log('└─────────────────────────────────────┴─────────┴──────────┘');
    }
  });

  // For each dataset size, run 3 configurations
  for (const numMembers of DATASET_SIZES) {
    describe(`${numMembers} Members`, () => {
      bench(
        `baseline greedy — ${numMembers}m`,
        async () => {
          seedMockData(numMembers);
          const engine = new SeasonClusteringEngine(SEASON_ID, CLUB_ID, {
            backtrackDepth: 0,
          });
          const start = performance.now();
          const result = await engine.runClustering(true);
          const elapsed = performance.now() - start;
          const label = `baseline-${numMembers}`;
          if (!SCALING_RESULTS[label]) {
            recordRun(label, elapsed, result, numMembers);
          }
        },
        { iterations: 2, time: 8000 }
      );

      bench(
        `with caching — ${numMembers}m`,
        async () => {
          seedMockData(numMembers);
          const engine = new SeasonClusteringEngine(SEASON_ID, CLUB_ID, {
            backtrackDepth: 0,
          }) as any;
          await engine.loadMembers();
          const start = performance.now();
          const result = await engine.runClustering(true);
          const elapsed = performance.now() - start;
          const label = `caching-${numMembers}`;
          if (!SCALING_RESULTS[label]) {
            recordRun(label, elapsed, result, numMembers);
          }
        },
        { iterations: 2, time: 8000 }
      );

      bench(
        `backtracking — ${numMembers}m (depth=3)`,
        async () => {
          seedMockData(numMembers);
          const engine = new SeasonClusteringEngine(SEASON_ID, CLUB_ID, {
            backtrackDepth: 3,
          });
          const start = performance.now();
          const result = await engine.runClustering(true);
          const elapsed = performance.now() - start;
          const label = `backtracking-${numMembers}`;
          if (!SCALING_RESULTS[label]) {
            recordRun(label, elapsed, result, numMembers);
          }
        },
        { iterations: 2, time: 12000 }
      );
    });
  }
});
