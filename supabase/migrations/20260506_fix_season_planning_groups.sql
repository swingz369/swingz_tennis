-- Fix Season Planning System - Correct group_id reference
-- This fixes the FK constraint to reference the correct training_groups table
-- Created: 2026-05-06

-- Drop the season_plan_entries table if it exists (it may have failed to create)
DROP TABLE IF EXISTS season_plan_entries CASCADE;

-- Recreate season_plan_entries with correct training_groups reference
CREATE TABLE season_plan_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- Session details
  trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE RESTRICT,
  court_id uuid REFERENCES courts(id) ON DELETE SET NULL,
  group_id uuid REFERENCES training_groups(id) ON DELETE CASCADE, -- FIXED: Changed from groups to training_groups
  
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

-- Create indexes
CREATE INDEX idx_plan_entries_season ON season_plan_entries(season_id);
CREATE INDEX idx_plan_entries_club ON season_plan_entries(club_id);
CREATE INDEX idx_plan_entries_trainer ON season_plan_entries(trainer_id);
CREATE INDEX idx_plan_entries_court ON season_plan_entries(court_id);
CREATE INDEX idx_plan_entries_group ON season_plan_entries(group_id);
CREATE INDEX idx_plan_entries_day_time ON season_plan_entries(day_of_week, start_time);
CREATE INDEX idx_plan_entries_status ON season_plan_entries(status);
CREATE INDEX idx_plan_entries_published_session ON season_plan_entries(published_session_id) WHERE published_session_id IS NOT NULL;

-- Re-enable RLS
ALTER TABLE season_plan_entries ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies for season_plan_entries
-- Admins can manage all entries
CREATE POLICY season_plan_entries_admin_all
  ON season_plan_entries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.user_id = auth.uid()
        AND ucm.club_id = season_plan_entries.club_id
        AND ucm.role IN ('admin', 'superadmin')
        AND ucm.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.user_id = auth.uid()
        AND ucm.club_id = season_plan_entries.club_id
        AND ucm.role IN ('admin', 'superadmin')
        AND ucm.is_active = true
    )
  );

-- Trainers can view their own entries
CREATE POLICY season_plan_entries_trainer_view
  ON season_plan_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trainers t
      WHERE t.id = season_plan_entries.trainer_id
        AND t.user_id = auth.uid()
    )
  );

-- Members can view published entries
CREATE POLICY season_plan_entries_member_view_published
  ON season_plan_entries
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.user_id = auth.uid()
        AND ucm.club_id = season_plan_entries.club_id
        AND ucm.is_active = true
    )
  );

-- Recreate update trigger for updated_at
CREATE OR REPLACE FUNCTION update_season_plan_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER season_plan_entries_updated_at
  BEFORE UPDATE ON season_plan_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_season_plan_entries_updated_at();

-- Recreate trigger to log changes to season_planning_history
CREATE OR REPLACE FUNCTION log_season_plan_entry_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO season_planning_history (
      season_id, club_id, action_type, entity_type, entity_id,
      changed_by, changes
    ) VALUES (
      NEW.season_id, NEW.club_id, 'created', 'plan_entry', NEW.id,
      auth.uid(), row_to_json(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO season_planning_history (
      season_id, club_id, action_type, entity_type, entity_id,
      changed_by, changes
    ) VALUES (
      NEW.season_id, NEW.club_id, 'updated', 'plan_entry', NEW.id,
      auth.uid(), jsonb_build_object(
        'old', row_to_json(OLD),
        'new', row_to_json(NEW)
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO season_planning_history (
      season_id, club_id, action_type, entity_type, entity_id,
      changed_by, changes
    ) VALUES (
      OLD.season_id, OLD.club_id, 'deleted', 'plan_entry', OLD.id,
      auth.uid(), row_to_json(OLD)
    );
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER season_plan_entry_changes
  AFTER INSERT OR UPDATE OR DELETE ON season_plan_entries
  FOR EACH ROW
  EXECUTE FUNCTION log_season_plan_entry_changes();

-- Comment on the table
COMMENT ON TABLE season_plan_entries IS 'Planning entries for training sessions within a season. Generated by auto-planning or created manually.';
COMMENT ON COLUMN season_plan_entries.group_id IS 'Reference to training_groups table';
