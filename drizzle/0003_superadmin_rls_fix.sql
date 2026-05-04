-- Migration: 0003_superadmin_rls_fix.sql
-- Purpose: Allow superadmin to view all clubs regardless of membership
-- Date: 2026-05-04

-- Drop existing club select policy
DROP POLICY IF EXISTS "clubs_select_own" ON clubs;

-- Create new policy: Superadmin sees all clubs, others see only their clubs
CREATE POLICY "clubs_select_own" ON clubs
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM user_club_memberships
        WHERE user_id = auth.uid() AND role = 'superadmin' AND is_active = true
      )
      OR id IN (
        SELECT club_id FROM user_club_memberships
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- Similarly for other tables that use club-based filtering:
-- bookings: superadmin can see all bookings
DROP POLICY IF EXISTS "bookings_select_own" ON bookings;
CREATE POLICY "bookings_select_own" ON bookings
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM user_club_memberships
        WHERE user_id = auth.uid() AND role = 'superadmin' AND is_active = true
      )
      OR club_id IN (
        SELECT club_id FROM user_club_memberships
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- courts
DROP POLICY IF EXISTS "courts_select_own" ON courts;
CREATE POLICY "courts_select_own" ON courts
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM user_club_memberships
        WHERE user_id = auth.uid() AND role = 'superadmin' AND is_active = true
      )
      OR club_id IN (
        SELECT club_id FROM user_club_memberships
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- schedules
DROP POLICY IF EXISTS "schedules_select_own" ON schedules;
CREATE POLICY "schedules_select_own" ON schedules
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM user_club_memberships
        WHERE user_id = auth.uid() AND role = 'superadmin' AND is_active = true
      )
      OR club_id IN (
        SELECT club_id FROM user_club_memberships
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- sessions (via schedule club)
DROP POLICY IF EXISTS "sessions_select_own" ON sessions;
CREATE POLICY "sessions_select_own" ON sessions
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM user_club_memberships
        WHERE user_id = auth.uid() AND role = 'superadmin' AND is_active = true
      )
      OR schedule_id IN (
        SELECT id FROM schedules
        WHERE club_id IN (
          SELECT club_id FROM user_club_memberships
          WHERE user_id = auth.uid() AND is_active = true
        )
      )
    )
  );

-- trainers (via trainer_clubs)
DROP POLICY IF EXISTS "trainers_select_own" ON trainers;
CREATE POLICY "trainers_select_own" ON trainers
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM user_club_memberships
        WHERE user_id = auth.uid() AND role = 'superadmin' AND is_active = true
      )
      OR id IN (
        SELECT trainer_id FROM trainer_clubs
        WHERE club_id IN (
          SELECT club_id FROM user_club_memberships
          WHERE user_id = auth.uid() AND is_active = true
        )
      )
    )
  );

-- Note: Insert/Update policies keep club-based checks; superadmin already has club context via membership
