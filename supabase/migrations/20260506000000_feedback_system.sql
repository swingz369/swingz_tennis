-- Phase 4 Task 1: Feedback System
-- Create tables for trainer feedback and ratings

-- Table: trainer_feedback
-- Stores feedback from members about trainers after sessions
CREATE TABLE IF NOT EXISTS trainer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- Rating (1-5 stars)
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  
  -- Detailed feedback categories (1-5 scale)
  teaching_quality INTEGER CHECK (teaching_quality >= 1 AND teaching_quality <= 5),
  communication INTEGER CHECK (communication >= 1 AND communication <= 5),
  motivation INTEGER CHECK (motivation >= 1 AND motivation <= 5),
  punctuality INTEGER CHECK (punctuality >= 1 AND punctuality <= 5),
  
  -- Written feedback
  comment TEXT,
  
  -- Moderation
  is_visible BOOLEAN DEFAULT true,
  is_flagged BOOLEAN DEFAULT false,
  flagged_reason TEXT,
  moderated_at TIMESTAMP WITH TIME ZONE,
  moderated_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT feedback_unique_session UNIQUE (member_id, session_id),
  CONSTRAINT feedback_rating_required CHECK (rating IS NOT NULL)
);

-- Table: trainer_rating_summary
-- Materialized view for quick trainer rating lookups
CREATE TABLE IF NOT EXISTS trainer_rating_summary (
  trainer_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- Aggregate ratings
  average_rating NUMERIC(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  
  -- Category averages
  avg_teaching_quality NUMERIC(3,2) DEFAULT 0,
  avg_communication NUMERIC(3,2) DEFAULT 0,
  avg_motivation NUMERIC(3,2) DEFAULT 0,
  avg_punctuality NUMERIC(3,2) DEFAULT 0,
  
  -- Rating distribution
  rating_5_count INTEGER DEFAULT 0,
  rating_4_count INTEGER DEFAULT 0,
  rating_3_count INTEGER DEFAULT 0,
  rating_2_count INTEGER DEFAULT 0,
  rating_1_count INTEGER DEFAULT 0,
  
  -- Metadata
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT trainer_rating_club_unique UNIQUE (trainer_id, club_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_trainer ON trainer_feedback(trainer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_member ON trainer_feedback(member_id);
CREATE INDEX IF NOT EXISTS idx_feedback_session ON trainer_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_club ON trainer_feedback(club_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON trainer_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_visible ON trainer_feedback(is_visible) WHERE is_visible = true;

CREATE INDEX IF NOT EXISTS idx_rating_summary_trainer ON trainer_rating_summary(trainer_id);
CREATE INDEX IF NOT EXISTS idx_rating_summary_club ON trainer_rating_summary(club_id);
CREATE INDEX IF NOT EXISTS idx_rating_summary_avg ON trainer_rating_summary(average_rating DESC);

-- Function: Update trainer rating summary
CREATE OR REPLACE FUNCTION update_trainer_rating_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert rating summary
  INSERT INTO trainer_rating_summary (
    trainer_id,
    club_id,
    average_rating,
    total_ratings,
    avg_teaching_quality,
    avg_communication,
    avg_motivation,
    avg_punctuality,
    rating_5_count,
    rating_4_count,
    rating_3_count,
    rating_2_count,
    rating_1_count,
    last_updated
  )
  SELECT 
    trainer_id,
    club_id,
    ROUND(AVG(rating)::numeric, 2) as average_rating,
    COUNT(*) as total_ratings,
    ROUND(AVG(teaching_quality)::numeric, 2) as avg_teaching_quality,
    ROUND(AVG(communication)::numeric, 2) as avg_communication,
    ROUND(AVG(motivation)::numeric, 2) as avg_motivation,
    ROUND(AVG(punctuality)::numeric, 2) as avg_punctuality,
    COUNT(*) FILTER (WHERE rating = 5) as rating_5_count,
    COUNT(*) FILTER (WHERE rating = 4) as rating_4_count,
    COUNT(*) FILTER (WHERE rating = 3) as rating_3_count,
    COUNT(*) FILTER (WHERE rating = 2) as rating_2_count,
    COUNT(*) FILTER (WHERE rating = 1) as rating_1_count,
    NOW()
  FROM trainer_feedback
  WHERE 
    trainer_id = COALESCE(NEW.trainer_id, OLD.trainer_id)
    AND is_visible = true
  GROUP BY trainer_id, club_id
  ON CONFLICT (trainer_id, club_id) 
  DO UPDATE SET
    average_rating = EXCLUDED.average_rating,
    total_ratings = EXCLUDED.total_ratings,
    avg_teaching_quality = EXCLUDED.avg_teaching_quality,
    avg_communication = EXCLUDED.avg_communication,
    avg_motivation = EXCLUDED.avg_motivation,
    avg_punctuality = EXCLUDED.avg_punctuality,
    rating_5_count = EXCLUDED.rating_5_count,
    rating_4_count = EXCLUDED.rating_4_count,
    rating_3_count = EXCLUDED.rating_3_count,
    rating_2_count = EXCLUDED.rating_2_count,
    rating_1_count = EXCLUDED.rating_1_count,
    last_updated = NOW();
    
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trigger_update_trainer_rating_summary ON trainer_feedback;
CREATE TRIGGER trigger_update_trainer_rating_summary
  AFTER INSERT OR UPDATE OR DELETE ON trainer_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_trainer_rating_summary();

DROP TRIGGER IF EXISTS set_feedback_updated_at ON trainer_feedback;
CREATE TRIGGER set_feedback_updated_at
  BEFORE UPDATE ON trainer_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS Policies for trainer_feedback
ALTER TABLE trainer_feedback ENABLE ROW LEVEL SECURITY;

-- Members can create feedback for their own bookings
DROP POLICY IF EXISTS "Members can create own feedback" ON trainer_feedback;
CREATE POLICY "Members can create own feedback"
  ON trainer_feedback
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.user_id = auth.uid()
        AND ucm.club_id = trainer_feedback.club_id
        AND ucm.role = 'member'
    )
    AND member_id = auth.uid()
  );

-- Members can view visible feedback
DROP POLICY IF EXISTS "Members can view visible feedback" ON trainer_feedback;
CREATE POLICY "Members can view visible feedback"
  ON trainer_feedback
  FOR SELECT
  USING (
    is_visible = true
    AND EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.user_id = auth.uid()
        AND ucm.club_id = trainer_feedback.club_id
    )
  );

-- Members can update their own feedback (within 24h)
DROP POLICY IF EXISTS "Members can update own recent feedback" ON trainer_feedback;
CREATE POLICY "Members can update own recent feedback"
  ON trainer_feedback
  FOR UPDATE
  USING (
    member_id = auth.uid()
    AND created_at > NOW() - INTERVAL '24 hours'
  );

-- Trainers can view feedback about themselves
DROP POLICY IF EXISTS "Trainers can view own feedback" ON trainer_feedback;
CREATE POLICY "Trainers can view own feedback"
  ON trainer_feedback
  FOR SELECT
  USING (
    trainer_id = auth.uid()
    AND is_visible = true
  );

-- Admins can view all feedback in their club
DROP POLICY IF EXISTS "Admins can view all feedback" ON trainer_feedback;
CREATE POLICY "Admins can view all feedback"
  ON trainer_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.user_id = auth.uid()
        AND ucm.club_id = trainer_feedback.club_id
        AND ucm.role IN ('admin', 'super_admin')
    )
  );

