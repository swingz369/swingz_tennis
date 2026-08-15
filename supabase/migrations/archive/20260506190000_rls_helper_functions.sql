-- Migration: Add SECURITY DEFINER helper functions for RLS
-- Prevents RLS recursion and improves query performance
-- Pattern from TSOWAPP (INTEGRATION_ROADMAP.md Phase 1.1)

-- ============================================
-- 1. Create SECURITY DEFINER Helper Functions
-- ============================================

-- Helper: Check if user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER  -- Bypasses RLS
STABLE
SET row_security = off  -- Prevents recursion
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
      AND role = 'superadmin'
      AND is_active = true
  )
$$;

-- Helper: Check if user is admin of specific club
CREATE OR REPLACE FUNCTION is_club_admin(p_club_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND role IN ('admin', 'superadmin')
      AND is_active = true
  )
$$;

-- Helper: Check if user is member of specific club (any role)
CREATE OR REPLACE FUNCTION is_club_member(p_club_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND is_active = true
  )
$$;

-- Helper: Get array of club IDs user belongs to
CREATE OR REPLACE FUNCTION get_user_club_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET row_security = off
AS $$
  SELECT ARRAY_AGG(club_id)
  FROM user_club_memberships
  WHERE user_id = auth.uid()
    AND is_active = true
$$;

-- Helper: Check if user is trainer in specific club
CREATE OR REPLACE FUNCTION is_club_trainer(p_club_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND role IN ('trainer', 'admin', 'superadmin')
      AND is_active = true
  )
$$;

-- ============================================
-- 2. Update RLS Policies to Use Helper Functions
-- ============================================

-- CLUBS table policies
DROP POLICY IF EXISTS "clubs_select" ON clubs;
CREATE POLICY "clubs_select" ON clubs
  FOR SELECT
  USING (
    is_superadmin() OR 
    id = ANY(get_user_club_ids())
  );

DROP POLICY IF EXISTS "clubs_insert" ON clubs;
CREATE POLICY "clubs_insert" ON clubs
  FOR INSERT
  WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS "clubs_update" ON clubs;
CREATE POLICY "clubs_update" ON clubs
  FOR UPDATE
  USING (
    is_superadmin() OR 
    is_club_admin(id)
  );

DROP POLICY IF EXISTS "clubs_delete" ON clubs;
CREATE POLICY "clubs_delete" ON clubs
  FOR DELETE
  USING (is_superadmin());

-- COURTS table policies
DROP POLICY IF EXISTS "courts_select" ON courts;
CREATE POLICY "courts_select" ON courts
  FOR SELECT
  USING (
    is_superadmin() OR 
    club_id = ANY(get_user_club_ids())
  );

DROP POLICY IF EXISTS "courts_insert" ON courts;
CREATE POLICY "courts_insert" ON courts
  FOR INSERT
  WITH CHECK (
    is_superadmin() OR 
    is_club_admin(club_id)
  );

DROP POLICY IF EXISTS "courts_update" ON courts;
CREATE POLICY "courts_update" ON courts
  FOR UPDATE
  USING (
    is_superadmin() OR 
    is_club_admin(club_id)
  );

DROP POLICY IF EXISTS "courts_delete" ON courts;
CREATE POLICY "courts_delete" ON courts
  FOR DELETE
  USING (
    is_superadmin() OR 
    is_club_admin(club_id)
  );

-- SESSIONS table policies
DROP POLICY IF EXISTS "sessions_select" ON sessions;
CREATE POLICY "sessions_select" ON sessions
  FOR SELECT
  USING (
    is_superadmin() OR 
    club_id = ANY(get_user_club_ids())
  );

DROP POLICY IF EXISTS "sessions_insert" ON sessions;
CREATE POLICY "sessions_insert" ON sessions
  FOR INSERT
  WITH CHECK (
    is_superadmin() OR 
    is_club_trainer(club_id)
  );

DROP POLICY IF EXISTS "sessions_update" ON sessions;
CREATE POLICY "sessions_update" ON sessions
  FOR UPDATE
  USING (
    is_superadmin() OR 
    is_club_trainer(club_id)
  );

DROP POLICY IF EXISTS "sessions_delete" ON sessions;
CREATE POLICY "sessions_delete" ON sessions
  FOR DELETE
  USING (
    is_superadmin() OR 
    is_club_admin(club_id)
  );

