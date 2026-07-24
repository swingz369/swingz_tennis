-- Fix RLS policies that reference auth.users directly
-- Replace auth.users with public.users for consistency with FK migration
-- All 6 policies use the pattern: SELECT users.email FROM auth.users WHERE users.id = auth.uid()
-- This works identically with public.users since all auth.users have matching public.users entries

BEGIN;

-- ═══ trainer_absences (4 policies) ═══

-- 1. Trainers can view their own absences (SELECT)
DROP POLICY IF EXISTS "Trainers can view their own absences" ON trainer_absences;
CREATE POLICY "Trainers can view their own absences" ON trainer_absences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trainer_absences.club_id
        AND cm.user_id = auth.uid()
        AND cm.role::text = 'trainer'::text
        AND cm.is_active = true
        AND EXISTS (
          SELECT 1 FROM trainer_club tc
          JOIN trainers t ON t.id = tc.trainer_id
          WHERE tc.trainer_id = trainer_absences.trainer_id
            AND tc.club_id = trainer_absences.club_id
            AND t.email::text = (SELECT u.email FROM public.users u WHERE u.id = auth.uid())::text
        )
    )
  );

-- 2. Trainers can create their own absences (INSERT)
DROP POLICY IF EXISTS "Trainers can create their own absences" ON trainer_absences;
CREATE POLICY "Trainers can create their own absences" ON trainer_absences
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trainer_absences.club_id
        AND cm.user_id = auth.uid()
        AND cm.role::text = 'trainer'::text
        AND cm.is_active = true
        AND EXISTS (
          SELECT 1 FROM trainer_club tc
          JOIN trainers t ON t.id = tc.trainer_id
          WHERE tc.trainer_id = trainer_absences.trainer_id
            AND tc.club_id = trainer_absences.club_id
            AND t.email::text = (SELECT u.email FROM public.users u WHERE u.id = auth.uid())::text
        )
    )
  );

-- 3. Trainers can update their own pending absences (UPDATE)
DROP POLICY IF EXISTS "Trainers can update their own pending absences" ON trainer_absences;
CREATE POLICY "Trainers can update their own pending absences" ON trainer_absences
  FOR UPDATE USING (
    status::text = 'pending'::text
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trainer_absences.club_id
        AND cm.user_id = auth.uid()
        AND cm.role::text = 'trainer'::text
        AND cm.is_active = true
        AND EXISTS (
          SELECT 1 FROM trainer_club tc
          JOIN trainers t ON t.id = tc.trainer_id
          WHERE tc.trainer_id = trainer_absences.trainer_id
            AND tc.club_id = trainer_absences.club_id
            AND t.email::text = (SELECT u.email FROM public.users u WHERE u.id = auth.uid())::text
        )
    )
  );

-- 4. Trainers can delete their own pending absences (DELETE)
DROP POLICY IF EXISTS "Trainers can delete their own pending absences" ON trainer_absences;
CREATE POLICY "Trainers can delete their own pending absences" ON trainer_absences
  FOR DELETE USING (
    status::text = 'pending'::text
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trainer_absences.club_id
        AND cm.user_id = auth.uid()
        AND cm.role::text = 'trainer'::text
        AND cm.is_active = true
        AND EXISTS (
          SELECT 1 FROM trainer_club tc
          JOIN trainers t ON t.id = tc.trainer_id
          WHERE tc.trainer_id = trainer_absences.trainer_id
            AND tc.club_id = trainer_absences.club_id
            AND t.email::text = (SELECT u.email FROM public.users u WHERE u.id = auth.uid())::text
        )
    )
  );

-- ═══ trial_trainings (2 policies) ═══

-- 5. Trainers can view their assigned trial trainings (SELECT)
DROP POLICY IF EXISTS "Trainers can view their assigned trial trainings" ON trial_trainings;
CREATE POLICY "Trainers can view their assigned trial trainings" ON trial_trainings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      JOIN trainers t ON t.email::text = (SELECT u.email FROM public.users u WHERE u.id = cm.user_id)::text
      WHERE cm.club_id = trial_trainings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role::text = 'trainer'::text
        AND cm.is_active = true
        AND t.id = trial_trainings.trainer_id
    )
  );

-- 6. Trainers can update their assigned trial trainings (UPDATE)
DROP POLICY IF EXISTS "Trainers can update their assigned trial trainings" ON trial_trainings;
CREATE POLICY "Trainers can update their assigned trial trainings" ON trial_trainings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      JOIN trainers t ON t.email::text = (SELECT u.email FROM public.users u WHERE u.id = cm.user_id)::text
      WHERE cm.club_id = trial_trainings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role::text = 'trainer'::text
        AND cm.is_active = true
        AND t.id = trial_trainings.trainer_id
    )
  );

COMMIT;
