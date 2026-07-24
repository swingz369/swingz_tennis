-- ============================================================================
-- Migration: 20260610_add_unassigned_rate_threshold.sql
--
-- Sprint 4 P0 #3 follow-up: Adds the `unassigned_rate_threshold` column to
-- `season_planning_configs` so admins can tune the adaptive-backtrack
-- threshold from the planning config UI instead of always using the engine
-- default (0.05 = 5%).
--
-- The engine code (lib/season-planning/clustering-engine.ts) uses this
-- column via `loadConfig()` with a DEFAULT fallback so that existing rows
-- continue to work after the column is added.
--
-- A value of 1.0 effectively disables the second backtrack pass (since
-- unassignedRate > 1.0 is impossible). A value of 0.0 would force the
-- second pass on every run with any unassigned members.
-- ============================================================================

ALTER TABLE public.season_planning_configs
  ADD COLUMN IF NOT EXISTS unassigned_rate_threshold numeric
    NOT NULL
    DEFAULT 0.05
    CHECK (unassigned_rate_threshold >= 0 AND unassigned_rate_threshold <= 1);

COMMENT ON COLUMN public.season_planning_configs.unassigned_rate_threshold IS
  'Sprint 4 P0 #3 (Adaptive Backtrack): if the unassigned-member rate after the first backtrack pass is still above this threshold (default 5%, range 0..1), the engine runs a second pass with depth=5 to give the algorithm more freedom to re-slot victims. Set to 1.0 to disable the second pass.';
