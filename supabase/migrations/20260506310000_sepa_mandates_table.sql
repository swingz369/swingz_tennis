-- =====================================================
-- Migration: SEPA Mandate Management
-- Description: SEPA direct debit mandates for member payments
-- Created: 2026-05-06
-- =====================================================

-- =====================================================
-- 1. CREATE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sepa_mandates (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant relationship
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Member relationship
  member_id UUID NOT NULL,

  -- Account information
  account_holder VARCHAR(200) NOT NULL,
  iban VARCHAR(34) NOT NULL,
  bic VARCHAR(11) NOT NULL,
  bank_name VARCHAR(200) NOT NULL,

  -- Address (JSONB for flexibility)
  address JSONB NOT NULL,

  -- Mandate information
  mandate_reference VARCHAR(50) NOT NULL UNIQUE,
  creditor_id VARCHAR(35) NOT NULL DEFAULT 'DE98ZZZ00000000000',
  signature_date DATE NOT NULL,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT sepa_mandates_iban_length CHECK (LENGTH(iban) >= 15 AND LENGTH(iban) <= 34),
  CONSTRAINT sepa_mandates_bic_length CHECK (LENGTH(bic) >= 8 AND LENGTH(bic) <= 11),
  CONSTRAINT sepa_mandates_revoked_consistency CHECK (
    (is_active = false AND revoked_at IS NOT NULL) OR (is_active = true AND revoked_at IS NULL)
  )
);

-- =====================================================
-- 2. CREATE INDEXES
-- =====================================================

CREATE INDEX idx_sepa_mandates_club_id ON public.sepa_mandates(club_id);
CREATE INDEX idx_sepa_mandates_member_id ON public.sepa_mandates(member_id);
CREATE INDEX idx_sepa_mandates_is_active ON public.sepa_mandates(is_active) WHERE is_active = true;
CREATE INDEX idx_sepa_mandates_member_active ON public.sepa_mandates(member_id, is_active) WHERE is_active = true;
CREATE UNIQUE INDEX idx_sepa_mandates_mandate_reference ON public.sepa_mandates(mandate_reference);

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.sepa_mandates ENABLE ROW LEVEL SECURITY;

-- Policy 1: Superadmins have full access
CREATE POLICY sepa_mandates_superadmin_all
  ON public.sepa_mandates
  FOR ALL
  USING (is_superadmin());

-- Policy 2: Club admins can manage their club's mandates
CREATE POLICY sepa_mandates_admin_manage
  ON public.sepa_mandates
  FOR ALL
  USING (user_is_admin_of_club(club_id));

-- Policy 3: Members can view their own mandates
CREATE POLICY sepa_mandates_member_view_own
  ON public.sepa_mandates
  FOR SELECT
  USING (member_id = auth.uid());

-- Policy 4: Members can create their own mandates
CREATE POLICY sepa_mandates_member_create_own
  ON public.sepa_mandates
  FOR INSERT
  WITH CHECK (member_id = auth.uid());

-- =====================================================
-- 4. HELPER FUNCTIONS
-- =====================================================

-- Function: Get active mandate for member
CREATE OR REPLACE FUNCTION get_active_sepa_mandate(p_member_id UUID)
RETURNS public.sepa_mandates
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.sepa_mandates
  WHERE member_id = p_member_id
    AND is_active = true
  LIMIT 1;
$$;

-- Function: Check if member has active mandate
CREATE OR REPLACE FUNCTION has_active_sepa_mandate(p_member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.sepa_mandates
    WHERE member_id = p_member_id
      AND is_active = true
  );
$$;

-- =====================================================
-- 5. COMMENTS
-- =====================================================

COMMENT ON TABLE public.sepa_mandates IS 'SEPA direct debit mandates for automated member payments';
COMMENT ON COLUMN public.sepa_mandates.mandate_reference IS 'Unique mandate reference number (e.g., M-1234567890)';
COMMENT ON COLUMN public.sepa_mandates.creditor_id IS 'Club creditor ID for SEPA transactions';
COMMENT ON COLUMN public.sepa_mandates.address IS 'JSONB object containing street, houseNumber, postalCode, city';
COMMENT ON COLUMN public.sepa_mandates.is_active IS 'Whether the mandate is currently active';
COMMENT ON COLUMN public.sepa_mandates.revoked_at IS 'Timestamp when the mandate was revoked (NULL if active)';

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON public.sepa_mandates TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_sepa_mandate TO authenticated;
GRANT EXECUTE ON FUNCTION has_active_sepa_mandate TO authenticated;
