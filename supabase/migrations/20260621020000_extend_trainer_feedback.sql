-- ============================================================
-- TRAINER FEEDBACK — ADD SEASON PLANNING COLUMNS
-- ============================================================
-- The trainer_feedback table (20260506000000_feedback_system.sql)
-- was created for member-to-trainer session ratings (1-5 stars).
-- The Drizzle schema (season-planning-schema.ts) extends it with
-- end-of-season assessment columns: attendance, readiness for
-- next level, performance ratings, and strengths/improvements.
--
-- This migration adds the missing columns so both use cases
-- coexist in the same table.
-- ============================================================

-- Season context (needed for route queries)
ALTER TABLE public.trainer_feedback
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE;

-- Group context
ALTER TABLE public.trainer_feedback
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Attendance (auto-captured but trainer can override)
ALTER TABLE public.trainer_feedback
  ADD COLUMN IF NOT EXISTS attendance_quote NUMERIC(5,2);

-- Readiness for next level
ALTER TABLE public.trainer_feedback
  ADD COLUMN IF NOT EXISTS ready_for_next_level VARCHAR(20) DEFAULT 'undecided';

ALTER TABLE public.trainer_feedback
  ADD COLUMN IF NOT EXISTS recommended_level VARCHAR(20);

-- Internal notes (separate from public 'comment')
ALTER TABLE public.trainer_feedback
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Performance metrics
ALTER TABLE public.trainer_feedback
  ADD COLUMN IF NOT EXISTS performance_rating INTEGER;

ALTER TABLE public.trainer_feedback
  ADD COLUMN IF NOT EXISTS strengths JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.trainer_feedback
  ADD COLUMN IF NOT EXISTS areas_for_improvement JSONB DEFAULT '[]'::jsonb;

-- Submission tracking
ALTER TABLE public.trainer_feedback
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE public.trainer_feedback
  ADD COLUMN IF NOT EXISTS is_submitted BOOLEAN NOT NULL DEFAULT false;

-- New indexes for season planning queries
CREATE INDEX IF NOT EXISTS feedback_season_idx ON public.trainer_feedback(season_id);
CREATE INDEX IF NOT EXISTS feedback_submitted_idx ON public.trainer_feedback(season_id, is_submitted);
CREATE INDEX IF NOT EXISTS feedback_ready_idx ON public.trainer_feedback(season_id, ready_for_next_level);
