-- ============================================================================
-- Migration: 20260610_add_trainer_dual_rate.sql
--
-- Adds the dual hourly-rate model to trainer_profiles:
--   - contracted_hourly_rate: contractually agreed rate, admin-only write
--   - extra_hours_rate: rate the trainer can freely set for additional hours
--                       they offer (e.g. extra sessions beyond the contract)
--
-- Business rule (enforced at the application layer, see
-- app/api/trainer-profiles/[id]/route.ts):
--   - Admin can write BOTH fields
--   - Trainer (role='trainer') can write ONLY extra_hours_rate
--     and MUST NOT be able to write contracted_hourly_rate
--
-- The existing `hourly_rate` column is preserved for backward compatibility
-- and acts as a fallback for trainers / display paths that don't yet use
-- the new fields. New code should prefer contracted_hourly_rate when set,
-- otherwise fall back to hourly_rate.
--
-- Run with: psql "$DATABASE_URL" -f supabase/migrations/20260610_add_trainer_dual_rate.sql
-- ============================================================================

ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS contracted_hourly_rate numeric(10, 2)
    CHECK (contracted_hourly_rate IS NULL OR contracted_hourly_rate >= 0);

ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS extra_hours_rate numeric(10, 2)
    CHECK (extra_hours_rate IS NULL OR extra_hours_rate >= 0);

COMMENT ON COLUMN public.trainer_profiles.contracted_hourly_rate IS
  'Contractually agreed hourly rate (admin-only write, read-only for trainer). ' ||
  'Numeric(10,2), EUR. NULL = no contract rate set; in that case fall back to hourly_rate.';

COMMENT ON COLUMN public.trainer_profiles.extra_hours_rate IS
  'Hourly rate the trainer can freely set for additional hours they offer ' ||
  '(e.g. extra sessions beyond the contract). Numeric(10,2), EUR. ' ||
  'Editable by the trainer themselves; admin can also write.';
