-- System Settings Table Migration
-- This migration creates the table for managing application-wide and club-specific settings
-- Features: type validation, public/private settings, required settings protection, multi-tenant support

-- ============================================================================
-- TABLE: system_settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('general', 'email', 'notifications', 'security', 'integrations', 'other')),
  key VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('string', 'number', 'boolean', 'json', 'array')),
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT false,
  validation JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  -- Unique key per club (or global if club_id is NULL)
  CONSTRAINT unique_key_per_club UNIQUE NULLS NOT DISTINCT (club_id, key)
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

-- Query by club (tenant isolation)
CREATE INDEX IF NOT EXISTS idx_system_settings_club_id ON system_settings(club_id);

-- Query by category
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- Query by key (fast lookup)
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Query public settings
CREATE INDEX IF NOT EXISTS idx_system_settings_is_public ON system_settings(is_public) 
  WHERE is_public = true;

-- Composite index for club + category queries
CREATE INDEX IF NOT EXISTS idx_system_settings_club_category ON system_settings(club_id, category);

-- Composite index for club + key queries (most common)
CREATE INDEX IF NOT EXISTS idx_system_settings_club_key ON system_settings(club_id, key);

-- GIN index for JSONB validation rules
CREATE INDEX IF NOT EXISTS idx_system_settings_validation ON system_settings USING GIN (validation);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policy 1: Superadmins have full access (cross-tenant)
DROP POLICY IF EXISTS "Superadmins have full access to all system settings" ON system_settings;
CREATE POLICY "Superadmins have full access to all system settings"
  ON system_settings
  FOR ALL
  USING (is_superadmin());

-- Policy 2: Club admins can view all settings in their clubs
DROP POLICY IF EXISTS "Club admins can view settings in their clubs" ON system_settings;
CREATE POLICY "Club admins can view settings in their clubs"
  ON system_settings
  FOR SELECT
  USING (
    club_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = system_settings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 3: Club admins can create settings in their clubs
DROP POLICY IF EXISTS "Club admins can create settings in their clubs" ON system_settings;
CREATE POLICY "Club admins can create settings in their clubs"
  ON system_settings
  FOR INSERT
  WITH CHECK (
    club_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = system_settings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 4: Club admins can update settings in their clubs
DROP POLICY IF EXISTS "Club admins can update settings in their clubs" ON system_settings;
CREATE POLICY "Club admins can update settings in their clubs"
  ON system_settings
  FOR UPDATE
  USING (
    club_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = system_settings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 5: Club admins can delete non-required settings in their clubs
DROP POLICY IF EXISTS "Club admins can delete non-required settings in their clubs" ON system_settings;
CREATE POLICY "Club admins can delete non-required settings in their clubs"
  ON system_settings
  FOR DELETE
  USING (
    club_id IS NOT NULL
    AND is_required = false
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = system_settings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 6: All authenticated users can view public settings
DROP POLICY IF EXISTS "Users can view public settings" ON system_settings;
CREATE POLICY "Users can view public settings"
  ON system_settings
  FOR SELECT
  USING (
    is_public = true
    AND (
      club_id IS NULL
      OR EXISTS (
        SELECT 1 FROM club_members cm
        WHERE cm.club_id = system_settings.club_id
          AND cm.user_id = auth.uid()
          AND cm.is_active = true
      )
    )
  );

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS system_settings_updated_at ON system_settings;
CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();

-- ============================================================================
-- TRIGGER: Prevent deletion of required settings
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_required_setting_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_required = true THEN
    RAISE EXCEPTION 'Cannot delete required system setting: %', OLD.key;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_required_setting_deletion_trigger ON system_settings;
CREATE TRIGGER prevent_required_setting_deletion_trigger
  BEFORE DELETE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_required_setting_deletion();

-- ============================================================================
-- HELPER FUNCTION: Get setting value by key
-- ============================================================================

CREATE OR REPLACE FUNCTION get_setting_value(
  p_key VARCHAR,
  p_club_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT value INTO v_value
  FROM system_settings
  WHERE key = p_key
    AND (club_id = p_club_id OR (club_id IS NULL AND p_club_id IS NULL))
  LIMIT 1;
  
  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Get settings as JSONB object
-- ============================================================================

CREATE OR REPLACE FUNCTION get_settings_as_object(
  p_category VARCHAR DEFAULT NULL,
  p_club_id UUID DEFAULT NULL,
  p_public_only BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_object_agg(
    key,
    CASE
      WHEN type = 'number' THEN to_jsonb(value::numeric)
      WHEN type = 'boolean' THEN to_jsonb(value::boolean)
      WHEN type = 'json' OR type = 'array' THEN value::jsonb
      ELSE to_jsonb(value)
    END
  ) INTO v_result
  FROM system_settings
  WHERE (p_category IS NULL OR category = p_category)
    AND (club_id = p_club_id OR (club_id IS NULL AND p_club_id IS NULL))
    AND (p_public_only = false OR is_public = true);
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE system_settings IS 'Application-wide and club-specific configuration settings with type validation';
COMMENT ON COLUMN system_settings.club_id IS 'Club ID for club-specific settings, NULL for global settings';
COMMENT ON COLUMN system_settings.category IS 'Setting category: general, email, notifications, security, integrations, or other';
COMMENT ON COLUMN system_settings.key IS 'Unique setting key (e.g., club_name, email_provider)';
COMMENT ON COLUMN system_settings.value IS 'Setting value stored as text (type-converted at application layer)';
COMMENT ON COLUMN system_settings.type IS 'Value type for validation and parsing: string, number, boolean, json, or array';
COMMENT ON COLUMN system_settings.is_public IS 'Whether this setting is visible to non-admin users';
COMMENT ON COLUMN system_settings.is_required IS 'Whether this setting is required and cannot be deleted';
COMMENT ON COLUMN system_settings.validation IS 'JSONB validation rules (min, max, pattern, enum)';
COMMENT ON FUNCTION get_setting_value(VARCHAR, UUID) IS 'Get setting value by key for a club or global';
COMMENT ON FUNCTION get_settings_as_object(VARCHAR, UUID, BOOLEAN) IS 'Get settings as JSONB object with type conversion';
