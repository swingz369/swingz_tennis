-- SWINGZ Season Planning System Migration
-- Phase 2: Saisonplanungssystem (Season Planning)
-- Created: 2026-05-06
-- Description: Implements comprehensive season planning with user preferences,
--              automated scheduling, and conflict resolution

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SEASONS TABLE
-- ============================================
-- Extended version of existing schedules table specifically for planning
-- Seasons define training periods (e.g., Summer 2026, Winter 2026/27)
CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- Season identification
  name varchar(100) NOT NULL, -- e.g., "Sommer 2026", "Winter 2026/27"
  season_type varchar(20) NOT NULL CHECK (season_type IN ('summer', 'winter')),
  year integer NOT NULL, -- Start year
  
  -- Date ranges
  start_date date NOT NULL,
  end_date date NOT NULL,
  
  -- Planning status
  planning_status varchar(20) NOT NULL DEFAULT 'draft' 
    CHECK (planning_status IN ('draft', 'collecting_preferences', 'auto_planning', 'manual_review', 'published', 'active', 'completed', 'archived')),
  
  -- Preferences collection
  preferences_deadline date, -- Deadline for users to submit preferences
  preferences_open boolean NOT NULL DEFAULT false,
  
  -- Auto-planning configuration
  auto_plan_enabled boolean NOT NULL DEFAULT true,
  auto_plan_config jsonb DEFAULT '{
    "max_iterations": 1000,
    "optimization_goals": ["minimize_conflicts", "balance_trainer_load", "maximize_preferences"],
    "allow_overbooking": false,
    "prefer_consistent_timeslots": true
  }'::jsonb,
  
  -- Metadata
  description text,
  notes text,
  created_by uuid REFERENCES users(id),
  last_planned_at timestamp,
  published_at timestamp,
  is_active boolean NOT NULL DEFAULT false, -- Only one active season per club at a time
  
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CHECK (end_date > start_date),
  CHECK (preferences_deadline IS NULL OR preferences_deadline <= start_date),
  UNIQUE(club_id, season_type, year) -- One season per type per year per club
);

-- Index for active season lookup
CREATE INDEX idx_seasons_club_active ON seasons(club_id, is_active) WHERE is_active = true;
CREATE INDEX idx_seasons_club_dates ON seasons(club_id, start_date, end_date);
CREATE INDEX idx_seasons_planning_status ON seasons(planning_status);

-- ============================================
-- USER TRAINING PREFERENCES TABLE
-- ============================================
-- Stores member/trainer availability and preferences for each season
CREATE TABLE IF NOT EXISTS user_training_preferences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- User role context
  user_role varchar(20) NOT NULL CHECK (user_role IN ('member', 'trainer', 'admin')),
  
  -- Training preferences
  preferred_level varchar(20), -- 'beginner', 'intermediate', 'advanced', 'professional'
  preferred_age_group varchar(20), -- 'youth', 'adult', 'senior'
  preferred_group_ids jsonb DEFAULT '[]'::jsonb, -- Array of group UUIDs they want to join
  
  -- Availability preferences (weekly recurring)
  -- Format: { "monday": [{"start": "09:00", "end": "12:00"}, ...], "tuesday": [...], ... }
  weekly_availability jsonb NOT NULL DEFAULT '{
    "monday": [],
    "tuesday": [],
    "wednesday": [],
    "thursday": [],
    "friday": [],
    "saturday": [],
    "sunday": []
  }'::jsonb,
  
  -- Specific unavailable dates (holidays, vacations)
  unavailable_dates jsonb DEFAULT '[]'::jsonb, -- Array of date strings: ["2026-07-15", "2026-08-01", ...]
  
  -- Trainer-specific fields
  max_sessions_per_week integer, -- For trainers only
  preferred_court_ids jsonb DEFAULT '[]'::jsonb, -- Array of court UUIDs
  can_teach_groups jsonb DEFAULT '[]'::jsonb, -- Array of group UUIDs trainer can handle
  
  -- Priority and notes
  priority integer NOT NULL DEFAULT 5, -- 1-10, higher = more important to accommodate
  special_requests text,
  notes text,
  
  -- Submission tracking
  submitted_at timestamp,
  is_submitted boolean NOT NULL DEFAULT false,
  last_modified_at timestamp DEFAULT NOW(),
  
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  
  -- One preference entry per user per season
  UNIQUE(season_id, user_id)
);

