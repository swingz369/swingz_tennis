---
name: swingz-vitest-bench
description: SwingZ-specific knowledge for Vitest benchmark files and CI performance tracking — vi.hoisted mock-state factory for Drizzle, thenable-chain DB mocks, JSON report writers, the 3-config (baseline/caching/backtracking) pattern, scaling benchmarks (200/500/1000/2000), and the perf-bench.yml CI workflow with regression detection (>20% PR comment, >50% hard fail).
---

# SwingZ Vitest Benchmarks

## Where it lives

- **2 bench files** (engine-only, no DB connection needed):
  - `tests/bench/clustering.bench.ts` — fixed 200m/8t/5c, 3 configs (539 lines)
  - `tests/bench/clustering-scaling.bench.ts` — variable size (200/500/1000/2000), 3 configs × 4 sizes (507 lines)
- **Vitest config:** `vitest.config.ts` (jsdom, coverage 60% lines/functions/statements, 55% branches)
- **JSON report outputs** (gitignored):
  - `tests/bench/.bench-results.json` — from clustering.bench.ts
  - `tests/bench/.scaling-results.json` — from clustering-scaling.bench.ts
- **Performance dashboard generator:** `scripts/generate-perf-report.ts` (reads both JSONs, regenerates `docs/PERFORMANCE_BENCHMARK.md`)
- **CI workflow:** `.github/workflows/perf-bench.yml` (cron 02:30 UTC, PR trigger, workflow_dispatch)

## The 3-config pattern (engine benchmark)

Every bench file measures **3 configurations** to compare optimization strategies:

| #   | Label                 | Config                                            | What it tests               |
| --- | --------------------- | ------------------------------------------------- | --------------------------- |
| 1   | `(1) baseline greedy` | `backtrackDepth=0`, no cache warmup               | Greedy path overhead        |
| 2   | `(2) with caching`    | `backtrackDepth=0` + `engine.loadMembers()` first | Cache effect on greedy path |
| 3   | `(3) backtracking`    | `backtrackDepth=3`                                | Cache + retry benefit       |

Speedup is computed against baseline: `speedup = baseline.meanMs / current.meanMs`.

## vi.hoisted mock-state pattern (for Drizzle)

The bench files need a working DB without a real connection. The pattern uses `vi.hoisted()` to share mock state between the mock factory and the test code:

```typescript
const h = vi.hoisted(() => {
  const state = {
    members: [] as any[],
    trainers: [] as any[],
    // ... every table needed by the engine
  };

  // Thenable chain factory — Drizzle chains are awaitable
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

vi.mock('@/src/infrastructure/persistence/db', () => ({
  db: {
    select: vi.fn(() => h.makeSelectChain()),
    insert: vi.fn((table: any) => ({
      /* ... */
    })),
    update: vi.fn(() => ({ set: (values: any) => ({ where: async () => ({ rowCount: 1 }) }) })),
    delete: vi.fn(() => ({ where: async () => ({ rowCount: 0 }) })),
  },
}));

vi.mock('@/src/infrastructure/persistence/schema', () => ({
  seasons: { __table: 'seasons' },
  users: { __table: 'users' },
  // ... all tables the engine touches
}));
```

**Key tricks:**

- `dispatchTable(table)` reads `table.__table` to map to the right mock array
- `then()` makes the chain awaitable (Drizzle calls `await db.select()...`)
- `vi.hoisted()` ensures the state is created BEFORE mocks run (Vitest requires this for top-level mock factories)

## The seedMockData pattern

```typescript
function seedMockData(numMembers: number) {
  Object.assign(h.state, {
    /* reset all arrays */
  });

  // Members: random first/last name, weighted skill level (40% beginner, 40% intermediate, 15% advanced, 5% pro)
  for (let i = 0; i < numMembers; i++) {
    const level = randomLevel();
    h.state.members.push({
      pref: { user_id: `m${i}`, preferred_level: level /* ... */ },
      user_name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      user_experience: randomExperience(level),
    });
  }

  // Trainers: 8 fixed, with random availability
  h.state.trainers = Array.from({ length: NUM_TRAINERS }, (_, i) => ({
    /* ... */
  }));

  // Courts: 5 fixed
  h.state.courts = Array.from({ length: NUM_COURTS }, (_, i) => ({
    id: `c${i}`,
    name: `Court ${i + 1}`,
    surface: 'sand',
    is_active: true,
    club_id: CLUB_ID,
  }));

  // Config (triggers loadConfig to populate engine.config)
  h.state.config = {
    /* all seasonPlanningConfigs columns */
  };

  // Seasons (for getPreviousSeasonId)
  h.state.seasons = [{ id: 's-prev' /* ... */ }, { id: SEASON_ID /* ... */ }];
}
```

