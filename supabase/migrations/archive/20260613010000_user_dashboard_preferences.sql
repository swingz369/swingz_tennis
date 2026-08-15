-- User Dashboard Preferences — customizable admin dashboard layouts
-- Each admin/superadmin can configure which widgets appear and in what order.

CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  dashboard_type VARCHAR(20) NOT NULL, -- 'superadmin' | 'club'
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE, -- NULL for superadmin dashboard
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One layout per user + dashboard type + club
  CONSTRAINT user_dashboard_prefs_unique UNIQUE (user_id, dashboard_type, club_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dashboard_prefs_user ON user_dashboard_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_prefs_type ON user_dashboard_preferences(dashboard_type);
CREATE INDEX IF NOT EXISTS idx_dashboard_prefs_club ON user_dashboard_preferences(club_id);

-- RLS: users can only see/edit their own preferences
ALTER TABLE user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own dashboard preferences" ON user_dashboard_preferences;
CREATE POLICY "Users can view own dashboard preferences"
  ON user_dashboard_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own dashboard preferences" ON user_dashboard_preferences;
CREATE POLICY "Users can insert own dashboard preferences"
  ON user_dashboard_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own dashboard preferences" ON user_dashboard_preferences;
CREATE POLICY "Users can update own dashboard preferences"
  ON user_dashboard_preferences FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own dashboard preferences" ON user_dashboard_preferences;
CREATE POLICY "Users can delete own dashboard preferences"
  ON user_dashboard_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_dashboard_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_dashboard_preferences_updated_at ON user_dashboard_preferences;
CREATE TRIGGER trigger_dashboard_preferences_updated_at
  BEFORE UPDATE ON user_dashboard_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_dashboard_preferences_updated_at();
