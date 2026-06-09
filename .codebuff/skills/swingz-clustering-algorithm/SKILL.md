---
name: swingz-clustering-algorithm
description: SwingZ-specific knowledge for the SeasonClusteringEngine — how the algorithm works, where to find phase implementations, the Sprint 3 optimizations, and how to extend or debug it.
---

# SwingZ Clustering Algorithm

## Where it lives

- **Engine:** `lib/season-planning/clustering-engine.ts` (1787 lines, class `SeasonClusteringEngine`)
- **Types:** `lib/season-planning/types.ts` (SeasonPlanningConfig, RunClusteringRequest, etc.)
- **Schema:** `src/infrastructure/persistence/season-planning-schema.ts` (seasonPlanningConfigs table)
- **API:** `app/api/seasons/[id]/planning/cluster/route.ts` (POST endpoint)
- **Wizard UI:** `app/(protected)/admin/seasons/[id]/planning/` (config-step, plan-edit-step, finalize-step)
- **Tests:** `src/__tests__/lib/clustering-engine.test.ts` (38 tests), `src/__tests__/lib/load-config.test.ts` (7 tests)
- **Bench:** `tests/bench/clustering.bench.ts`, `tests/bench/clustering-scaling.bench.ts`
- **Migration:** `supabase/migrations/20260629_season_planning_config_optimizations.sql` (treat_high_failure_as_hard, backtrack_depth)

## The 5 phases of `runClustering()`

1. **loadConfig** — Reads `seasonPlanningConfigs` for (club_id, season_id), falls back to `DEFAULT_CONFIG` for null values. Caches result in `this.config`.
2. **loadMembers** — Pulls members + their `userTrainingPreferences` + memberships. Caches in `this._memberCache`. Use `as any` to access private cache for benchmarks.
3. **loadTrainers** — Same pattern, with `duration_minutes` (NOT hardcoded `* 1.5`).
4. **loadCourts** — Simple SELECT. Caches in `this._courtCache`.
5. **loadGroups** + **loadSlotFailureRates** — Historical groups from previous seasons, failure rate per (trainer_id, dayOfWeek).
6. **applyNiveauPromotions** — Promotes members who are ready (e.g. beginner→intermediate based on experience_months).
7. **findBestTimeSlot** (HOT LOOP) — For each unassigned member, iterate over (slot, trainer, court) combinations. Uses `treatHighFailureAsHard` config flag. Returns `{ group, member, score }`.
8. **applyWaitlistLogic** — Wish-partner matching with O(n + g·m) complexity (Sprint 3 fix).
9. **computeMetrics** — Returns `{ totalMembers, avgNiveauMatch, wishPartnerRate, iterations, runtimeMs }`.
10. **backtrackForUnassigned** (Sprint 3) — Depth-first backtracking, max 3 retries. Pops last N groups, decrements trainer/court counters, re-runs `findBestTimeSlot` with original slot excluded.

## Sprint 3 Optimizations (do NOT regress these)

| #   | Optimization                          | File location                 | Why it matters                                              |
| --- | ------------------------------------- | ----------------------------- | ----------------------------------------------------------- |
| 1   | `duration_minutes` instead of `* 1.5` | `loadTrainers()`              | Was using hardcoded multiplier, broke for non-90min slots   |
| 2   | O(n + g·m) waitlist                   | `applyWaitlistLogic()`        | Was O(wishlist × groups × members) = 1M ops for 200 members |
| 3   | DB-load caching                       | `loadMembers/Trainers/Courts` | Called multiple times during backtracking                   |
| 4   | Second-pass slot check                | `findBestTimeSlot` retry      | Catches members whose availability is only in 2nd pass      |
| 5   | `treatHighFailureAsHard`              | `findBestTimeSlot`            | Hard-constraint vs soft-score for failure rate              |
| 6   | Backtracking `backtrackDepth`         | `backtrackForUnassigned`      | Reduces unassigned by 85-100%                               |

## Bench performance (baseline 200m dataset)

- Baseline Greedy: ~4.0 ms
- With Caching: ~3.8 ms
- Backtracking (d=3): ~3.7 ms
- 2000m dataset: ~32 ms (linear scaling, O(n^1.05))

## Common tasks

### Add a new config field

1. Add column to `seasonPlanningConfigs` in `src/infrastructure/persistence/season-planning-schema.ts` (`.notNull().default(...)`)
2. Add to `DEFAULT_CONFIG` in `clustering-engine.ts` (line ~70)
3. Add to `loadConfig()` typed access (line ~245-275)
4. Add field to admin UI in `app/(protected)/admin/settings/season-planning-tab.tsx`
5. Add to PUT whitelist in `app/api/seasons/[id]/config/route.ts`
6. Create migration `supabase/migrations/YYYYMMDD_*.sql`
7. Add test case in `src/__tests__/lib/load-config.test.ts`
8. Run `npx tsc --noEmit` to verify typed access works

### Debug a regression

1. Check `docs/PERFORMANCE_BENCHMARK.md` for last known good numbers
2. Run `npx vitest run src/__tests__/lib/clustering-engine.test.ts` (must be 38/38 green)
3. Run `npx vitest bench tests/bench/clustering-scaling.bench.ts` to compare scaling
4. Check Sentry for `clustering.runtimeMs` P95 in production

### Add a new conflict type

1. Add new method to `lib/season-planning/conflict-detector.ts`
2. Add to conflict types enum in `season-planning-schema.ts`
3. Add severity (low/medium/high/critical) + auto-resolvable flag
4. Add E2E test in `e2e/season-planning-backtracking.test.ts`
5. Document in `VERKAUFSBEREITSCHAFT.md` conflict table

## Gotchas

- **Vitest bench --run** does not trigger `afterAll`, so `.bench-results.json` may be missing. Fallback: parse log output with `scripts/extract-bench-from-log.mjs`.
- **Thenable chain mock** in tests uses `__table` sentinel — don't add `as any` to schema mocks.
- **Cache clearing** in benchmarks: re-seed mock data in each `bench()` callback, don't share state across runs.
- **Backtracking depth cap**: `Math.min(config.backtrackDepth, 3, assignments.length)` — the `3` is hardcoded, override only with care.
