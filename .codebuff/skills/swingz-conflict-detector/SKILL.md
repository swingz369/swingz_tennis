---
name: swingz-conflict-detector
description: SwingZ-specific knowledge for the conflict detection system — 8 detector types, severity model, auto-resolve strategies, and UI integration.
---

# SwingZ Conflict Detector

## Where it lives

- **Core:** `lib/season-planning/conflict-detector.ts` (8 detector classes)
- **Schema:** `planning_conflicts` table in `src/infrastructure/persistence/season-planning-schema.ts`
- **API:** `app/api/seasons/[id]/planning/conflicts/route.ts` (GET, POST for resolve)
- **UI:** `app/(protected)/admin/seasons/[id]/planning/steps/finalize-step.tsx` (conflict list)
- **Tests:** `src/__tests__/lib/conflict-detector.test.ts` (if exists)
- **Docs:** `docs/CLUSTERING_API.md` section "Conflict Types"

## The 8 detector types

| #   | Type                         | Severity | Auto-resolvable  | Detection method                                            |
| --- | ---------------------------- | -------- | ---------------- | ----------------------------------------------------------- |
| 1   | `trainer_double_booking`     | critical | ❌               | Same trainer in 2 groups at same time slot                  |
| 2   | `court_double_booking`       | critical | ❌               | Same court assigned to 2 groups simultaneously              |
| 3   | `niveau_span_violation`      | high     | ✅ (split group) | Beginner + Professional in same group (>8 months exp gap)   |
| 4   | `group_size_violation`       | medium   | ✅ (rebalance)   | Group > `group_max_size` or < `group_min_size`              |
| 5   | `slot_failure_rate_exceeded` | medium   | ⚠️ (flag only)   | Historical failure rate > `slot_failure_rate_threshold_pct` |
| 6   | `wish_partner_unfulfilled`   | low      | ✅ (backtrack)   | Wish-partner pair not in same group                         |
| 7   | `trainer_overutilization`    | medium   | ✅ (reassign)    | Trainer > `trainer_utilization_max_pct` (default 80%)       |
| 8   | `availability_violation`     | high     | ❌ (manual)      | Member or trainer not available at assigned slot            |

## Severity model

```typescript
type Severity = 'low' | 'medium' | 'high' | 'critical';

const SEVERITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 } as const;
```

- `critical` → Block publish, require manual intervention
- `high` → Block publish, but auto-resolve candidates exist
- `medium` → Warn but allow publish, auto-resolve recommended
- `low` → Info only, never blocks

## Auto-resolve strategy

`autoResolve(conflict, seasonData)` returns either:

- `{ resolved: true, action: '...', description: '...' }` — auto-fix applied
- `{ resolved: false, reason: '...' }` — requires manual intervention

Example: `niveau_span_violation` auto-resolves by splitting the group at the violation boundary. The smaller group may then fail `group_min_size` — that creates a new conflict of type `group_size_violation` which auto-resolves by merging with adjacent group.

**Termination guarantee:** The resolver has a max-iteration cap (10) to prevent infinite loops. If it hits the cap, the remaining conflicts are flagged for manual review.

## How to add a new conflict type

1. Add to `ConflictType` enum in `season-planning-schema.ts`
2. Create new class extending `BaseDetector` in `conflict-detector.ts`:
   ```typescript
   export class MyNewConflict extends BaseDetector {
     type = 'my_new_conflict' as const;
     severity = 'medium' as const;
     autoResolvable = true;
     detect(seasonData: SeasonData): Conflict[] {
       /* ... */
     }
     autoResolve(conflict: Conflict, seasonData: SeasonData): ResolveResult {
       /* ... */
     }
   }
   ```
3. Register in `CONFLICT_DETECTORS` array
4. Add test in `src/__tests__/lib/conflict-detector.test.ts`
5. Update UI badge color in `finalize-step.tsx` (use `getSeverityColor(severity)`)

## Conflict UI badges (color mapping)

| Severity | Color      | Icon            | Tooltip                                                     |
| -------- | ---------- | --------------- | ----------------------------------------------------------- |
| critical | red-600    | `AlertOctagon`  | "Blockiert Veröffentlichung — manuelle Aktion erforderlich" |
| high     | orange-500 | `AlertTriangle` | "Kritisch — Auto-Auflösung verfügbar"                       |
| medium   | yellow-500 | `AlertCircle`   | "Warnung — wird empfohlen aufzulösen"                       |
| low      | blue-500   | `Info`          | "Information — keine Aktion erforderlich"                   |

## Common tasks

### Debug "why is publish blocked?"

1. Open `app/(protected)/admin/seasons/[id]/planning/steps/finalize-step.tsx`
2. Click "Konflikte prüfen" → API call to `/api/seasons/[id]/planning/conflicts`
3. Response includes `conflicts: Conflict[]` and `blockingCount: number`
4. Filter for `severity IN ('critical', 'high')` — those block publish
5. For each blocking conflict: check if `autoResolvable === true`
   - If yes: POST to `/api/seasons/[id]/planning/conflicts/resolve` with `conflictId`
   - If no: manual intervention required (see conflict's `suggestedActions`)

### Add auto-resolve logic to existing conflict

1. Find the class in `conflict-detector.ts`
2. Implement `autoResolve()` method
3. Set `autoResolvable = true`
4. Test: feed conflict + season data, verify resolved=true
5. Add test case in conflict-detector.test.ts

## Gotchas

- **Conflict detection runs after clustering** — it's a separate phase, not part of `findBestTimeSlot`. If you see a conflict during clustering, you're looking at a different bug.
- **Auto-resolve is non-transactional** — if step 2 of 3 fails, you'll have partial state. The `postbuild` script's migration tracking doesn't apply here; use the conflict's `idempotencyKey`.
- **Wish-partner backtracking** — if `wish_partner_unfulfilled` is auto-resolved via backtracking, the new assignment may trigger a new `slot_availability_violation`. The resolver handles this chain up to depth 10.
- **Severity changes are a breaking change** — if you upgrade a conflict from `medium` to `high`, existing published seasons may become invalid. Always bump a major version in `VERKAUFSBEREITSCHAFT.md`.
