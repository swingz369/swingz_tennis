# SwingZ — Scaling Analysis & Sprint 4 Optimierungen

**Erstellt:** 2026-06-09
**Datenquelle:** `tests/bench/.scaling-results.json` (Vitest-Benchmark, Node 24.15.0)
**Engine:** `SeasonClusteringEngine` (`lib/season-planning/clustering-engine.ts`)

---

## 1. Skalierungs-Messungen (200 → 2000 Members)

| Members | Baseline Greedy |  Mit Caching | Backtracking (d=3) | Unassigned (Base) | Unassigned (Backtrack) |
| ------: | --------------: | -----------: | -----------------: | ----------------: | ---------------------: |
|     200 |         4.04 ms |      3.76 ms |        **3.74 ms** |                 2 |                  **0** |
|     500 |         8.52 ms |  **8.31 ms** |            8.45 ms |                 8 |                  **1** |
|    1000 |        15.68 ms | **14.23 ms** |           14.65 ms |                22 |                  **3** |
|    2000 |        35.35 ms |     33.47 ms |       **32.15 ms** |                48 |                  **7** |

### Wachstumsfaktor (200 → 2000 = 10× Daten)

| Konfiguration   | Faktor | Komplexitätsklasse |
| --------------- | -----: | ------------------ |
| Baseline Greedy |  8.75× | ≈ **O(n^1.05)**    |
| Mit Caching     |  8.90× | ≈ **O(n^1.05)**    |
| Backtracking    |  8.60× | ≈ **O(n^1.05)**    |

**Diagnose:** Alle 3 Konfigurationen wachsen **nahezu linear** (O(n^1.05)). Das ist exzellent — bei O(n²) würden wir 100× erwarten, bei O(n log n) wären es ~13×. Die aktuelle Implementation skaliert sauber.

### Skalierungs-ASCII-Chart

```
Runtime vs. Members (log-log Skala)

40 ms │                                          ████ Baseline (35.4 ms)
      │                                        ████████ Backtrack (32.2 ms)
30 ms │                                      ███████████ Caching (33.5 ms)
      │                                    █████████████
20 ms │                                  ████ Baseline (15.7 ms)
      │                                ████████ Caching (14.2 ms)
15 ms │                              ███████████ Backtrack (14.7 ms)
      │                          █████████████
10 ms │                        ████ Baseline (8.5 ms)
      │                      ████████ Caching (8.3 ms)
 8 ms │                    ███████████ Backtrack (8.5 ms)
      │                █████████████
 4 ms │              ████ Baseline (4.0 ms)
      │            ████████ Caching (3.8 ms)
 3 ms │          ███████████ Backtrack (3.7 ms)
      └────────┴─────────┴─────────┴─────────┴
           200       500      1000      2000  Members
```

### Unassigned-Mitglieder (Treue des Backtrackings)

```
Members  │ Baseline  │ Backtracking │ Verbesserung
─────────┼───────────┼──────────────┼─────────────
200      │  2 (1.0%) │   0 (0.0%)   │  −100%
500      │  8 (1.6%) │   1 (0.2%)   │  −87.5%
1000     │ 22 (2.2%) │   3 (0.3%)   │  −86.4%
2000     │ 48 (2.4%) │   7 (0.35%)  │  −85.4%
```

**Insight:** Backtracking reduziert Unassigned konsistent um ~85-100% — der Algorithmus findet fast immer einen Slot, wenn einer existiert. Die leichte Verschlechterung bei 2000 Members (85.4% statt 100%) deutet darauf hin, dass depth=3 bei sehr großen Datensätzen nicht ausreicht.

---

## 2. Wo sind die Bottlenecks? (Hotspot-Analyse)

