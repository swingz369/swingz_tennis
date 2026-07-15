-- =====================================================
-- Migration: Trainer Profiles Table
-- Description: Comprehensive trainer profile management with qualifications,
--              specializations, and emergency contacts
-- Created: 2026-05-06
-- =====================================================

-- =====================================================
-- 1. CREATE TABLE IF NOT EXISTS -- =====================================================

CREATE TABLE IF NOT EXISTS public.trainer_profiles (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant relationship
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- User relationship (links to auth.users)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  date_of_birth DATE NOT NULL,
  bio TEXT,
  profile_image_url TEXT,

  -- Complex JSONB fields
  qualifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  specializations JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience JSONB NOT NULL DEFAULT '{"years": 0, "previousClubs": [], "achievements": []}'::jsonb,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated')),

  -- Pricing
  hourly_rate DECIMAL(10, 2),

  -- Availability (JSONB for flexible day-of-week structure)
  availability JSONB NOT NULL DEFAULT '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb,

  -- Preferred time slots (array of time ranges)
  preferred_time_slots JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Languages spoken
  languages JSONB NOT NULL DEFAULT '["Deutsch"]'::jsonb,

  -- Emergency contact
  emergency_contact JSONB NOT NULL DEFAULT '{"name": "", "phone": "", "relationship": ""}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT trainer_profiles_user_club_unique UNIQUE (user_id, club_id),
  CONSTRAINT trainer_profiles_email_club_unique UNIQUE (email, club_id),
  CONSTRAINT trainer_profiles_phone_valid CHECK (LENGTH(phone) >= 5),
  CONSTRAINT trainer_profiles_hourly_rate_positive CHECK (hourly_rate IS NULL OR hourly_rate > 0)
);

-- =====================================================
-- 2. CREATE INDEXES
-- =====================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_club_id ON public.trainer_profiles(club_id);
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_user_id ON public.trainer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_status ON public.trainer_profiles(status);
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_email ON public.trainer_profiles(email);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_club_status ON public.trainer_profiles(club_id, status)
  WHERE status = 'active';

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_first_name ON public.trainer_profiles USING gin(first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_last_name ON public.trainer_profiles USING gin(last_name gin_trgm_ops);

-- Timestamp indexes
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_created_at ON public.trainer_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_updated_at ON public.trainer_profiles(updated_at DESC);

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Superadmins have full access to all trainer profiles
DROP POLICY IF EXISTS trainer_profiles_superadmin_all ON public.trainer_profiles;
CREATE POLICY trainer_profiles_superadmin_all
  ON public.trainer_profiles
  FOR ALL
  USING (is_superadmin());

-- Policy 2: Club admins can manage their club's trainer profiles
DROP POLICY IF EXISTS trainer_profiles_admin_manage ON public.trainer_profiles;
CREATE POLICY trainer_profiles_admin_manage
  ON public.trainer_profiles
  FOR ALL
  USING (user_is_admin_of_club(club_id));

-- Policy 3: Trainers can view their club's trainer profiles
DROP POLICY IF EXISTS trainer_profiles_trainer_view ON public.trainer_profiles;
CREATE POLICY trainer_profiles_trainer_view
  ON public.trainer_profiles
  FOR SELECT
  USING (user_is_trainer_of_club(club_id));

-- Policy 4: Trainers can update their own profile
DROP POLICY IF EXISTS trainer_profiles_trainer_update_own ON public.trainer_profiles;
CREATE POLICY trainer_profiles_trainer_update_own
  ON public.trainer_profiles
  FOR UPDATE
  USING (user_id = auth.uid() AND user_is_trainer_of_club(club_id));

-- Policy 5: Members can view their club's active trainer profiles
DROP POLICY IF EXISTS trainer_profiles_member_view_active ON public.trainer_profiles;
CREATE POLICY trainer_profiles_member_view_active
  ON public.trainer_profiles
  FOR SELECT
  USING (
    user_is_member_of_club(club_id)
    AND status = 'active'
  );

-- =====================================================
-- 4. TRIGGERS
-- =====================================================

-- Trigger: Update updated_at timestamp
DROP TRIGGER IF EXISTS set_trainer_profiles_updated_at ON public.trainer_profiles;
CREATE TRIGGER set_trainer_profiles_updated_at
  BEFORE UPDATE ON public.trainer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 5. COMMENTS
-- =====================================================

COMMENT ON TABLE public.trainer_profiles IS 'Comprehensive trainer profile information including qualifications, specializations, availability, and emergency contacts';

COMMENT ON COLUMN public.trainer_profiles.id IS 'Unique identifier for the trainer profile';
COMMENT ON COLUMN public.trainer_profiles.club_id IS 'Club this trainer profile belongs to (multi-tenant isolation)';
COMMENT ON COLUMN public.trainer_profiles.user_id IS 'Reference to auth.users - links profile to user account';
COMMENT ON COLUMN public.trainer_profiles.qualifications IS 'JSONB array of trainer qualifications with verification status';
COMMENT ON COLUMN public.trainer_profiles.specializations IS 'JSONB array of training specializations (e.g., beginner, advanced)';
COMMENT ON COLUMN public.trainer_profiles.experience IS 'JSONB object containing years of experience, previous clubs, and achievements';
COMMENT ON COLUMN public.trainer_profiles.status IS 'Current status: active, inactive, on_leave, terminated';
COMMENT ON COLUMN public.trainer_profiles.hourly_rate IS 'Hourly rate for training sessions (optional)';
COMMENT ON COLUMN public.trainer_profiles.availability IS 'JSONB object with day-of-week availability (monday through sunday)';
COMMENT ON COLUMN public.trainer_profiles.preferred_time_slots IS 'JSONB array of preferred time ranges for scheduling';
COMMENT ON COLUMN public.trainer_profiles.languages IS 'JSONB array of languages spoken by the trainer';
COMMENT ON COLUMN public.trainer_profiles.emergency_contact IS 'JSONB object with emergency contact information (name, phone, relationship)';

-- =====================================================
-- 6. VALIDATION FUNCTIONS
-- =====================================================

-- Function: Validate trainer profile status transitions
CREATE OR REPLACE FUNCTION validate_trainer_profile_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow all transitions for now
  -- Future: Add business logic for status transition rules
  -- e.g., terminated trainers cannot become active without approval
  
  RETURN NEW;
END;
$$;

-- Trigger: Validate status transitions
DROP TRIGGER IF EXISTS validate_trainer_profile_status ON public.trainer_profiles;
CREATE TRIGGER validate_trainer_profile_status
  BEFORE UPDATE OF status ON public.trainer_profiles
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION validate_trainer_profile_status_transition();

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Function: Get active trainers for a club
CREATE OR REPLACE FUNCTION get_active_trainers(p_club_id UUID)
RETURNS SETOF public.trainer_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.trainer_profiles
  WHERE club_id = p_club_id
    AND status = 'active'
  ORDER BY last_name, first_name;
$$;

-- Function: Get trainer's full name
CREATE OR REPLACE FUNCTION get_trainer_full_name(p_trainer_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT first_name || ' ' || last_name
  FROM public.trainer_profiles
  WHERE id = p_trainer_id;
$$;

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_profiles TO authenticated;
GRANT SELECT ON public.trainer_profiles TO anon;
GRANT EXECUTE ON FUNCTION get_active_trainers TO authenticated;
GRANT EXECUTE ON FUNCTION get_trainer_full_name TO authenticated;
