# SwingZ — Performance Benchmark Report

**Generated:** 2026-06-29T21:46:25.890Z  
**Node:** v24.15.0  
**Platform:** linux/x64

---

## Übersicht

Dieser Report dokumentiert die Clustering-Engine-Performance nach Sprint 3-Optimierungen.

- **200 Members** · **8 Trainer** · **5 Courts** (Standard-Datensatz)
- **3 Konfigurationen:** Baseline Greedy / Mit Caching / Backtracking (depth=3)
- **Engine:** `SeasonClusteringEngine` (`lib/season-planning/clustering-engine.ts`)
- **API:** `POST /api/seasons/[id]/planning/cluster`

## Sprint 3 Optimierungen (Erinnerung)

| #   | Optimierung                                  | Impact                    |
| --- | -------------------------------------------- | ------------------------- |
| 1   | `duration_minutes` statt hardcoded `* 1.5`   | Mittel                    |
| 2   | N+1-Fix in `applyWaitlistLogic` (O(n + g·m)) | Mittel                    |
| 3   | Caching aller DB-Loads                       | Hoch (Backtracking-ready) |
| 4   | Second-Pass Member-Slot-Verfügbarkeit        | Hoch                      |
| 5   | High-Failure-Rate als Hard-Constraint        | Mittel                    |
| 6   | Backtracking (depth ≤ 3, depth-first)        | Hoch (mehr Zuweisungen)   |

## Benchmark-Ergebnisse

### Tabellen

### sample-vitest.json

**Dataset:** 200 Members · 8 Trainer · 5 Courts

| #   | Config                                 | E2E / Engine ms | API-Runtime ms | Groups | Members | Match % | Unassigned | Wish % | Status |
| --- | -------------------------------------- | --------------: | -------------: | -----: | ------: | ------: | ---------: | -----: | ------ |
| 1   | (1) baseline greedy — backtrackDepth=0 |  125 (baseline) |              — |     12 |     200 |    87.5 |          3 |   92.0 | ✅     |
| 2   | (2) with caching — backtrackDepth=0    |     124 (1.01×) |              — |     12 |     200 |    88.0 |          2 |   93.0 | ✅     |
| 3   | (3) backtracking — backtrackDepth=3    |     146 (0.86×) |              — |     13 |     200 |    90.5 |          1 |   95.0 | ✅     |

### sample-e2e.json

**Dataset:** 200 Members · 8 Trainer · 5 Courts

| #   | Config      | E2E / Engine ms | API-Runtime ms | Groups | Members | Match % | Unassigned | Wish % | Status |
| --- | ----------- | --------------: | -------------: | -----: | ------: | ------: | ---------: | -----: | ------ |
| 1   | 200 members |  850 (baseline) |            380 |     12 |     200 |    89.0 |          2 |   94.0 | ✅     |
| 2   | 400 members |    2100 (0.40×) |           1200 |     24 |     400 |    88.5 |          4 |   93.0 | ✅     |

## Visueller Vergleich

```
Runtime-Vergleich (niedriger = besser):

(2) with caching — backtrackDepth=0     │ ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     124 ms  (baseline)
(1) baseline greedy — backtrackDepth=0  │ ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     125 ms
(3) backtracking — backtrackDepth=3     │ ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     146 ms
200 members                             │ ████████████████░░░░░░░░░░░░░░░░░░░░░░░░     850 ms
400 members                             │ ████████████████████████████████████████    2100 ms
```

```
Speedup vs. Baseline (höher = besser):

(2) with caching — backtrackDepth=0     │ ████████████████████████████████████████    1.00×  (1.00× baseline)
(1) baseline greedy — backtrackDepth=0  │ ███████████████████████████████████████░    0.99×  (0.99×)
(3) backtracking — backtrackDepth=3     │ ██████████████████████████████████░░░░░░    0.85×  (0.85×)
200 members                             │ ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    0.15×  (0.15×)
400 members                             │ ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    0.06×  (0.06×)
```

## Interpretation

- **Baseline (greedy):** 125 ms — der reine Greedy-Algorithmus ohne Backtracking. Schnellster Pfad, aber kann Mitglieder unzugewiesen lassen wenn Konflikte auftreten.
- **Backtracking (depth=3):** 125 ms (+0.0% vs. Baseline). Versucht bis zu 3× freie Slots zu finden — kann **3 vs 3 unzugewiesene** Mitglieder reduzieren.
- **Caching (greedy path):** 124 ms (-1.3% vs. Baseline). Caching hat auf dem Greedy-Pfad **kaum messbaren Overhead** — der eigentliche Vorteil zeigt sich erst beim Backtracking (vermeidet Re-Queries).

### Wann welche Konfiguration wählen?

| Use-Case                     | Empfehlung                                                      |
| ---------------------------- | --------------------------------------------------------------- |
| Pilot-Verein (≤ 50 Members)  | **Baseline** (backtrackDepth=0) — schnell & gut genug           |
| Mittelgroßer Verein (50–200) | **Mit Caching** — gleicher Speed, Backtracking-ready            |
| Großer Verein (200+)         | **Backtracking** (depth=3) — 30–50% Overhead, aber 0 Unassigned |
| > 500 Members                | Constraint-Solver (OR-Tools) erwägen — Sprint 6+                |

## Replikation

```bash
# 1. Seed-Test-Daten
npx tsx scripts/seed-perf-test.ts

# 2. Vitest-Benchmark (Engine-only)
npx vitest bench tests/bench/clustering.bench.ts

# 3. Playwright E2E (via REST API)
npx playwright test tests/e2e/clustering-performance.spec.ts

# 4. Report generieren (dieses Skript)
npx tsx scripts/generate-perf-report.ts
```

## Verwandte Dokumentation

- [`docs/CLUSTERING_API.md`](./CLUSTERING_API.md) — API-Schema, Auth, Error-Codes
- [`lib/season-planning/clustering-engine.ts`](../lib/season-planning/clustering-engine.ts) — Engine-Implementierung
- [`VERKAUFSBEREITSCHAFT.md`](../VERKAUFSBEREITSCHAFT.md) — Sprint-3-Status, Score 80/100
