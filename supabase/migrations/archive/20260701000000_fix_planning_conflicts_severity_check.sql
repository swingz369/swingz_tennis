-- The live planning_conflicts_severity_check constraint (added outside
-- tracked migrations) only allowed 'low' | 'medium' | 'high' | 'critical',
-- but ConflictDetector (lib/season-planning/conflict-detector.ts) and the
-- ConflictSeverityLevel type (lib/season-planning/types.ts) only ever emit
-- 'critical' | 'warning' | 'info'. Every conflict with severity 'warning' or
-- 'info' (e.g. trainer_over_limit) broke the publish transaction.
ALTER TABLE planning_conflicts DROP CONSTRAINT IF EXISTS planning_conflicts_severity_check;

ALTER TABLE planning_conflicts ADD CONSTRAINT planning_conflicts_severity_check
  CHECK (severity IN ('critical', 'warning', 'info'));
