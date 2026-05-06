-- Trainer Availability System
-- Allows trainers to define their weekly availability
-- Based on TSOWAPP implementation
-- Created: 2026-05-06

-- ============================================
-- TRAINER AVAILABILITY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS trainer_availability (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  max_sessions integer DEFAULT NULL, -- Max sessions in this slot, NULL = unlimited
  notes text,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, club_id, day_of_week, start_time, end_time),
  CHECK (end_time > start_time)
);

-- ============================================
-- TRAINER ABSENCES TABLE
-- For one-time absences (vacation, sick, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS trainer_absences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason varchar(100),
  notes text,
  substitute_trainer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

-- ============================================
-- TRAINER ASSIGNMENTS TABLE
-- Links trainers to clubs with additional info
-- ============================================

CREATE TABLE IF NOT EXISTS trainer_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  hourly_rate numeric(10, 2) DEFAULT 0.00,
  specialization text[], -- e.g., ['beginner', 'advanced', 'kids']
  max_students_per_session integer DEFAULT 10,
  bio text,
  qualifications text[],
  languages text[] DEFAULT ARRAY['de'],
  is_active boolean NOT NULL DEFAULT true,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, club_id)
);

-- ============================================
-- INDEXES
-- ============================================

-- Trainer availability indexes
CREATE INDEX IF NOT EXISTS idx_trainer_availability_user_id ON trainer_availability(user_id);
CREATE INDEX IF NOT EXISTS idx_trainer_availability_club_id ON trainer_availability(club_id);
CREATE INDEX IF NOT EXISTS idx_trainer_availability_day ON trainer_availability(day_of_week);
CREATE INDEX IF NOT EXISTS idx_trainer_availability_time ON trainer_availability(start_time, end_time);

-- Trainer absences indexes
CREATE INDEX IF NOT EXISTS idx_trainer_absences_user_id ON trainer_absences(user_id);
CREATE INDEX IF NOT EXISTS idx_trainer_absences_club_id ON trainer_absences(club_id);
CREATE INDEX IF NOT EXISTS idx_trainer_absences_dates ON trainer_absences(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_trainer_absences_substitute ON trainer_absences(substitute_trainer_id);

-- Trainer assignments indexes
CREATE INDEX IF NOT EXISTS idx_trainer_assignments_user_id ON trainer_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_trainer_assignments_club_id ON trainer_assignments(club_id);
CREATE INDEX IF NOT EXISTS idx_trainer_assignments_active ON trainer_assignments(is_active);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE trainer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_assignments ENABLE ROW LEVEL SECURITY;

-- Trainer availability policies
CREATE POLICY "trainers_can_view_own_availability" ON trainer_availability
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = trainer_availability.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "trainers_can_manage_own_availability" ON trainer_availability
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "admins_can_manage_trainer_availability" ON trainer_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = trainer_availability.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- Trainer absences policies
CREATE POLICY "trainers_can_view_own_absences" ON trainer_absences
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = trainer_absences.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "trainers_can_manage_own_absences" ON trainer_absences
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "admins_can_manage_trainer_absences" ON trainer_absences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = trainer_absences.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- Trainer assignments policies
CREATE POLICY "members_can_view_trainer_assignments" ON trainer_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = trainer_assignments.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

CREATE POLICY "trainers_can_view_own_assignments" ON trainer_assignments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins_can_manage_trainer_assignments" ON trainer_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = trainer_assignments.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_trainer_availability_updated_at BEFORE UPDATE ON trainer_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trainer_absences_updated_at BEFORE UPDATE ON trainer_absences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trainer_assignments_updated_at BEFORE UPDATE ON trainer_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if trainer is available at a specific date/time
CREATE OR REPLACE FUNCTION is_trainer_available(
  p_user_id uuid,
  p_club_id uuid,
  p_datetime timestamp
)
RETURNS boolean AS $$
DECLARE
  v_day_of_week integer;
  v_time time;
  v_date date;
  v_available_count integer;
  v_absence_count integer;
BEGIN
  -- Extract components
  v_day_of_week := EXTRACT(DOW FROM p_datetime)::integer;
  v_time := p_datetime::time;
  v_date := p_datetime::date;
  
  -- Check if trainer has availability for this day/time
  SELECT COUNT(*) INTO v_available_count
  FROM trainer_availability
  WHERE user_id = p_user_id
    AND club_id = p_club_id
    AND day_of_week = v_day_of_week
    AND start_time <= v_time
    AND end_time >= v_time
    AND is_available = true;
  
  IF v_available_count = 0 THEN
    RETURN false;
  END IF;
  
  -- Check if trainer has an absence on this date
  SELECT COUNT(*) INTO v_absence_count
  FROM trainer_absences
  WHERE user_id = p_user_id
    AND club_id = p_club_id
    AND start_date <= v_date
    AND end_date >= v_date;
  
  IF v_absence_count > 0 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to get available trainers for a specific date/time
CREATE OR REPLACE FUNCTION get_available_trainers(
  p_club_id uuid,
  p_datetime timestamp
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  specialization text[],
  hourly_rate numeric
) AS $$
DECLARE
  v_day_of_week integer;
  v_time time;
  v_date date;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_datetime)::integer;
  v_time := p_datetime::time;
  v_date := p_datetime::date;
  
  RETURN QUERY
  SELECT DISTINCT
    ta.user_id,
    u.full_name,
    ta.specialization,
    ta.hourly_rate
  FROM trainer_assignments ta
  JOIN users u ON u.id = ta.user_id
  WHERE ta.club_id = p_club_id
    AND ta.is_active = true
    AND EXISTS (
      SELECT 1 FROM trainer_availability tav
      WHERE tav.user_id = ta.user_id
        AND tav.club_id = p_club_id
        AND tav.day_of_week = v_day_of_week
        AND tav.start_time <= v_time
        AND tav.end_time >= v_time
        AND tav.is_available = true
    )
    AND NOT EXISTS (
      SELECT 1 FROM trainer_absences tabs
      WHERE tabs.user_id = ta.user_id
        AND tabs.club_id = p_club_id
        AND tabs.start_date <= v_date
        AND tabs.end_date >= v_date
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE trainer_availability IS 'Weekly availability schedule for trainers';
COMMENT ON TABLE trainer_absences IS 'One-time absences for trainers (vacation, sick leave, etc.)';
COMMENT ON TABLE trainer_assignments IS 'Trainer assignments to clubs with rates and qualifications';

COMMENT ON COLUMN trainer_availability.day_of_week IS '0 = Sunday, 1 = Monday, ..., 6 = Saturday';
COMMENT ON COLUMN trainer_availability.max_sessions IS 'Maximum sessions in this time slot, NULL = unlimited';
COMMENT ON COLUMN trainer_assignments.specialization IS 'Array of specializations: beginner, advanced, kids, etc.';
COMMENT ON COLUMN trainer_assignments.qualifications IS 'Array of qualifications and certifications';
