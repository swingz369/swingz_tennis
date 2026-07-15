-- Fee Configurations Table Migration
-- This migration creates the table for managing club pricing/fee configurations
-- Features: version history, date-based validity, conditional pricing, multi-tenant isolation

-- ============================================================================
-- TABLE: fee_configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS fee_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('membership', 'training', 'court', 'other')),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly', 'one_time')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from DATE,
  valid_until DATE,
  conditions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_date_range CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from <= valid_until),
  CONSTRAINT valid_currency_code CHECK (length(currency) = 3)
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

-- Query by club (tenant isolation)
CREATE INDEX IF NOT EXISTS idx_fee_configurations_club_id ON fee_configurations(club_id);

-- Query by type (membership, training, court, other)
CREATE INDEX IF NOT EXISTS idx_fee_configurations_type ON fee_configurations(type);

-- Query active configurations
CREATE INDEX IF NOT EXISTS idx_fee_configurations_is_active ON fee_configurations(is_active) 
  WHERE is_active = true;

-- Query by billing cycle
CREATE INDEX IF NOT EXISTS idx_fee_configurations_billing_cycle ON fee_configurations(billing_cycle);

-- Query by validity dates (find currently valid configurations)
CREATE INDEX IF NOT EXISTS idx_fee_configurations_validity ON fee_configurations(valid_from, valid_until);

-- Composite index for active configs by club
CREATE INDEX IF NOT EXISTS idx_fee_configurations_club_active ON fee_configurations(club_id, is_active) 
  WHERE is_active = true;

-- Composite index for club + type queries
CREATE INDEX IF NOT EXISTS idx_fee_configurations_club_type ON fee_configurations(club_id, type);

-- GIN index for JSONB conditions (fast filtering by member type, age, etc.)
CREATE INDEX IF NOT EXISTS idx_fee_configurations_conditions ON fee_configurations USING GIN (conditions);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE fee_configurations ENABLE ROW LEVEL SECURITY;

-- Policy 1: Superadmins have full access (cross-tenant)
DROP POLICY IF EXISTS "Superadmins have full access to all fee configurations" ON fee_configurations;
CREATE POLICY "Superadmins have full access to all fee configurations"
  ON fee_configurations
  FOR ALL
  USING (is_superadmin());

-- Policy 2: Club admins can view fee configurations in their clubs
DROP POLICY IF EXISTS "Club admins can view fee configurations in their clubs" ON fee_configurations;
CREATE POLICY "Club admins can view fee configurations in their clubs"
  ON fee_configurations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = fee_configurations.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 3: Club admins can create fee configurations in their clubs
DROP POLICY IF EXISTS "Club admins can create fee configurations in their clubs" ON fee_configurations;
CREATE POLICY "Club admins can create fee configurations in their clubs"
  ON fee_configurations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = fee_configurations.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 4: Club admins can update fee configurations in their clubs
DROP POLICY IF EXISTS "Club admins can update fee configurations in their clubs" ON fee_configurations;
CREATE POLICY "Club admins can update fee configurations in their clubs"
  ON fee_configurations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = fee_configurations.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 5: Club admins can delete fee configurations in their clubs
DROP POLICY IF EXISTS "Club admins can delete fee configurations in their clubs" ON fee_configurations;
CREATE POLICY "Club admins can delete fee configurations in their clubs"
  ON fee_configurations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = fee_configurations.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 6: Trainers can view fee configurations in their clubs (read-only)
DROP POLICY IF EXISTS "Trainers can view fee configurations in their clubs" ON fee_configurations;
CREATE POLICY "Trainers can view fee configurations in their clubs"
  ON fee_configurations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = fee_configurations.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'trainer'
        AND cm.is_active = true
    )
  );

-- Policy 7: Members can view active fee configurations in their clubs (read-only)
DROP POLICY IF EXISTS "Members can view active fee configurations in their clubs" ON fee_configurations;
CREATE POLICY "Members can view active fee configurations in their clubs"
  ON fee_configurations
  FOR SELECT
  USING (
    is_active = true
    AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = fee_configurations.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'member'
        AND cm.is_active = true
    )
  );

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_fee_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fee_configurations_updated_at ON fee_configurations;
CREATE TRIGGER fee_configurations_updated_at
  BEFORE UPDATE ON fee_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_fee_configurations_updated_at();

-- ============================================================================
-- HELPER FUNCTION: Get valid fee configurations for a date
-- ============================================================================

CREATE OR REPLACE FUNCTION get_valid_fee_configurations(
  p_club_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS SETOF fee_configurations AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM fee_configurations
  WHERE club_id = p_club_id
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= p_date)
    AND (valid_until IS NULL OR valid_until >= p_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Calculate applicable fees for member
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_member_fees(
  p_club_id UUID,
  p_member_age INTEGER,
  p_member_type VARCHAR,
  p_training_group VARCHAR DEFAULT NULL
)
RETURNS SETOF fee_configurations AS $$
BEGIN
  RETURN QUERY
  SELECT fc.*
  FROM fee_configurations fc
  WHERE fc.club_id = p_club_id
    AND fc.is_active = true
    AND (fc.valid_from IS NULL OR fc.valid_from <= CURRENT_DATE)
    AND (fc.valid_until IS NULL OR fc.valid_until >= CURRENT_DATE)
    -- Check conditions
    AND (
      fc.conditions = '{}'::jsonb OR (
        (fc.conditions->>'minAge' IS NULL OR (fc.conditions->>'minAge')::INTEGER <= p_member_age) AND
        (fc.conditions->>'maxAge' IS NULL OR (fc.conditions->>'maxAge')::INTEGER >= p_member_age) AND
        (fc.conditions->'memberType' IS NULL OR fc.conditions->'memberType' @> to_jsonb(p_member_type)) AND
        (p_training_group IS NULL OR fc.conditions->'trainingGroup' IS NULL OR fc.conditions->'trainingGroup' @> to_jsonb(p_training_group))
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE fee_configurations IS 'Club pricing/fee configurations with version history and conditional rules';
COMMENT ON COLUMN fee_configurations.type IS 'Fee type: membership, training, court, or other';
COMMENT ON COLUMN fee_configurations.billing_cycle IS 'Billing frequency: monthly, quarterly, yearly, or one_time';
COMMENT ON COLUMN fee_configurations.conditions IS 'JSONB rules for conditional pricing (age, member type, training group)';
COMMENT ON COLUMN fee_configurations.valid_from IS 'Start date for this fee configuration';
COMMENT ON COLUMN fee_configurations.valid_until IS 'End date for this fee configuration (NULL = no expiry)';
COMMENT ON FUNCTION get_valid_fee_configurations(UUID, DATE) IS 'Get all valid fee configurations for a club on a specific date';
COMMENT ON FUNCTION calculate_member_fees(UUID, INTEGER, VARCHAR, VARCHAR) IS 'Calculate applicable fees for a member based on conditions';
