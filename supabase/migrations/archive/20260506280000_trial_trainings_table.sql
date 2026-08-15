-- Trial Training Table Migration
-- This migration creates the table for managing trial training sessions
-- Features: participant tracking, feedback collection, conversion tracking, multi-tenant isolation

-- ============================================================================
-- TABLE: trial_trainings
-- ============================================================================

CREATE TABLE IF NOT EXISTS trial_trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- Participant Information
  participant_id UUID NOT NULL DEFAULT gen_random_uuid(),
  participant_first_name VARCHAR(100) NOT NULL,
  participant_last_name VARCHAR(100) NOT NULL,
  participant_email VARCHAR(255) NOT NULL,
  participant_phone VARCHAR(50) NOT NULL,
  participant_date_of_birth DATE NOT NULL,
  
  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time VARCHAR(5) NOT NULL CHECK (scheduled_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'),
  duration INTEGER NOT NULL CHECK (duration >= 30 AND duration <= 180),
  
  -- Resources
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE RESTRICT,
  trainer_name VARCHAR(100) NOT NULL,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
  court_name VARCHAR(100) NOT NULL,
  
  -- Status & Tracking
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'converted')),
  notes TEXT,
  
  -- Feedback
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_comments TEXT,
  feedback_would_recommend BOOLEAN,
  
  -- Conversion Tracking
  converted_to_member_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

-- Query by club (tenant isolation)
CREATE INDEX IF NOT EXISTS idx_trial_trainings_club_id ON trial_trainings(club_id);

-- Query by participant email (duplicate detection)
CREATE INDEX IF NOT EXISTS idx_trial_trainings_participant_email ON trial_trainings(participant_email);

-- Query by trainer
CREATE INDEX IF NOT EXISTS idx_trial_trainings_trainer_id ON trial_trainings(trainer_id);

-- Query by court
CREATE INDEX IF NOT EXISTS idx_trial_trainings_court_id ON trial_trainings(court_id);

-- Query by status
CREATE INDEX IF NOT EXISTS idx_trial_trainings_status ON trial_trainings(status);

-- Query by scheduled date (upcoming sessions)
CREATE INDEX IF NOT EXISTS idx_trial_trainings_scheduled_date ON trial_trainings(scheduled_date);

-- Composite index for club + status queries
CREATE INDEX IF NOT EXISTS idx_trial_trainings_club_status ON trial_trainings(club_id, status);

-- Composite index for club + date queries
CREATE INDEX IF NOT EXISTS idx_trial_trainings_club_date ON trial_trainings(club_id, scheduled_date);

-- Composite index for upcoming scheduled sessions
CREATE INDEX IF NOT EXISTS idx_trial_trainings_upcoming ON trial_trainings(scheduled_date, scheduled_time) 
  WHERE status = 'scheduled';

-- Full-text search on participant name
CREATE INDEX IF NOT EXISTS idx_trial_trainings_participant_name ON trial_trainings USING gin(
  to_tsvector('simple', participant_first_name || ' ' || participant_last_name)
);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE trial_trainings ENABLE ROW LEVEL SECURITY;

-- Policy 1: Superadmins have full access (cross-tenant)
DROP POLICY IF EXISTS "Superadmins have full access to all trial trainings" ON trial_trainings;
CREATE POLICY "Superadmins have full access to all trial trainings"
  ON trial_trainings
  FOR ALL
  USING (is_superadmin());

-- Policy 2: Club admins can view all trial trainings in their clubs
DROP POLICY IF EXISTS "Club admins can view trial trainings in their clubs" ON trial_trainings;
CREATE POLICY "Club admins can view trial trainings in their clubs"
  ON trial_trainings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trial_trainings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 3: Club admins can create trial trainings in their clubs
DROP POLICY IF EXISTS "Club admins can create trial trainings in their clubs" ON trial_trainings;
CREATE POLICY "Club admins can create trial trainings in their clubs"
  ON trial_trainings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trial_trainings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 4: Club admins can update trial trainings in their clubs
