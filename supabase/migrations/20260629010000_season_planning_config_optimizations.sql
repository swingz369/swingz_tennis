-- Migration: 20260629_season_planning_config_optimizations.sql
-- Purpose:   Add two new config columns to season_planning_configs for the
--            clustering-engine optimizations #5 (high-failure hard constraint)
--            and #6 (backtracking). Both are safe to deploy without backfill
--            since they default to current behavior.
-- Author:    SwingZ Team
-- Date:      2026-06-29

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Add new columns to season_planning_configs
-- ────────────────────────────────────────────────────────────────────────────

-- Optimization #5: Treat high-failure-rate slots as a hard constraint.
-- When true, the clustering engine skips slots with failure rate >= threshold
-- entirely (instead of just applying a -50 soft-score penalty).
ALTER TABLE public.season_planning_configs
  ADD COLUMN IF NOT EXISTS treat_high_failure_as_hard BOOLEAN NOT NULL DEFAULT false;

-- Optimization #6: Backtracking depth for unassigned members.
-- 0 = greedy only (original behavior).
-- N > 0 = retry up to min(N, 3) times, re-slotting the last N groups
--         to free up slots for previously-unassigned members.
ALTER TABLE public.season_planning_configs
  ADD COLUMN IF NOT EXISTS backtrack_depth INTEGER NOT NULL DEFAULT 0
    CHECK (backtrack_depth >= 0 AND backtrack_depth <= 10);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Document the schema
-- ────────────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.season_planning_configs.treat_high_failure_as_hard IS
  'When true, skip slots with failure_rate >= slot_failure_rate_threshold_pct entirely (Optimization #5). Default false preserves the soft -50 score behavior.';

COMMENT ON COLUMN public.season_planning_configs.backtrack_depth IS
  'Number of last groups to backtrack when unassigned members remain after Phase 5 (Optimization #6). 0 = disabled. Capped at 3 retries at runtime. Max 10 in DB for sanity.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Backfill (idempotent — DEFAULTs handle new rows; explicit update covers existing rows)
-- ────────────────────────────────────────────────────────────────────────────

UPDATE public.season_planning_configs
SET
  treat_high_failure_as_hard = COALESCE(treat_high_failure_as_hard, false),
  backtrack_depth            = COALESCE(backtrack_depth, 0)
WHERE treat_high_failure_as_hard IS NULL
   OR backtrack_depth IS NULL;