CREATE INDEX idx_user_prefs_season ON user_training_preferences(season_id);
CREATE INDEX idx_user_prefs_user ON user_training_preferences(user_id);
CREATE INDEX idx_user_prefs_club ON user_training_preferences(club_id);
CREATE INDEX idx_user_prefs_submitted ON user_training_preferences(season_id, is_submitted);

-- ============================================
-- SEASON PLAN ENTRIES TABLE
-- ============================================
-- Generated training session entries for a season (result of auto-planning)
-- Links to existing sessions table but adds planning-specific metadata
CREATE TABLE IF NOT EXISTS season_plan_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- Session details
  trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE RESTRICT,
  court_id uuid REFERENCES courts(id) ON DELETE SET NULL,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  
  -- Timing (recurring weekly pattern)
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Monday, 6=Sunday
  start_time time NOT NULL,
  end_time time NOT NULL,
  duration_minutes integer NOT NULL,
  
  -- Recurrence within season
  starts_from_week integer NOT NULL DEFAULT 1, -- Week number in season (1-based)
  ends_at_week integer, -- NULL = until end of season
  
  -- Planning metadata
  entry_type varchar(20) NOT NULL DEFAULT 'training' 
    CHECK (entry_type IN ('training', 'trial_lesson', 'group_session', 'private_lesson', 'tournament')),
  
  planning_source varchar(20) NOT NULL DEFAULT 'auto' 
    CHECK (planning_source IN ('auto', 'manual', 'imported', 'copied')),
  
  -- Quality scores (from auto-planning algorithm)
  preference_match_score numeric(5, 2) DEFAULT 0, -- 0-100, how well it matches user preferences
  conflict_score numeric(5, 2) DEFAULT 0, -- 0-100, lower = fewer conflicts
  optimization_score numeric(5, 2) DEFAULT 0, -- 0-100, overall quality
  
  -- Participants
  max_participants integer NOT NULL DEFAULT 10,
  expected_participants jsonb DEFAULT '[]'::jsonb, -- Array of user_id strings
  
  -- Status
  status varchar(20) NOT NULL DEFAULT 'planned' 
    CHECK (status IN ('planned', 'confirmed', 'published', 'active', 'cancelled', 'completed')),
  
  -- Link to actual session (after publishing)
  published_session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  published_at timestamp,
  
  -- Notes and metadata
  notes text,
  admin_notes text,
  
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  
  CHECK (end_time > start_time),
  CHECK (duration_minutes > 0)
);

CREATE INDEX idx_plan_entries_season ON season_plan_entries(season_id);
CREATE INDEX idx_plan_entries_club ON season_plan_entries(club_id);
CREATE INDEX idx_plan_entries_trainer ON season_plan_entries(trainer_id);
CREATE INDEX idx_plan_entries_court ON season_plan_entries(court_id);
CREATE INDEX idx_plan_entries_group ON season_plan_entries(group_id);
CREATE INDEX idx_plan_entries_day_time ON season_plan_entries(day_of_week, start_time);
CREATE INDEX idx_plan_entries_status ON season_plan_entries(status);
CREATE INDEX idx_plan_entries_published_session ON season_plan_entries(published_session_id) WHERE published_session_id IS NOT NULL;