DROP POLICY IF EXISTS "Club admins can update trial trainings in their clubs" ON trial_trainings;
CREATE POLICY "Club admins can update trial trainings in their clubs"
  ON trial_trainings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trial_trainings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 5: Club admins can delete trial trainings in their clubs
DROP POLICY IF EXISTS "Club admins can delete trial trainings in their clubs" ON trial_trainings;
CREATE POLICY "Club admins can delete trial trainings in their clubs"
  ON trial_trainings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trial_trainings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 6: Trainers can view their assigned trial trainings
DROP POLICY IF EXISTS "Trainers can view their assigned trial trainings" ON trial_trainings;
CREATE POLICY "Trainers can view their assigned trial trainings"
  ON trial_trainings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      INNER JOIN trainers t ON t.email = (SELECT email FROM auth.users WHERE id = cm.user_id)
      WHERE cm.club_id = trial_trainings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'trainer'
        AND cm.is_active = true
        AND t.id = trial_trainings.trainer_id
    )
  );

-- Policy 7: Trainers can update status/feedback for their assigned trial trainings
DROP POLICY IF EXISTS "Trainers can update their assigned trial trainings" ON trial_trainings;
CREATE POLICY "Trainers can update their assigned trial trainings"
  ON trial_trainings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      INNER JOIN trainers t ON t.email = (SELECT email FROM auth.users WHERE id = cm.user_id)
      WHERE cm.club_id = trial_trainings.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'trainer'
        AND cm.is_active = true
        AND t.id = trial_trainings.trainer_id
    )
  );

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_trial_trainings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trial_trainings_updated_at ON trial_trainings;
CREATE TRIGGER trial_trainings_updated_at
  BEFORE UPDATE ON trial_trainings
  FOR EACH ROW
  EXECUTE FUNCTION update_trial_trainings_updated_at();

-- ============================================================================
-- HELPER FUNCTION: Get trial training statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_trial_training_stats(
  p_club_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total BIGINT,
  scheduled BIGINT,
  completed BIGINT,
  cancelled BIGINT,
  no_show BIGINT,
  converted BIGINT,
  conversion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total,
    COUNT(*) FILTER (WHERE status = 'scheduled')::BIGINT as scheduled,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed,
    COUNT(*) FILTER (WHERE status = 'cancelled')::BIGINT as cancelled,
    COUNT(*) FILTER (WHERE status = 'no_show')::BIGINT as no_show,
    COUNT(*) FILTER (WHERE status = 'converted')::BIGINT as converted,
    CASE
      WHEN COUNT(*) FILTER (WHERE status = 'completed') > 0
      THEN ROUND(
        (COUNT(*) FILTER (WHERE status = 'converted')::NUMERIC / 
         COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC) * 100,
        2
      )
      ELSE 0
    END as conversion_rate
  FROM trial_trainings
  WHERE club_id = p_club_id
    AND (p_start_date IS NULL OR scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR scheduled_date <= p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Get upcoming trial trainings
-- ============================================================================

CREATE OR REPLACE FUNCTION get_upcoming_trial_trainings(
  p_club_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS SETOF trial_trainings AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM trial_trainings
  WHERE club_id = p_club_id
    AND status = 'scheduled'
    AND scheduled_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + p_days)
  ORDER BY scheduled_date, scheduled_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE trial_trainings IS 'Trial training sessions with participant tracking and conversion metrics';
COMMENT ON COLUMN trial_trainings.status IS 'Session status: scheduled, completed, cancelled, no_show, or converted';
COMMENT ON COLUMN trial_trainings.feedback_rating IS 'Participant rating (1-5 stars)';
COMMENT ON COLUMN trial_trainings.converted_to_member_id IS 'Member ID if participant converted to full member';
COMMENT ON FUNCTION get_trial_training_stats(UUID, DATE, DATE) IS 'Calculate trial training statistics including conversion rate';
COMMENT ON FUNCTION get_upcoming_trial_trainings(UUID, INTEGER) IS 'Get scheduled trial trainings in the next N days';
