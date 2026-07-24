-- The live planning_conflicts_conflict_type_check constraint (added outside
-- tracked migrations) only allowed an older set of conflict_type values and
-- was missing 'trainer_over_limit', breaking every season publish whose plan
-- has a trainer over their weekly-hours limit (ConflictDetector in
-- lib/season-planning/conflict-detector.ts emits these 8 types).
ALTER TABLE planning_conflicts DROP CONSTRAINT IF EXISTS planning_conflicts_conflict_type_check;

ALTER TABLE planning_conflicts ADD CONSTRAINT planning_conflicts_conflict_type_check
  CHECK (conflict_type IN (
    'trainer_double_booking',
    'member_double_booking',
    'no_trainer_assigned',
    'court_unavailable',
    'trainer_over_limit',
    'high_failure_rate_slot',
    'large_niveau_span',
    'avoid_partner_conflict'
  ));