-- ============================================
-- PLANNING CONFLICTS TABLE
-- ============================================
-- Tracks scheduling conflicts detected during planning
-- Helps admins identify and resolve issues
CREATE TABLE IF NOT EXISTS planning_conflicts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- Conflict identification
  conflict_type varchar(50) NOT NULL CHECK (conflict_type IN (
    'trainer_double_booking',
    'court_double_booking',
    'user_unavailable',
    'group_overlap',
    'capacity_exceeded',
    'preference_mismatch',
    'invalid_timeslot',
    'resource_not_available',
    'other'
  )),
  
  severity varchar(20) NOT NULL DEFAULT 'medium' 
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Affected entities
  affected_plan_entry_ids jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of season_plan_entries.id
  affected_trainer_id uuid REFERENCES trainers(id) ON DELETE CASCADE,
  affected_court_id uuid REFERENCES courts(id) ON DELETE SET NULL,
  affected_user_ids jsonb DEFAULT '[]'::jsonb, -- Array of user_id strings
  affected_group_ids jsonb DEFAULT '[]'::jsonb, -- Array of group_id strings
  
  -- Conflict details
  conflict_time_slot jsonb, -- {"day_of_week": 1, "start_time": "09:00", "end_time": "10:30"}
  description text NOT NULL,
  suggested_resolution text,
  
  -- Resolution tracking
  status varchar(20) NOT NULL DEFAULT 'open' 
    CHECK (status IN ('open', 'investigating', 'resolved', 'ignored', 'wont_fix')),
  
  resolved_at timestamp,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes text,
  resolution_action varchar(50), -- 'entry_modified', 'entry_deleted', 'preference_override', 'manual_adjustment', etc.
  
  -- Metadata
  detected_at timestamp NOT NULL DEFAULT NOW(),
  detection_source varchar(20) DEFAULT 'auto_planner' 
    CHECK (detection_source IN ('auto_planner', 'manual_check', 'user_report', 'system')),
  
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conflicts_season ON planning_conflicts(season_id);
CREATE INDEX idx_conflicts_club ON planning_conflicts(club_id);
CREATE INDEX idx_conflicts_status ON planning_conflicts(status);
CREATE INDEX idx_conflicts_severity ON planning_conflicts(severity);
CREATE INDEX idx_conflicts_trainer ON planning_conflicts(affected_trainer_id);
CREATE INDEX idx_conflicts_court ON planning_conflicts(affected_court_id);

-- ============================================
-- SEASON PLANNING HISTORY TABLE
-- ============================================
-- Audit trail for planning actions and algorithm runs
CREATE TABLE IF NOT EXISTS season_planning_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  action_type varchar(50) NOT NULL CHECK (action_type IN (
    'season_created',
    'preferences_opened',
    'preferences_closed',
    'auto_plan_started',
    'auto_plan_completed',
    'auto_plan_failed',
    'manual_edit',
    'entry_added',
    'entry_modified',
    'entry_deleted',
    'conflict_detected',
    'conflict_resolved',
    'plan_published',
    'plan_reverted',
    'season_activated',
    'season_completed'
  )),
  
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL, -- NULL for system actions
  actor_role varchar(20),
  
  -- Action details
  details jsonb DEFAULT '{}'::jsonb, -- Flexible metadata
  entries_affected integer DEFAULT 0,
  conflicts_created integer DEFAULT 0,
  conflicts_resolved integer DEFAULT 0,
  
  -- Algorithm-specific metrics (for auto_plan actions)
  algorithm_metrics jsonb, -- {"iterations": 856, "runtime_ms": 1234, "score": 87.5, ...}
  
  notes text,
  
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_planning_history_season ON season_planning_history(season_id);
CREATE INDEX idx_planning_history_club ON season_planning_history(club_id);
CREATE INDEX idx_planning_history_action ON season_planning_history(action_type);
CREATE INDEX idx_planning_history_actor ON season_planning_history(actor_id);
CREATE INDEX idx_planning_history_created ON season_planning_history(created_at);

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View: Active seasons per club
CREATE OR REPLACE VIEW active_seasons AS
SELECT 
  s.*,
  COUNT(DISTINCT utp.id) as total_preferences,
  COUNT(DISTINCT CASE WHEN utp.is_submitted THEN utp.id END) as submitted_preferences,
  COUNT(DISTINCT spe.id) as planned_entries,
  COUNT(DISTINCT pc.id) FILTER (WHERE pc.status = 'open') as open_conflicts
FROM seasons s
LEFT JOIN user_training_preferences utp ON s.id = utp.season_id
LEFT JOIN season_plan_entries spe ON s.id = spe.season_id
LEFT JOIN planning_conflicts pc ON s.id = pc.season_id
WHERE s.is_active = true
GROUP BY s.id;

