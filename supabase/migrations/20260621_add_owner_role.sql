-- Migration: Add 'owner' role (Plattformbetreiber)
-- owner > superadmin > admin > trainer > member

-- 1. Helper function: is_owner() — SECURITY DEFINER to avoid RLS recursion
CREATE OR REPLACE FUNCTION is_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
  )
$$;

-- 2. owner_setup_completed_at on users (for future onboarding gate)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS owner_setup_completed_at timestamptz;

-- 3. Update RLS policies so owner has full read/write access

-- clubs: owner and superadmin see all
DROP POLICY IF EXISTS "clubs_owner_select" ON clubs;
CREATE POLICY "clubs_owner_select" ON clubs
  FOR SELECT
  USING (is_owner() OR is_superadmin() OR is_club_member(id));

-- memberships: owner sees all rows
DROP POLICY IF EXISTS "memberships_owner_select" ON user_club_memberships;
CREATE POLICY "memberships_owner_select" ON user_club_memberships
  FOR SELECT
  USING (is_owner() OR is_superadmin() OR is_club_admin(club_id) OR user_id = auth.uid());

-- owner can insert memberships (create admin accounts from owner panel)
DROP POLICY IF EXISTS "memberships_owner_insert" ON user_club_memberships;
CREATE POLICY "memberships_owner_insert" ON user_club_memberships
  FOR INSERT
  WITH CHECK (is_owner() OR is_superadmin() OR is_club_admin(club_id));

-- owner can update memberships
DROP POLICY IF EXISTS "memberships_owner_update" ON user_club_memberships;
CREATE POLICY "memberships_owner_update" ON user_club_memberships
  FOR UPDATE
  USING (is_owner() OR is_superadmin() OR is_club_admin(club_id));

-- 4. Document the role column
COMMENT ON COLUMN user_club_memberships.role IS
  'owner | superadmin | admin | trainer | member — owner = Plattformbetreiber (Swingz GmbH), superadmin = Tennisschule-Chef';
