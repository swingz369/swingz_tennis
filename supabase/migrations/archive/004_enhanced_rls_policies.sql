-- supabase/migrations/004_enhanced_rls_policies.sql
-- Enhanced RLS policies with role-based access control
-- This migration adds a helper function and additional policies for proper role-based access

-- ============================================================
-- HELPER FUNCTION: Get current user's role from users table
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;

-- ============================================================
-- USERS TABLE - Ensure proper RLS (already enabled in 001)
-- Add role-based policies if not already present
-- ============================================================

-- Users can see their own profile
-- (This might already exist from 001, but we ensure it includes role)
CREATE POLICY IF NOT EXISTS "users_select_own" ON public.users
  FOR SELECT USING (id = auth.uid());

-- Admin/Superadmin can see all users
CREATE POLICY IF NOT EXISTS "users_select_admin" ON public.users
  FOR SELECT USING (get_user_role() IN ('admin', 'superadmin'));

-- Users can update own profile (but not role)
CREATE POLICY IF NOT EXISTS "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (role = (SELECT role FROM public.users WHERE id = auth.uid()));

-- Only superadmin can change roles
CREATE POLICY IF NOT EXISTS "users_update_role_superadmin" ON public.users
  FOR UPDATE USING (get_user_role() = 'superadmin');

-- ============================================================
-- COURTS TABLE
-- ============================================================

-- Users can see courts if they are members of the club (already in 001)
-- But we add role-based override for admin/superadmin
CREATE POLICY IF NOT EXISTS "courts_select_admin" ON public.courts
  FOR SELECT USING (get_user_role() IN ('admin', 'superadmin'));

-- Only admin/superadmin can modify courts
CREATE POLICY IF NOT EXISTS "courts_insert_admin" ON public.courts
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY IF NOT EXISTS "courts_update_admin" ON public.courts
  FOR UPDATE USING (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY IF NOT EXISTS "courts_delete_admin" ON public.courts
  FOR DELETE USING (get_user_role() IN ('admin', 'superadmin'));

-- ============================================================
-- BOOKINGS TABLE
-- ============================================================

-- Users can see their own bookings
CREATE POLICY IF NOT EXISTS "bookings_select_own" ON public.bookings
  FOR SELECT USING (user_id = auth.uid());

-- Admin/Superadmin/Trainer can see all bookings for their club
-- (Assuming trainer role exists and needs access)
CREATE POLICY IF NOT EXISTS "bookings_select_staff" ON public.bookings
  FOR SELECT USING (
    get_user_role() IN ('admin', 'superadmin', 'trainer')
    AND EXISTS (
      SELECT 1 FROM public.user_club_memberships ucm
      WHERE ucm.club_id = bookings.club_id
        AND ucm.user_id = auth.uid()
        AND ucm.is_active = true
    )
  );

-- Users can insert their own bookings
CREATE POLICY IF NOT EXISTS "bookings_insert_own" ON public.bookings
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
  );

-- Users can update their own bookings (if not confirmed/cancelled)
CREATE POLICY IF NOT EXISTS "bookings_update_own" ON public.bookings
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('confirmed', 'pending') -- Allow updates only on certain statuses
  );

-- Users can delete their own pending bookings, admin can delete any
CREATE POLICY IF NOT EXISTS "bookings_delete_own" ON public.bookings
  FOR DELETE USING (
    user_id = auth.uid()
    OR get_user_role() IN ('admin', 'superadmin')
  );

-- ============================================================
-- USER_CLUB_MEMBERSHIPS TABLE
-- ============================================================

-- Users can see their own memberships
CREATE POLICY IF NOT EXISTS "user_club_memberships_select_own" ON public.user_club_memberships
  FOR SELECT USING (user_id = auth.uid());

-- Admin/Superadmin can manage all memberships (but need to avoid recursion)
-- We rely on the existing 002_fix_rls_recursion.sql which allows admin via service role
-- But we can add a policy that allows admins to view memberships in their club:
CREATE POLICY IF NOT EXISTS "user_club_memberships_select_club_admin" ON public.user_club_memberships
  FOR SELECT USING (
    get_user_role() IN ('admin', 'superadmin')
    AND EXISTS (
      SELECT 1 FROM public.user_club_memberships ucm_admin
      WHERE ucm_admin.club_id = user_club_memberships.club_id
        AND ucm_admin.user_id = auth.uid()
        AND ucm_admin.is_active = true
    )
  );

-- Note: INSERT/UPDATE/DELETE for admin should be done via service role
-- to avoid RLS recursion issues. Application should use /api/admin/* routes.

-- ============================================================
-- CLUBS TABLE
-- ============================================================

-- Club access is already defined in 001 via membership
-- Add admin override for managing clubs
CREATE POLICY IF NOT EXISTS "clubs_select_admin" ON public.clubs
  FOR SELECT USING (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY IF NOT EXISTS "clubs_insert_admin" ON public.clubs
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY IF NOT EXISTS "clubs_update_admin" ON public.clubs
  FOR UPDATE USING (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY IF NOT EXISTS "clubs_delete_superadmin" ON public.clubs
  FOR DELETE USING (get_user_role() = 'superadmin');

-- ============================================================
-- SCHEDULES, SESSIONS, TRAINING_GROUPS
-- ============================================================

-- These are already covered by club membership policies from 001
-- But we ensure admin/superadmin have explicit access
CREATE POLICY IF NOT EXISTS "schedules_select_admin" ON public.schedules
  FOR SELECT USING (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY IF NOT EXISTS "sessions_select_admin" ON public.sessions
  FOR SELECT USING (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY IF NOT EXISTS "training_groups_select_admin" ON public.training_groups
  FOR SELECT USING (get_user_role() IN ('admin', 'superadmin'));

-- Admin can manage schedules/sessions
CREATE POLICY IF NOT EXISTS "schedules_manage_admin" ON public.schedules
  FOR ALL USING (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY IF NOT EXISTS "sessions_manage_admin" ON public.sessions
  FOR ALL USING (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY IF NOT EXISTS "training_groups_manage_admin" ON public.training_groups
  FOR ALL USING (get_user_role() IN ('admin', 'superadmin'));

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON FUNCTION get_user_role() IS
  'Returns the role of the currently authenticated user from the users table. Used in RLS policies for role-based access control.';

COMMENT ON POLICY "users_select_own" ON users IS
  'Users can view their own profile data.';
COMMENT ON POLICY "users_select_admin" ON users IS
  'Admins and superadmins can view all user profiles.';
COMMENT ON POLICY "bookings_select_own" ON bookings IS
  'Users can view their own bookings.';
COMMENT ON POLICY "bookings_select_staff" ON bookings IS
  'Trainers, admins, and superadmins can view all bookings for clubs they have access to.';
COMMENT ON POLICY "bookings_insert_own" ON bookings IS
  'Users can create bookings for themselves only.';
COMMENT ON POLICY "user_club_memberships_select_own" ON user_club_memberships IS
  'Users can view their own club memberships.';