-- Admins can moderate feedback
DROP POLICY IF EXISTS "Admins can moderate feedback" ON trainer_feedback;
CREATE POLICY "Admins can moderate feedback"
  ON trainer_feedback
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.user_id = auth.uid()
        AND ucm.club_id = trainer_feedback.club_id
        AND ucm.role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for trainer_rating_summary
ALTER TABLE trainer_rating_summary ENABLE ROW LEVEL SECURITY;

-- Everyone in club can view rating summaries
DROP POLICY IF EXISTS "Club members can view rating summaries" ON trainer_rating_summary;
CREATE POLICY "Club members can view rating summaries"
  ON trainer_rating_summary
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.user_id = auth.uid()
        AND ucm.club_id = trainer_rating_summary.club_id
    )
  );

-- Comments
COMMENT ON TABLE trainer_feedback IS 'Member feedback and ratings for trainers after training sessions';
COMMENT ON TABLE trainer_rating_summary IS 'Aggregated trainer ratings for quick lookups and display';
COMMENT ON COLUMN trainer_feedback.rating IS 'Overall rating from 1 (poor) to 5 (excellent)';
COMMENT ON COLUMN trainer_feedback.is_visible IS 'Whether feedback is visible to other members';
COMMENT ON COLUMN trainer_feedback.is_flagged IS 'Flagged for moderation (inappropriate content)';
COMMENT ON COLUMN trainer_rating_summary.average_rating IS 'Average rating across all visible feedback';
COMMENT ON COLUMN trainer_rating_summary.total_ratings IS 'Total count of visible feedback entries';
