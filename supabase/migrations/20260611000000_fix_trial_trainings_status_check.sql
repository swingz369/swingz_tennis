-- Migration: 20260611_fix_trial_trainings_status_check
-- Adds 'requested' to the trial_trainings status CHECK constraint.
-- The TrialTraining entity defines 'requested' as a valid status (for public
-- Probetraining bookings), but the DB constraint only allowed:
--   scheduled, completed, cancelled, no_show, converted
-- This caused 500 errors when POST /api/public/trial-training tried to insert
-- a row with status = 'requested'.

-- ============================================
-- 1. Validate existing data
-- ============================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.trial_trainings
    WHERE status NOT IN ('requested','scheduled','completed','cancelled','no_show','converted')
  ) THEN
    RAISE EXCEPTION 'trial_trainings contains status values outside the new enum — cannot add constraint';
  END IF;
END $$;

-- ============================================
-- 2. Drop old constraint
-- ============================================
ALTER TABLE public.trial_trainings
  DROP CONSTRAINT IF EXISTS trial_trainings_status_check;

-- ============================================
-- 3. Re-add with 'requested' included
-- ============================================
ALTER TABLE public.trial_trainings
  ADD CONSTRAINT trial_trainings_status_check
  CHECK (status IN (
    'requested',
    'scheduled',
    'completed',
    'cancelled',
    'no_show',
    'converted'
  ));
