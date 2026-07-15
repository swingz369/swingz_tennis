-- Migration: Add clubs.features JSONB column for per-club feature flag system
-- Date: 2026-06-10
-- Purpose: Unblocks seed-perf-test-supabase.ts (which inserts features JSONB)
--          and aligns with swingz-feature-flags skill architecture.

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill: existing clubs should have core features (members + trainers) enabled
UPDATE clubs
SET features = features ||
  jsonb_build_object(
    'members', true,
    'trainers', true,
    'finances', COALESCE((features->>'finances')::boolean, false),
    'season_planning', COALESCE((features->>'season_planning')::boolean, false),
    'shop', COALESCE((features->>'shop')::boolean, false),
    'tournaments', COALESCE((features->>'tournaments')::boolean, false),
    'trial_trainings', COALESCE((features->>'trial_trainings')::boolean, false),
    'ai_matchmaking', COALESCE((features->>'ai_matchmaking')::boolean, false)
  )
WHERE NOT (features ? 'members');

-- Index for fast feature-flag lookups (used by RLS + gating)
CREATE INDEX IF NOT EXISTS idx_clubs_features_gin
  ON clubs USING GIN (features jsonb_path_ops);

COMMENT ON COLUMN clubs.features IS
  'Per-club feature flag map (JSONB). Core features (members, trainers) are immutable. See swingz-feature-flags skill.';
