-- Migration: member_schedule_preferences
-- General (non-season-specific) member schedule preferences
-- Complements the season-specific user_training_preferences table

CREATE TABLE IF NOT EXISTS member_schedule_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

  -- Preference flags
  preferred_level VARCHAR(20),           -- beginner, intermediate, advanced
  preferred_age_group VARCHAR(20),       -- junior, senior

  -- Weekly availability (same structure as user_training_preferences)
  weekly_availability JSONB NOT NULL DEFAULT '{
    "monday": [],
    "tuesday": [],
    "wednesday": [],
    "thursday": [],
    "friday": [],
    "saturday": [],
    "sunday": []
  }',

  -- Wish partners & preferred trainers
  wish_partner_ids JSONB DEFAULT '[]',
  preferred_trainer_ids JSONB DEFAULT '[]',
  preferred_court_ids JSONB DEFAULT '[]',

  -- Additional info
  max_sessions_per_week INTEGER,
  special_requests TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One preference row per user per club
  UNIQUE(user_id, club_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS member_sched_prefs_user_idx ON member_schedule_preferences(user_id);
CREATE INDEX IF NOT EXISTS member_sched_prefs_club_idx ON member_schedule_preferences(club_id);
CREATE INDEX IF NOT EXISTS member_sched_prefs_level_idx ON member_schedule_preferences(preferred_level);

-- RLS: Members can read/write their own preferences; admins can read/write all
ALTER TABLE member_schedule_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedule preferences"
  ON member_schedule_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedule preferences"
  ON member_schedule_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule preferences"
  ON member_schedule_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all schedule preferences"
  ON member_schedule_preferences FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_club_memberships.user_id = auth.uid()
      AND user_club_memberships.club_id = member_schedule_preferences.club_id
      AND user_club_memberships.role IN ('admin', 'superadmin')
      AND user_club_memberships.is_active = true
  ));

CREATE POLICY "Admins can update all schedule preferences"
  ON member_schedule_preferences FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_club_memberships.user_id = auth.uid()
      AND user_club_memberships.club_id = member_schedule_preferences.club_id
      AND user_club_memberships.role IN ('admin', 'superadmin')
      AND user_club_memberships.is_active = true
  ));