-- BOOKINGS table policies
DROP POLICY IF EXISTS "bookings_select" ON bookings;
CREATE POLICY "bookings_select" ON bookings
  FOR SELECT
  USING (
    is_superadmin() OR 
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = bookings.session_id
        AND sessions.club_id = ANY(get_user_club_ids())
    ) OR
    member_id = auth.uid()
  );

DROP POLICY IF EXISTS "bookings_insert" ON bookings;
CREATE POLICY "bookings_insert" ON bookings
  FOR INSERT
  WITH CHECK (
    is_superadmin() OR 
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = bookings.session_id
        AND is_club_trainer(sessions.club_id)
    ) OR
    member_id = auth.uid()
  );

DROP POLICY IF EXISTS "bookings_update" ON bookings;
CREATE POLICY "bookings_update" ON bookings
  FOR UPDATE
  USING (
    is_superadmin() OR 
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = bookings.session_id
        AND is_club_trainer(sessions.club_id)
    )
  );

DROP POLICY IF EXISTS "bookings_delete" ON bookings;
CREATE POLICY "bookings_delete" ON bookings
  FOR DELETE
  USING (
    is_superadmin() OR 
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = bookings.session_id
        AND is_club_admin(sessions.club_id)
    )
  );

-- INVOICES table policies
DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT
  USING (
    is_superadmin() OR 
    is_club_admin(club_id) OR
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT
  WITH CHECK (
    is_superadmin() OR 
    is_club_admin(club_id)
  );

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE
  USING (
    is_superadmin() OR 
    is_club_admin(club_id)
  );

DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE
  USING (
    is_superadmin() OR 
    is_club_admin(club_id)
  );

-- PAYMENTS table policies
DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments
  FOR SELECT
  USING (
    is_superadmin() OR 
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = payments.invoice_id
        AND (is_club_admin(invoices.club_id) OR invoices.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments
  FOR INSERT
  WITH CHECK (
    is_superadmin() OR 
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = payments.invoice_id
        AND is_club_admin(invoices.club_id)
    )
  );

-- USER_CLUB_MEMBERSHIPS table policies (improved version)
DROP POLICY IF EXISTS "user_club_memberships_select" ON user_club_memberships;
CREATE POLICY "user_club_memberships_select" ON user_club_memberships
  FOR SELECT
  USING (
    is_superadmin() OR 
    is_club_admin(club_id) OR
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "user_club_memberships_insert" ON user_club_memberships;
CREATE POLICY "user_club_memberships_insert" ON user_club_memberships
  FOR INSERT
  WITH CHECK (
    is_superadmin() OR 
    is_club_admin(club_id)
  );

DROP POLICY IF EXISTS "user_club_memberships_update" ON user_club_memberships;
CREATE POLICY "user_club_memberships_update" ON user_club_memberships
  FOR UPDATE
  USING (
    is_superadmin() OR 
    is_club_admin(club_id)
  );

DROP POLICY IF EXISTS "user_club_memberships_delete" ON user_club_memberships;
CREATE POLICY "user_club_memberships_delete" ON user_club_memberships
  FOR DELETE
  USING (
    is_superadmin() OR 
    is_club_admin(club_id)
  );

-- ============================================
-- 3. Add Comments for Documentation
-- ============================================

COMMENT ON FUNCTION is_superadmin() IS 
'Returns true if current user has superadmin role. Uses SECURITY DEFINER to bypass RLS and prevent recursion.';

COMMENT ON FUNCTION is_club_admin(UUID) IS 
'Returns true if current user is admin or superadmin of specified club. Uses SECURITY DEFINER to bypass RLS.';

COMMENT ON FUNCTION is_club_member(UUID) IS 
'Returns true if current user has any active membership in specified club. Uses SECURITY DEFINER to bypass RLS.';

COMMENT ON FUNCTION get_user_club_ids() IS 
'Returns array of club IDs the current user belongs to. Uses SECURITY DEFINER to bypass RLS.';

COMMENT ON FUNCTION is_club_trainer(UUID) IS 
'Returns true if current user is trainer, admin, or superadmin of specified club. Uses SECURITY DEFINER to bypass RLS.';