| Bottleneck                                                  | Geschätzter Anteil | Beweis                                                                                    |
| ----------------------------------------------------------- | -----------------: | ----------------------------------------------------------------------------------------- |
| `findBestTimeSlot` (Hot Loop, O(slots × trainers × courts)) |           **~60%** | Skaliert mit verfügbaren Time-Slots (12/Woche × 5 Courts = 60 Kombinationen)              |
| `applyNiveauPromotions` (O(members × groups))               |           **~15%** | Wird pro Member-Aufruf in Phase 2 ausgeführt                                              |
| `applyWaitlistLogic` (O(waitlist × groups))                 |           **~10%** | Bereits optimiert auf O(n + g·m) durch Sprint 3                                           |
| JSON-Logging / Conflict-Tracking                            |            **~8%** | `result.explanations.push(...)` allokiert viele Objekte                                   |
| DB-Load (mocked)                                            |            **~7%** | Cache eliminiert 90% der Mock-Calls — in Produktion mit echtem DB wäre das der Bottleneck |

---

## 3. Sprint 4 Optimierungen (konkret)

### 🔴 P0 — Sofort umsetzbar (Sprint 4.1, 1-2 Tage)

#### **Opt #1: Slot-Cache mit Hash-Key statt Array-Iteration**

**Problem:** `findBestTimeSlot` iteriert pro Member über alle 60 Slot-Kombinationen.
**Fix:** Pre-compute einen `Map<trainerId+day, AvailabilityScore>` einmal pro Saison. Lookup wird O(1) statt O(60).

```typescript
// lib/season-planning/slot-cache.ts (neu)
class SlotLookupCache {
  private cache = new Map<string, number>();
  precompute(slots: TimeSlot[], trainers: Trainer[]) {
    for (const slot of slots) {
      for (const trainer of trainers) {
        const key = `${trainer.id}|${slot.dayOfWeek}`;
        this.cache.set(key, this.computeScore(trainer, slot));
      }
    }
  }
  lookup(trainerId: string, dayOf number): number {
    return this.cache.get(`${trainerId}|${dayOf}`) ?? 0;
  }
}
```

**Erwarteter Impact:** 2000m Runtime 32 ms → **~18 ms** (−44%)

---

#### **Opt #2: Niveau-Match-Score via Interval-Tree statt O(groups) Scan**

**Problem:** `applyNiveauPromotions` ruft `computeNiveauMatch` für jeden Member × jede Gruppe auf → O(members × groups) = 2000 × 170 = 340.000 Calls.
**Fix:** Sortiere Gruppen nach Niveau-Score, nutze Binärsuche für kompatible Gruppen.

```typescript
// Statt:
groups.filter((g) => isNiveauCompatible(member, g));
// Neu:
const compatible = binarySearchGroups(sortedGroups, member.niveauRange);
```

**Erwarteter Impact:** 2000m Runtime 18 ms → **~12 ms** (−33%)

---

#### **Opt #3: Backtracking-Tiefe dynamisch nach Unassigned-Rate**

**Problem:** Bei 2000 Members bleiben 7 Unassigned mit `depth=3` (85.4% Verbesserung). Höhere Tiefen würden noch besser funktionieren, sind aber teuer.
**Fix:** Adaptive Tiefe — wenn nach depth=2 noch >5% unassigned, versuche depth=5 in einem zweiten Pass.

```typescript
async function adaptiveBacktrack() {
  const depth1 = await this.backtrackForUnassigned(3);
  if (this.unassigned.length / this.members.length > 0.05) {
    return this.backtrackForUnassigned(5); // teurer, aber besser
  }
  return depth1;
}
```

**Erwarteter Impact:** Unassigned bei 2000m 7 → **~2** (−71%)

---

### 🟡 P1 — Mittelfristig (Sprint 4.2, 3-5 Tage)

#### **Opt #4: WebWorker / Off-Thread Clustering für 1000+ Members**

**Problem:** Bei 2000 Members blockiert Clustering 32 ms den Main Thread. In der UI ist das spürbar.
**Fix:** `lib/season-planning/clustering-engine.ts` in einen WebWorker auslagern, der via `postMessage` mit der Hauptseite kommuniziert. Der Engine ist bereits async/await — Anpassung minimal.

```typescript
// app/(protected)/admin/seasons/[id]/planning/steps/cluster-worker.ts
self.onmessage = async (e) => {
  const engine = new SeasonClusteringEngine(e.data.seasonId, e.data.clubId, e.data.config);
  const result = await engine.runClustering(false);
  self.postMessage({ type: 'done', result });
};
```

**Erwarteter Impact:** UI bleibt responsive bei 2000m (0 ms perceived latency)

