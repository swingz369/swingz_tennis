-- Fix infinite recursion in user_club_memberships RLS policy
-- The previous policy used a self-referential EXISTS query causing PostgreSQL error 42P17
-- Solution: Use a simpler non-recursive policy

-- Drop all existing policies on user_club_memberships to clean slate
DROP POLICY IF EXISTS "club_membership_access" ON user_club_memberships;
DROP POLICY IF EXISTS "user_club_memberships_access" ON user_club_memberships;
DROP POLICY IF EXISTS "user_club_memberships_access_own" ON user_club_memberships;
DROP POLICY IF EXISTS "user_club_memberships_access_admin" ON user_club_memberships;

-- Simple non-recursive policy: Users can access their own memberships
-- Admins will be handled via service role bypass or application-level checks
CREATE POLICY "user_club_memberships_access_own" ON user_club_memberships
  FOR ALL USING (
    user_id = auth.uid()
  );

-- Note: Admin access to other members' club memberships is handled through:
-- 1. Service role API routes (server-side, bypasses RLS)
-- 2. Application-level authorization checks
-- This avoids RLS recursion entirely.