-- View: Season planning summary
CREATE OR REPLACE VIEW season_planning_summary AS
SELECT 
  s.id as season_id,
  s.club_id,
  s.name,
  s.season_type,
  s.planning_status,
  s.start_date,
  s.end_date,
  
  -- Preferences stats
  COUNT(DISTINCT utp.id) as total_users,
  COUNT(DISTINCT CASE WHEN utp.is_submitted THEN utp.id END) as submitted_preferences,
  COUNT(DISTINCT CASE WHEN utp.user_role = 'trainer' THEN utp.id END) as trainers_count,
  
  -- Planning stats
  COUNT(DISTINCT spe.id) as total_entries,
  COUNT(DISTINCT spe.trainer_id) as trainers_assigned,
  COUNT(DISTINCT spe.court_id) as courts_used,
  COUNT(DISTINCT spe.group_id) as groups_covered,
  AVG(spe.optimization_score) as avg_optimization_score,
  
  -- Conflicts stats
  COUNT(DISTINCT pc.id) as total_conflicts,
  COUNT(DISTINCT CASE WHEN pc.status = 'open' THEN pc.id END) as open_conflicts,
  COUNT(DISTINCT CASE WHEN pc.severity IN ('high', 'critical') THEN pc.id END) as critical_conflicts,
  
  s.created_at,
  s.last_planned_at,
  s.published_at
FROM seasons s
LEFT JOIN user_training_preferences utp ON s.id = utp.season_id
LEFT JOIN season_plan_entries spe ON s.id = spe.season_id
LEFT JOIN planning_conflicts pc ON s.id = pc.season_id
GROUP BY s.id;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function: Calculate season weeks
CREATE OR REPLACE FUNCTION calculate_season_weeks(season_start date, season_end date)
RETURNS integer AS $$
BEGIN
  RETURN CEIL(EXTRACT(EPOCH FROM (season_end - season_start)) / (7 * 24 * 60 * 60))::integer;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Check if timeslot overlaps
CREATE OR REPLACE FUNCTION timeslots_overlap(
  day1 integer, start1 time, end1 time,
  day2 integer, start2 time, end2 time
)
RETURNS boolean AS $$
BEGIN
  -- Different days = no overlap
  IF day1 != day2 THEN
    RETURN false;
  END IF;
  
  -- Check time overlap on same day
  RETURN (start1 < end2) AND (start2 < end1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Get user availability for specific timeslot
CREATE OR REPLACE FUNCTION user_available_at(
  p_user_id uuid,
  p_season_id uuid,
  p_day_of_week integer,
  p_start_time time,
  p_end_time time,
  p_specific_date date DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_prefs jsonb;
  v_day_key text;
  v_availability jsonb;
  v_slot jsonb;
  v_unavailable_dates jsonb;
BEGIN
  -- Get user preferences
  SELECT weekly_availability, unavailable_dates
  INTO v_prefs, v_unavailable_dates
  FROM user_training_preferences
  WHERE user_id = p_user_id AND season_id = p_season_id;
  
  -- No preferences = assume unavailable
  IF v_prefs IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check specific date unavailability
  IF p_specific_date IS NOT NULL AND v_unavailable_dates IS NOT NULL THEN
    IF v_unavailable_dates ? p_specific_date::text THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Get day name
  v_day_key := CASE p_day_of_week
    WHEN 0 THEN 'monday'
    WHEN 1 THEN 'tuesday'
    WHEN 2 THEN 'wednesday'
    WHEN 3 THEN 'thursday'
    WHEN 4 THEN 'friday'
    WHEN 5 THEN 'saturday'
    WHEN 6 THEN 'sunday'
  END;
  
  -- Get availability for that day
  v_availability := v_prefs->v_day_key;
  
  -- If no availability specified for that day, assume unavailable
  IF v_availability IS NULL OR jsonb_array_length(v_availability) = 0 THEN
    RETURN false;
  END IF;
  
  -- Check if requested time overlaps with any available slot
  FOR v_slot IN SELECT * FROM jsonb_array_elements(v_availability)
  LOOP
    IF (v_slot->>'start')::time <= p_start_time 
       AND (v_slot->>'end')::time >= p_end_time THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_training_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_plan_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_planning_history ENABLE ROW LEVEL SECURITY;

-- Seasons: Admin/Superadmin can manage, members can view published
CREATE POLICY "seasons_admin_all" ON seasons
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = seasons.club_id
        AND ucm.user_id = auth.uid()
        AND ucm.role IN ('admin', 'superadmin')
        AND ucm.is_active = true
    )
  );

CREATE POLICY "seasons_members_view_published" ON seasons
  FOR SELECT
  USING (
    planning_status IN ('published', 'active', 'completed') AND
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = seasons.club_id
        AND ucm.user_id = auth.uid()
        AND ucm.is_active = true
    )
  );

