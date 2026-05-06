-- =====================================================
-- Migration: Hourly Rate Management Tables
-- Description: Rate tiers, trainer rates, and rate history
-- Created: 2026-05-06
-- =====================================================

-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- Table 1: Hourly Rate Tiers (Base rates for training types/experience levels)
CREATE TABLE IF NOT EXISTS public.hourly_rate_tiers (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant relationship
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Rate tier information
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_rate DECIMAL(10, 2) NOT NULL,
  training_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience_level VARCHAR(20) NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'professional')),
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT hourly_rate_tiers_base_rate_positive CHECK (base_rate > 0)
);

-- Table 2: Trainer Hourly Rates (Individual trainer rates with validity periods)
CREATE TABLE IF NOT EXISTS public.trainer_hourly_rates (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant relationship
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Trainer relationship
  trainer_id UUID NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  trainer_name VARCHAR(100) NOT NULL,

  -- Rate information
  base_rate DECIMAL(10, 2) NOT NULL,
  override_rate DECIMAL(10, 2),
  effective_rate DECIMAL(10, 2) NOT NULL,

  -- Validity period
  valid_from DATE NOT NULL,
  valid_until DATE,

  -- Metadata
  reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT trainer_hourly_rates_base_rate_positive CHECK (base_rate > 0),
  CONSTRAINT trainer_hourly_rates_override_rate_positive CHECK (override_rate IS NULL OR override_rate > 0),
  CONSTRAINT trainer_hourly_rates_effective_rate_positive CHECK (effective_rate > 0),
  CONSTRAINT trainer_hourly_rates_valid_period CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- Table 3: Rate History (Audit trail for rate changes)
CREATE TABLE IF NOT EXISTS public.rate_history (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant relationship
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Trainer relationship
  trainer_id UUID NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  trainer_name VARCHAR(100) NOT NULL,

  -- Rate change information
  old_rate DECIMAL(10, 2) NOT NULL,
  new_rate DECIMAL(10, 2) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by VARCHAR(100) NOT NULL,
  reason TEXT,

  -- Constraints
  CONSTRAINT rate_history_old_rate_positive CHECK (old_rate > 0),
  CONSTRAINT rate_history_new_rate_positive CHECK (new_rate > 0)
);

-- =====================================================
-- 2. CREATE INDEXES
-- =====================================================

-- Hourly Rate Tiers Indexes
CREATE INDEX idx_hourly_rate_tiers_club_id ON public.hourly_rate_tiers(club_id);
CREATE INDEX idx_hourly_rate_tiers_is_active ON public.hourly_rate_tiers(is_active)
  WHERE is_active = true;
CREATE INDEX idx_hourly_rate_tiers_experience_level ON public.hourly_rate_tiers(experience_level);
CREATE INDEX idx_hourly_rate_tiers_club_active ON public.hourly_rate_tiers(club_id, is_active)
  WHERE is_active = true;

-- Trainer Hourly Rates Indexes
CREATE INDEX idx_trainer_hourly_rates_club_id ON public.trainer_hourly_rates(club_id);
CREATE INDEX idx_trainer_hourly_rates_trainer_id ON public.trainer_hourly_rates(trainer_id);
CREATE INDEX idx_trainer_hourly_rates_valid_from ON public.trainer_hourly_rates(valid_from DESC);
CREATE INDEX idx_trainer_hourly_rates_valid_period ON public.trainer_hourly_rates(trainer_id, valid_from, valid_until);

-- Rate History Indexes
CREATE INDEX idx_rate_history_club_id ON public.rate_history(club_id);
CREATE INDEX idx_rate_history_trainer_id ON public.rate_history(trainer_id);
CREATE INDEX idx_rate_history_changed_at ON public.rate_history(changed_at DESC);

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.hourly_rate_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_hourly_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_history ENABLE ROW LEVEL SECURITY;

-- Hourly Rate Tiers Policies
CREATE POLICY hourly_rate_tiers_superadmin_all
  ON public.hourly_rate_tiers
  FOR ALL
  USING (is_superadmin());

CREATE POLICY hourly_rate_tiers_admin_manage
  ON public.hourly_rate_tiers
  FOR ALL
  USING (user_is_admin_of_club(club_id));

CREATE POLICY hourly_rate_tiers_trainer_view
  ON public.hourly_rate_tiers
  FOR SELECT
  USING (user_is_trainer_of_club(club_id));

CREATE POLICY hourly_rate_tiers_member_view_active
  ON public.hourly_rate_tiers
  FOR SELECT
  USING (user_is_member_of_club(club_id) AND is_active = true);

-- Trainer Hourly Rates Policies
CREATE POLICY trainer_hourly_rates_superadmin_all
  ON public.trainer_hourly_rates
  FOR ALL
  USING (is_superadmin());

CREATE POLICY trainer_hourly_rates_admin_manage
  ON public.trainer_hourly_rates
  FOR ALL
  USING (user_is_admin_of_club(club_id));

CREATE POLICY trainer_hourly_rates_trainer_view_own
  ON public.trainer_hourly_rates
  FOR SELECT
  USING (trainer_id = auth.uid() OR user_is_trainer_of_club(club_id));

-- Rate History Policies
CREATE POLICY rate_history_superadmin_all
  ON public.rate_history
  FOR ALL
  USING (is_superadmin());

CREATE POLICY rate_history_admin_view
  ON public.rate_history
  FOR SELECT
  USING (user_is_admin_of_club(club_id));

CREATE POLICY rate_history_system_insert
  ON public.rate_history
  FOR INSERT
  WITH CHECK (true); -- System inserts only

-- =====================================================
-- 4. TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE TRIGGER set_hourly_rate_tiers_updated_at
  BEFORE UPDATE ON public.hourly_rate_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_trainer_hourly_rates_updated_at
  BEFORE UPDATE ON public.trainer_hourly_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function: Get current rate for trainer
CREATE OR REPLACE FUNCTION get_current_trainer_rate(p_trainer_id UUID)
RETURNS DECIMAL(10, 2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT effective_rate
  FROM public.trainer_hourly_rates
  WHERE trainer_id = p_trainer_id
    AND valid_from <= CURRENT_DATE
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
  ORDER BY valid_from DESC
  LIMIT 1;
$$;

-- Function: Get active rate tiers for club
CREATE OR REPLACE FUNCTION get_active_rate_tiers(p_club_id UUID)
RETURNS SETOF public.hourly_rate_tiers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.hourly_rate_tiers
  WHERE club_id = p_club_id
    AND is_active = true
  ORDER BY experience_level, name;
$$;

-- =====================================================
-- 6. COMMENTS
-- =====================================================

COMMENT ON TABLE public.hourly_rate_tiers IS 'Base hourly rate tiers for different training types and experience levels';
COMMENT ON TABLE public.trainer_hourly_rates IS 'Individual trainer hourly rates with validity periods and override capability';
COMMENT ON TABLE public.rate_history IS 'Audit trail for all trainer rate changes';

COMMENT ON COLUMN public.hourly_rate_tiers.experience_level IS 'beginner, intermediate, advanced, or professional';
COMMENT ON COLUMN public.hourly_rate_tiers.training_types IS 'JSONB array of applicable training types';
COMMENT ON COLUMN public.trainer_hourly_rates.effective_rate IS 'Calculated rate (override_rate if set, otherwise base_rate)';
COMMENT ON COLUMN public.trainer_hourly_rates.valid_from IS 'Date from which this rate is valid';
COMMENT ON COLUMN public.trainer_hourly_rates.valid_until IS 'Date until which this rate is valid (NULL = indefinite)';

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hourly_rate_tiers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_hourly_rates TO authenticated;
GRANT SELECT, INSERT ON public.rate_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_trainer_rate TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_rate_tiers TO authenticated;
