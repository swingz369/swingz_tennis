-- Payment Settings Table Migration
-- This migration creates the table for managing payment gateway configurations
-- Features: multi-gateway support, default settings, fee calculation, multi-tenant isolation

-- ============================================================================
-- TABLE: payment_settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  gateway VARCHAR(20) NOT NULL CHECK (gateway IN ('stripe', 'paypal', 'sepa', 'cash', 'other')),
  gateway_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  supported_currencies TEXT[] NOT NULL,
  supported_methods TEXT[] NOT NULL,
  min_amount NUMERIC(10, 2) CHECK (min_amount >= 0),
  max_amount NUMERIC(10, 2) CHECK (max_amount >= 0),
  fees JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_amount_range CHECK (min_amount IS NULL OR max_amount IS NULL OR min_amount <= max_amount),
  CONSTRAINT valid_currencies CHECK (array_length(supported_currencies, 1) > 0),
  CONSTRAINT valid_methods CHECK (array_length(supported_methods, 1) > 0),
  -- Only one default per club
  CONSTRAINT unique_default_per_club UNIQUE NULLS NOT DISTINCT (club_id, is_default) 
    DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

-- Query by club (tenant isolation)
CREATE INDEX idx_payment_settings_club_id ON payment_settings(club_id);

-- Query by gateway type
CREATE INDEX idx_payment_settings_gateway ON payment_settings(gateway);

-- Query active settings
CREATE INDEX idx_payment_settings_is_active ON payment_settings(is_active) 
  WHERE is_active = true;

-- Query default settings per club (fast lookup)
CREATE INDEX idx_payment_settings_default ON payment_settings(club_id, is_default) 
  WHERE is_default = true;

-- Composite index for active settings by club
CREATE INDEX idx_payment_settings_club_active ON payment_settings(club_id, is_active) 
  WHERE is_active = true;

-- GIN index for JSONB config (fast filtering by API keys, merchant IDs, etc.)
CREATE INDEX idx_payment_settings_config ON payment_settings USING GIN (config);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

-- Policy 1: Superadmins have full access (cross-tenant)
CREATE POLICY "Superadmins have full access to all payment settings"
  ON payment_settings
  FOR ALL
  USING (is_superadmin());

-- Policy 2: Club admins can view payment settings in their clubs
CREATE POLICY "Club admins can view payment settings in their clubs"
  ON payment_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = payment_settings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 3: Club admins can create payment settings in their clubs
CREATE POLICY "Club admins can create payment settings in their clubs"
  ON payment_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = payment_settings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 4: Club admins can update payment settings in their clubs
CREATE POLICY "Club admins can update payment settings in their clubs"
  ON payment_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = payment_settings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 5: Club admins can delete payment settings in their clubs
CREATE POLICY "Club admins can delete payment settings in their clubs"
  ON payment_settings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = payment_settings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_payment_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_settings_updated_at
  BEFORE UPDATE ON payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_settings_updated_at();

-- ============================================================================
-- TRIGGER: Ensure only one default per club
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_single_default_payment_setting()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting new default to true, unset all other defaults for this club
  IF NEW.is_default = true THEN
    UPDATE payment_settings
    SET is_default = false
    WHERE club_id = NEW.club_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_payment_setting_trigger
  BEFORE INSERT OR UPDATE OF is_default ON payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_payment_setting();

-- ============================================================================
-- HELPER FUNCTION: Calculate payment fee
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_payment_fee(
  p_payment_settings_id UUID,
  p_amount NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_fees JSONB;
  v_fixed_fee NUMERIC;
  v_percentage_fee NUMERIC;
  v_total_fee NUMERIC;
BEGIN
  -- Get fees from payment settings
  SELECT fees INTO v_fees
  FROM payment_settings
  WHERE id = p_payment_settings_id;
  
  IF v_fees IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate fixed fee
  v_fixed_fee := COALESCE((v_fees->>'fixed')::NUMERIC, 0);
  
  -- Calculate percentage fee
  v_percentage_fee := COALESCE((v_fees->>'percentage')::NUMERIC, 0);
  v_percentage_fee := p_amount * (v_percentage_fee / 100);
  
  -- Total fee
  v_total_fee := v_fixed_fee + v_percentage_fee;
  
  RETURN ROUND(v_total_fee, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE payment_settings IS 'Payment gateway configurations with fee calculation and default settings';
COMMENT ON COLUMN payment_settings.gateway IS 'Payment gateway type: stripe, paypal, sepa, cash, or other';
COMMENT ON COLUMN payment_settings.is_default IS 'Whether this is the default payment gateway for the club';
COMMENT ON COLUMN payment_settings.config IS 'JSONB configuration (API keys, merchant IDs, webhook URLs)';
COMMENT ON COLUMN payment_settings.supported_currencies IS 'Array of supported currency codes (e.g., EUR, USD)';
COMMENT ON COLUMN payment_settings.supported_methods IS 'Array of supported payment methods (e.g., card, sepa_debit, paypal)';
COMMENT ON COLUMN payment_settings.fees IS 'JSONB fee structure with fixed and percentage components';
COMMENT ON FUNCTION calculate_payment_fee(UUID, NUMERIC) IS 'Calculate total payment processing fee for a given amount';