-- User preferences: Users can manage their own, admins can view all
CREATE POLICY "user_prefs_own" ON user_training_preferences
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "user_prefs_admin_view" ON user_training_preferences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = user_training_preferences.club_id
        AND ucm.user_id = auth.uid()
        AND ucm.role IN ('admin', 'superadmin')
        AND ucm.is_active = true
    )
  );

-- Season plan entries: Admin/Superadmin full access, members view published
CREATE POLICY "plan_entries_admin_all" ON season_plan_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = season_plan_entries.club_id
        AND ucm.user_id = auth.uid()
        AND ucm.role IN ('admin', 'superadmin')
        AND ucm.is_active = true
    )
  );

CREATE POLICY "plan_entries_members_view_published" ON season_plan_entries
  FOR SELECT
  USING (
    status IN ('published', 'active', 'completed') AND
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = season_plan_entries.club_id
        AND ucm.user_id = auth.uid()
        AND ucm.is_active = true
    )
  );

-- Planning conflicts: Admin/Superadmin only
CREATE POLICY "conflicts_admin_only" ON planning_conflicts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = planning_conflicts.club_id
        AND ucm.user_id = auth.uid()
        AND ucm.role IN ('admin', 'superadmin')
        AND ucm.is_active = true
    )
  );

-- Planning history: Admin/Superadmin view only
CREATE POLICY "planning_history_admin_view" ON season_planning_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = season_planning_history.club_id
        AND ucm.user_id = auth.uid()
        AND ucm.role IN ('admin', 'superadmin')
        AND ucm.is_active = true
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON seasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_prefs_updated_at BEFORE UPDATE ON user_training_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_entries_updated_at BEFORE UPDATE ON season_plan_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conflicts_updated_at BEFORE UPDATE ON planning_conflicts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Automatically set last_modified_at when preference is updated
CREATE OR REPLACE FUNCTION set_preference_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_prefs_last_modified BEFORE UPDATE ON user_training_preferences
  FOR EACH ROW EXECUTE FUNCTION set_preference_last_modified();

-- Log planning actions to history
CREATE OR REPLACE FUNCTION log_season_planning_action()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO season_planning_history (season_id, club_id, action_type, actor_id, details)
    VALUES (NEW.id, NEW.club_id, 'season_created', NEW.created_by, 
            jsonb_build_object('season_name', NEW.name, 'season_type', NEW.season_type));
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.planning_status != NEW.planning_status THEN
      INSERT INTO season_planning_history (season_id, club_id, action_type, details)
      VALUES (NEW.id, NEW.club_id, 
              CASE NEW.planning_status
                WHEN 'collecting_preferences' THEN 'preferences_opened'
                WHEN 'auto_planning' THEN 'auto_plan_started'
                WHEN 'published' THEN 'plan_published'
                WHEN 'active' THEN 'season_activated'
                WHEN 'completed' THEN 'season_completed'
                ELSE 'manual_edit'
              END,
              jsonb_build_object('old_status', OLD.planning_status, 'new_status', NEW.planning_status));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_season_actions AFTER INSERT OR UPDATE ON seasons
  FOR EACH ROW EXECUTE FUNCTION log_season_planning_action();

-- ============================================
-- COMMENTS (Documentation)
-- ============================================

COMMENT ON TABLE seasons IS 'Training seasons with planning workflow';
COMMENT ON TABLE user_training_preferences IS 'Member and trainer availability and preferences per season';
COMMENT ON TABLE season_plan_entries IS 'Generated training schedule entries from planning';
COMMENT ON TABLE planning_conflicts IS 'Detected scheduling conflicts during planning';
COMMENT ON TABLE season_planning_history IS 'Audit trail for all planning actions';

COMMENT ON COLUMN seasons.planning_status IS 'Workflow: draft -> collecting_preferences -> auto_planning -> manual_review -> published -> active -> completed';
COMMENT ON COLUMN season_plan_entries.preference_match_score IS 'Algorithm score: how well this entry matches user preferences (0-100)';
COMMENT ON COLUMN season_plan_entries.conflict_score IS 'Algorithm score: conflict penalty, lower is better (0-100)';
COMMENT ON COLUMN season_plan_entries.optimization_score IS 'Overall quality score from planning algorithm (0-100)';

-- ============================================
-- END OF MIGRATION
-- ============================================
