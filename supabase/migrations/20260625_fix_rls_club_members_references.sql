-- Migration: Fix RLS policies that reference non-existent club_members table
-- Several tables had RLS policies using "SELECT 1 FROM club_members cm" but the
-- actual membership data lives in user_club_memberships. This caused all
-- authenticated (non-superadmin) INSERT/UPDATE/DELETE operations to fail silently
-- or return 500 errors.
--
-- Fix: Replace inline club_members subqueries with the existing SECURITY DEFINER
-- helper functions (is_club_admin, is_club_member, is_club_trainer) that correctly
-- query user_club_memberships.

-- ============================================================================
-- 1. system_settings
-- ============================================================================

-- Admin: full CRUD
DROP POLICY IF EXISTS "Club admins can view settings in their clubs" ON system_settings;
CREATE POLICY "Club admins can view settings in their clubs"
  ON system_settings FOR SELECT
  USING (club_id IS NOT NULL AND is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can create settings in their clubs" ON system_settings;
CREATE POLICY "Club admins can create settings in their clubs"
  ON system_settings FOR INSERT
  WITH CHECK (club_id IS NOT NULL AND is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can update settings in their clubs" ON system_settings;
CREATE POLICY "Club admins can update settings in their clubs"
  ON system_settings FOR UPDATE
  USING (club_id IS NOT NULL AND is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can delete non-required settings in their clubs" ON system_settings;
CREATE POLICY "Club admins can delete non-required settings in their clubs"
  ON system_settings FOR DELETE
  USING (club_id IS NOT NULL AND is_required = false AND is_club_admin(club_id));

-- Members: view public settings
DROP POLICY IF EXISTS "Users can view public settings" ON system_settings;
CREATE POLICY "Users can view public settings"
  ON system_settings FOR SELECT
  USING (is_public = true AND (club_id IS NULL OR is_club_member(club_id)));

-- ============================================================================
-- 2. payment_settings
-- ============================================================================

DROP POLICY IF EXISTS "Club admins can view payment settings in their clubs" ON payment_settings;
CREATE POLICY "Club admins can view payment settings in their clubs"
  ON payment_settings FOR SELECT
  USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can create payment settings in their clubs" ON payment_settings;
CREATE POLICY "Club admins can create payment settings in their clubs"
  ON payment_settings FOR INSERT
  WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can update payment settings in their clubs" ON payment_settings;
CREATE POLICY "Club admins can update payment settings in their clubs"
  ON payment_settings FOR UPDATE
  USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can delete payment settings in their clubs" ON payment_settings;
CREATE POLICY "Club admins can delete payment settings in their clubs"
  ON payment_settings FOR DELETE
  USING (is_club_admin(club_id));

-- ============================================================================
-- 3. fee_configurations
-- ============================================================================

DROP POLICY IF EXISTS "Club admins can view fee configurations in their clubs" ON fee_configurations;
CREATE POLICY "Club admins can view fee configurations in their clubs"
  ON fee_configurations FOR SELECT
  USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can create fee configurations in their clubs" ON fee_configurations;
CREATE POLICY "Club admins can create fee configurations in their clubs"
  ON fee_configurations FOR INSERT
  WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can update fee configurations in their clubs" ON fee_configurations;
CREATE POLICY "Club admins can update fee configurations in their clubs"
  ON fee_configurations FOR UPDATE
  USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can delete fee configurations in their clubs" ON fee_configurations;
CREATE POLICY "Club admins can delete fee configurations in their clubs"
  ON fee_configurations FOR DELETE
  USING (is_club_admin(club_id));

-- Trainers can view active fee configurations
DROP POLICY IF EXISTS "Trainers can view fee configurations in their clubs" ON fee_configurations;
CREATE POLICY "Trainers can view fee configurations in their clubs"
  ON fee_configurations FOR SELECT
  USING (is_club_trainer(club_id));

-- Members can view active fee configurations
DROP POLICY IF EXISTS "Members can view active fee configurations" ON fee_configurations;
CREATE POLICY "Members can view active fee configurations"
  ON fee_configurations FOR SELECT
  USING (
    is_active = true
    AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    AND is_club_member(club_id)
  );

-- ============================================================================
-- 4. trainer_absences
-- ============================================================================

-- Admin CRUD
DROP POLICY IF EXISTS "Club admins can view absences in their clubs" ON trainer_absences;
CREATE POLICY "Club admins can view absences in their clubs"
  ON trainer_absences FOR SELECT
  USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can create absences in their clubs" ON trainer_absences;
CREATE POLICY "Club admins can create absences in their clubs"
  ON trainer_absences FOR INSERT
  WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can update absences in their clubs" ON trainer_absences;
CREATE POLICY "Club admins can update absences in their clubs"
  ON trainer_absences FOR UPDATE
  USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can delete absences in their clubs" ON trainer_absences;
CREATE POLICY "Club admins can delete absences in their clubs"
  ON trainer_absences FOR DELETE
  USING (is_club_admin(club_id));

-- Trainer: view own absences (role check + ownership)
DROP POLICY IF EXISTS "Trainers can view their own absences" ON trainer_absences;
CREATE POLICY "Trainers can view their own absences"
  ON trainer_absences FOR SELECT
  USING (
    is_club_trainer(club_id)
    AND trainer_id IN (
      SELECT t.id FROM trainers t
      JOIN public.users u ON u.email = t.email
      WHERE u.id = auth.uid()
    )
  );

-- Trainer: create own absences (role check + ownership)
DROP POLICY IF EXISTS "Trainers can create their own absences" ON trainer_absences;
CREATE POLICY "Trainers can create their own absences"
  ON trainer_absences FOR INSERT
  WITH CHECK (
    is_club_trainer(club_id)
    AND trainer_id IN (
      SELECT t.id FROM trainers t
      JOIN public.users u ON u.email = t.email
      WHERE u.id = auth.uid()
    )
  );

-- Trainer: update own pending absences (role check + ownership + status)
DROP POLICY IF EXISTS "Trainers can update their own pending absences" ON trainer_absences;
CREATE POLICY "Trainers can update their own pending absences"
  ON trainer_absences FOR UPDATE
  USING (
    status::text = 'pending'::text
    AND is_club_trainer(club_id)
    AND trainer_id IN (
      SELECT t.id FROM trainers t
      JOIN public.users u ON u.email = t.email
      WHERE u.id = auth.uid()
    )
  );

-- Trainer: delete own pending absences (role check + ownership + status)
DROP POLICY IF EXISTS "Trainers can delete their own pending absences" ON trainer_absences;
CREATE POLICY "Trainers can delete their own pending absences"
  ON trainer_absences FOR DELETE
  USING (
    status::text = 'pending'::text
    AND is_club_trainer(club_id)
    AND trainer_id IN (
      SELECT t.id FROM trainers t
      JOIN public.users u ON u.email = t.email
      WHERE u.id = auth.uid()
    )
  );

-- ============================================================================
-- 5. trial_trainings
-- ============================================================================

-- Trainers can view their assigned trial trainings (role check + assignment)
DROP POLICY IF EXISTS "Trainers can view their assigned trial trainings" ON trial_trainings;
CREATE POLICY "Trainers can view their assigned trial trainings"
  ON trial_trainings FOR SELECT
  USING (
    is_club_trainer(club_id)
    AND trainer_id IN (
      SELECT t.id FROM trainers t
      JOIN public.users u ON u.email = t.email
      WHERE u.id = auth.uid()
    )
  );

-- Trainers can update their assigned trial trainings (role check + assignment)
DROP POLICY IF EXISTS "Trainers can update their assigned trial trainings" ON trial_trainings;
CREATE POLICY "Trainers can update their assigned trial trainings"
  ON trial_trainings FOR UPDATE
  USING (
    is_club_trainer(club_id)
    AND trainer_id IN (
      SELECT t.id FROM trainers t
      JOIN public.users u ON u.email = t.email
      WHERE u.id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE system_settings IS 'RLS policies updated: club_members → is_club_admin()/is_club_member() helper functions (20260625)';
COMMENT ON TABLE payment_settings IS 'RLS policies updated: club_members → is_club_admin() helper function (20260625)';
COMMENT ON TABLE fee_configurations IS 'RLS policies updated: club_members → is_club_admin()/is_club_trainer()/is_club_member() helper functions (20260625)';
COMMENT ON TABLE trainer_absences IS 'RLS policies updated: club_members → is_club_admin()/is_club_trainer() helper functions (20260625)';
COMMENT ON TABLE trial_trainings IS 'RLS policies updated: club_members → is_club_trainer() helper function (20260625)';
