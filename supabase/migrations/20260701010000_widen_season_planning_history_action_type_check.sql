-- supabase/migrations/20260701_widen_season_planning_history_action_type_check.sql
--
-- Ticket 3.7.3 — Variante A: Check-Constraint-Whitelist erweitern.
--
-- Problem:  Postgres-Check `season_planning_history_action_type_check` rejected
--           `created`/`updated`/`deleted` (SQLSTATE 23514) — die Werte, die der
--           AFTER-INSERT/UPDATE/DELETE-Trigger `log_season_plan_entry_changes()`
--           (in Migration `20260506_fix_season_planning_groups.sql` L145-188)
--           emittiert. Der Bug war vor 2026-06-30 durch den FK-Drift auf
--           `season_plan_entries.group_id` maskiert (23503 schlug vor, und der
--           Audit-Trigger wurde nie erreicht).
--
-- Lösung:  Whitelist auf die **Vereinigung** aller 18 Werte erweitern, die in
--           den drei Source-of-Truth-Texten für `action_type` auftauchen:
--             (A) Trigger log_season_plan_entry_changes  — 3 Werte
--             (B) Trigger log_season_planning_action    — 7 Werte (Saison-State-Machine)
--             (C) Spalten-Kommentar L221 in 20260506_season_planning_system.sql — 9 Werte
--
-- Aufwand:  ≤ 5 min Migration + statischer Vitest-Regression-Check.
--
-- Sicherheit:  Migration ist idempotent (DROP IF EXISTS + ADD CONSTRAINT). Sie
--              greift **ausschließlich** auf die CHECK-Constraint-Definition zu;
--              keine Trigger-, Tabellen- oder Indexänderungen.
--
-- Out-of-Scope:
--   - ADR-013 Folge B (Trigger-Refactoring zu EINER `log_season_planning_event()`) —
--     separates Ticket; see docs/ADR-013-source-of-truth-declaration.md Folge §3.
--   - `training_groups` final droppen — Ticket 3.7.4 (siehe ADR-013 §1).
--
-- Apply:   `npx supabase db push` oder `psql -v ON_ERROR_STOP=1 -f <file>` auf einer
--          Entwickler-Maschine. Akzeptanz-Repro via `npx tsx scripts/_repro-cluster.ts`
--          muss nach Apply exit 0 zurückgeben (siehe 3.7.3 Akzeptanzkriterium 2).

BEGIN;

-- 1) Bestehenden Constraint droppen (IF EXISTS für Re-Apply-Sicherheit).
ALTER TABLE season_planning_history
  DROP CONSTRAINT IF EXISTS season_planning_history_action_type_check;

-- 2) Constraint mit vereinigter Whitelist hinzufügen.
--    Reihenfolge: zuerst die **vom Live-Trigger A emittierten** Werte (3),
--    dann die **vom Live-Trigger B emittierten** Werte (7 — `preferences_opened`
--    dedupliziert gegen Trigger A/C — kein Duplikat), dann die historischen
--    Kommentar-Literal-Werte aus C (9 davon, 1 dedupliziert mit Trigger B).
ALTER TABLE season_planning_history
  ADD CONSTRAINT season_planning_history_action_type_check
  CHECK (action_type IN (
    -- === Trigger A: log_season_plan_entry_changes() in 20260506_fix_*.sql L145-188 ===
    'created',
    'updated',
    'deleted',

    -- === Trigger B: log_season_planning_action() in 20260519_*.sql ===
    'season_created',
    'preferences_opened',     -- auch in C dokumentiert, dedupliziert
    'auto_plan_started',
    'plan_published',
    'season_activated',
    'season_completed',
    'manual_edit',

    -- === Comment-Literal C: 20260506_season_planning_system.sql:221 ===
    'plan_created',
    'plan_regenerated',
    'entry_added',
    'entry_modified',
    'entry_removed',
    'conflict_resolved',
    'preferences_closed',
    'published'
  ));

-- 3) Optional: Mini-Audit-Ping via NOTICE zur Verifikation nach Apply.
DO $$
BEGIN
  RAISE NOTICE 'season_planning_history_action_type_check widened to 18-value union (Ticket 3.7.3, Variant A)';
END $$;

COMMIT;
