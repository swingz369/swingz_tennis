-- Migration: 20260629_club_features.sql
-- Purpose:   Add per-club feature flags so admins can enable/disable optional
--            modules (Shop, Turniere, Probetrainings, KI-Matchmaking) from
--            the onboarding wizard and from Settings → Module.
-- Author:    SwingZ Team
-- Date:      2026-06-29

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Add `features` JSONB column to clubs
-- ────────────────────────────────────────────────────────────────────────────
-- Default: all core features enabled, all optional features disabled.
-- The application layer (lib/features.ts) is the source of truth for which
-- keys are valid; this column is a plain JSONB store.

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT jsonb_build_object(
    'members',         true,
    'trainers',        true,
    'seasons',         true,
    'finance',         true,
    'shop',            false,
    'tournaments',     false,
    'trial_training',  false,
    'ai_matchmaking',  false
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 2. GIN index for fast filtering on individual feature flags
-- ────────────────────────────────────────────────────────────────────────────
-- Allows queries like `WHERE features @> '{"shop": true}'` to use an index.

CREATE INDEX IF NOT EXISTS idx_clubs_features_gin
  ON public.clubs
  USING GIN (features);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Document the schema
-- ────────────────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.clubs.features IS
  'Per-club feature flag map. Keys defined in lib/features.ts. Core features (members, trainers, seasons, finance) are immutable and always true.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Backfill: any existing clubs get the default map (idempotent via DEFAULT).
-- ────────────────────────────────────────────────────────────────────────────
UPDATE public.clubs
SET features = jsonb_build_object(
    'members',         true,
    'trainers',        true,
    'seasons',         true,
    'finance',         true,
    'shop',            false,
    'tournaments',     false,
    'trial_training',  false,
    'ai_matchmaking',  false
  )
WHERE features IS NULL
   OR features = '{}'::jsonb
   OR NOT (features ? 'members');