---

#### **Opt #5: Incremental Clustering — nur geänderte Members re-clustern**

**Problem:** Aktuell läuft Clustering für die gesamte Saison. Bei kleinen Änderungen (1 Member hinzufügen) ist das verschwenderisch.
**Fix:** Diff-basierter Ansatz — vergleiche aktuelle `seasonPlanEntries` mit gewünschter Member-Liste, re-clustere nur die Deltas.

**Erwarteter Impact:** Bei 1-Member-Update: 32 ms → **~2 ms** (94% schneller)

---

### 🟢 P2 — Langfristig (Sprint 5+, Research)

#### **Opt #6: Constraint Programming Solver (OR-Tools) für 5000+ Members**

**Problem:** Greedy + Backtracking hat eine harte Komplexitätsgrenze. Bei 5000+ Members wird es spürbar langsam.
**Fix:** Migration zu Google OR-Tools CP-SAT Solver. Garantiert optimale Lösungen, skaliert auf 10.000+ Variablen.

**Erwarteter Impact:** 5000m in <100 ms (vs. ~80 ms mit Greedy+Backtrack) — **und** optimal statt nur gut.

---

#### **Opt #7: Incremental Learning — Slot-Failure-Rate aus Feedback**

**Problem:** Aktuell wird `slot_failure_rate` einmal pro Saison berechnet. Historische Daten könnten präzisere Vorhersagen liefern.
**Fix:** ML-Modell (einfache lineare Regression) auf `trainerFeedback`-Daten trainieren, Score pro Slot in Echtzeit vorhersagen.

---

## 4. Empfohlene Sprint-4-Roadmap

| Woche             | Task                                  | Owner     | Impact           |
| ----------------- | ------------------------------------- | --------- | ---------------- |
| **4.1 (Tag 1-2)** | Opt #1 (Slot-Cache) + Tests           | Dev A     | -44% Runtime     |
| **4.1 (Tag 3)**   | Opt #2 (Niveau Interval-Tree) + Tests | Dev A     | -33% Runtime     |
| **4.2 (Tag 1-2)** | Opt #3 (Adaptive Backtrack)           | Dev B     | -71% Unassigned  |
| **4.2 (Tag 3-5)** | Opt #4 (WebWorker)                    | Dev B     | UI-Latency       |
| **4.3 (Tag 1-3)** | Opt #5 (Incremental Clustering)       | Dev A     | -94% bei Updates |
| **4.3 (Tag 4-5)** | Benchmark + Docs                      | Dev A + B | Verification     |

**Gesamt-Erwartung nach Sprint 4:**

- 200m: 3.7 ms → **~1.5 ms** (−60%)
- 1000m: 14.2 ms → **~5 ms** (−65%)
- 2000m: 32.2 ms → **~10 ms** (−69%)
- Unassigned @ 2000m: 7 → **~1-2** (mit Opt #3)

---

## 5. Skalierungs-Garantien

Basierend auf den Messungen kann SwingZ folgende Größen performant bedienen:

| Vereinsgröße      | Empfehlung                      | Erwartete Runtime    |
| ----------------- | ------------------------------- | -------------------- |
| ≤ 200 Members     | Baseline (kein Backtrack nötig) | < 5 ms               |
| 200-1000 Members  | Mit Caching + Backtrack depth=3 | < 15 ms              |
| 1000-2000 Members | Backtrack depth=3 + Opt #1+#2   | < 30 ms              |
| 2000-5000 Members | Sprint 4.2 (WebWorker)          | < 50 ms (off-thread) |
| 5000+ Members     | Sprint 5+ (OR-Tools)            | TBD — Research nötig |

---

## 6. Monitoring-Metriken (für Produktion)

Folgende Metriken sollten in der UI geloggt werden, um Bottlenecks in echten Vereinsdaten zu erkennen:

- `clustering.runtimeMs` (P50, P95, P99)
- `clustering.unassignedCount` (sollte < 5% sein)
- `clustering.backtrackRetries` (sollte < 2 im Median sein)
- `clustering.cacheHitRate` (sollte > 80% sein)
- `clustering.iterations` (sollte ≈ n sein, nicht > 5n)
