-- lib/services/auto-planning.service.ts inserts action_type = 'auto_plan_completed'
-- after a successful auto-plan run, but the CHECK constraint widened in
-- 20260701010000_widen_season_planning_history_action_type_check.sql only allows
-- 'auto_plan_started' — every successful auto-plan run violates the CHECK (23514).

BEGIN;

ALTER TABLE season_planning_history
  DROP CONSTRAINT IF EXISTS season_planning_history_action_type_check;

ALTER TABLE season_planning_history
  ADD CONSTRAINT season_planning_history_action_type_check
  CHECK (action_type IN (
    'created',
    'updated',
    'deleted',
    'season_created',
    'preferences_opened',
    'auto_plan_started',
    'auto_plan_completed',
    'plan_published',
    'season_activated',
    'season_completed',
    'manual_edit',
    'plan_created',
    'plan_regenerated',
    'entry_added',
    'entry_modified',
    'entry_removed',
    'conflict_resolved',
    'preferences_closed',
    'published'
  ));

COMMIT;