The bench function calls `seedMockData()` inside the bench body to ensure isolation between iterations.

## JSON report writer

```typescript
function writeReport() {
  const reportPath = resolve(__dirname, '.bench-results.json');
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
          runs: BENCH_RESULTS, // collected in afterAll
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error('[BENCH] Failed to write report:', err);
  }
}
```

Always wrap in `try/catch` because the test process may not have write permission in CI.

## The `bench()` invocation

```typescript
bench(
  '(1) baseline greedy — backtrackDepth=0',
  async () => {
    seedMockData();
    const engine = new SeasonClusteringEngine(SEASON_ID, CLUB_ID, { backtrackDepth: 0 });
    const start = performance.now();
    const result = await engine.runClustering(true);
    const elapsed = performance.now() - start;
    if (!BENCH_RESULTS['(1) baseline greedy']) {
      recordRun('(1) baseline greedy', elapsed, result);
    }
  },
  { iterations: 3, time: 5000 }
);
```

**Tuning:**

- `iterations: 2-3` for scaling benches (each iteration is heavier, fewer runs needed)
- `time: 5000-12000` ms cap per bench (Vitest auto-adjusts iterations)
- Record only on the first run (`if (!BENCH_RESULTS[label])`) to avoid re-recording in iteration 2+

## Running benches

```bash
# Single bench
npx vitest bench tests/bench/clustering.bench.ts --run

# Both files
npx vitest bench tests/bench/

# With explicit iterations
npx vitest bench tests/bench/clustering-scaling.bench.ts -- --reporter=verbose
```

The `--run` flag prevents watch mode.

## CI workflow (`.github/workflows/perf-bench.yml`)

| Trigger                                         | When                   | Behavior                       |
| ----------------------------------------------- | ---------------------- | ------------------------------ |
| `schedule: 30 2 * * *`                          | Nightly at 02:30 UTC   | Full run, uploads to artifacts |
| `pull_request` (path: lib/season-planning/\*\*) | PR touches engine code | Full run, comments on PR       |
| `workflow_dispatch`                             | Manual                 | Full run                       |

**Regression detection** (in the action step):

- **>20% slower** than baseline → PR comment with old vs new numbers
- **>50% slower** → hard fail (exit 1, blocks merge)
- Baseline is the median of the last 5 nightly runs

## Common gotchas

- **vi.hoisted must contain all shared state** — if you put `let state = []` outside `vi.hoisted`, the mock factory captures a stale reference and the state is empty.
- **Path alias in mocks**: `vi.mock('@/src/infrastructure/persistence/db', ...)` uses the SAME alias as the real import — Vite resolves both identically.
- **The engine uses `await db.select()...`**, so the chain must be awaitable (the `.then()` trick).
- **`vitest bench` is in `vitest.config.ts` includes**? No — `include` filters `.test.ts` files. Benches are picked up by `bench()` in any file, so they're always included.
- **Drizzle `$inferInsert` strictness**: payload types in `insert().values()` may need `as unknown as (typeof table.$inferInsert)[]` if the bench payload is dynamically built.
- **LocalDB connection (swingz-test-db on 54323)** is **not** used by bench files — the vi.hoisted mock replaces the entire `db` module.
- **`performance.now()`** is built into Node.js — no need to import `perf_hooks` for sub-ms accuracy.

## Adding a new bench (checklist)

1. Create `tests/bench/<engine-name>.bench.ts`
2. Use the `vi.hoisted` mock-state pattern (copy from clustering.bench.ts)
3. Mock `@/src/infrastructure/persistence/db` and `<domain>-schema` modules
4. Define constants (`NUM_MEMBERS`, `NUM_TRAINERS`, `NUM_COURTS`, `SEASON_ID`, `CLUB_ID`)
5. Implement `seedMockData()` + `randomLevel()` / `randomAvailability()` helpers
6. Implement `recordRun()` + `writeReport()` JSON output
7. Use 3 `bench()` calls in a `describe()` with `beforeAll` (seed) + `afterAll` (write report + summary table)
8. Add to `.github/workflows/perf-bench.yml` (the workflow runs all files matching `tests/bench/*.bench.ts` automatically)
9. Add the output to `scripts/generate-perf-report.ts` to surface in `docs/PERFORMANCE_BENCHMARK.md`

## Related skills

- `swingz-clustering-algorithm` — the engine being benchmarked
- `swingz-drizzle-migrations` — schema + migration patterns the engine queries against
- `swingz-drizzle-rls` — RLS policies that the engine bypasses via `current_setting('app.current_club_id')`
