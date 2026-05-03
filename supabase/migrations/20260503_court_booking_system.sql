-- SWINGZ Court Booking System Migration
-- Phase 2: Platzbuchungssystem
-- Created: 2026-05-03

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- COURT TYPES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS court_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(100) NOT NULL UNIQUE,
  description text,
  surface_type varchar(50) NOT NULL CHECK (surface_type IN ('clay', 'hard', 'grass', 'carpet', 'artificial_grass')),
  is_indoor boolean NOT NULL DEFAULT false,
  is_outdoor boolean NOT NULL DEFAULT true,
  requires_lighting boolean NOT NULL DEFAULT false,
  max_players integer NOT NULL DEFAULT 4,
  hourly_rate numeric(10, 2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- COURTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS courts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  court_type_id uuid NOT NULL REFERENCES court_types(id) ON DELETE RESTRICT,
  name varchar(100) NOT NULL,
  number integer NOT NULL,
  location varchar(100),
  description text,
  status varchar(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'closed', 'reserved')),
  has_lighting boolean NOT NULL DEFAULT false,
  lighting_hours_start time,
  lighting_hours_end time,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  UNIQUE(club_id, number)
);

-- ============================================
-- BOOKING RULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS booking_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  description text,
  max_booking_duration_minutes integer NOT NULL DEFAULT 90,
  min_booking_duration_minutes integer NOT NULL DEFAULT 30,
  advance_booking_days integer NOT NULL DEFAULT 7,
  max_bookings_per_day integer NOT NULL DEFAULT 2,
  max_bookings_per_week integer NOT NULL DEFAULT 10,
  allow_recurring boolean NOT NULL DEFAULT true,
  max_recurring_weeks integer NOT NULL DEFAULT 12,
  require_payment boolean NOT NULL DEFAULT false,
  cancellation_hours integer NOT NULL DEFAULT 24,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- BOOKINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_number varchar(50) NOT NULL UNIQUE,
  start_time timestamp NOT NULL,
  end_time timestamp NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  booking_type varchar(50) NOT NULL DEFAULT 'regular' CHECK (booking_type IN ('regular', 'lesson', 'tournament', 'maintenance', 'blocked')),
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_pattern jsonb,
  number_of_players integer NOT NULL DEFAULT 2,
  notes text,
  payment_status varchar(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'waived')),
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  cancelled_at timestamp,
  cancellation_reason text,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

-- ============================================
-- WAITLIST ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  court_id uuid REFERENCES courts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time timestamp NOT NULL,
  end_time timestamp NOT NULL,
  number_of_players integer NOT NULL DEFAULT 2,
  status varchar(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'accepted', 'declined', 'expired')),
  priority integer NOT NULL DEFAULT 0,
  notes text,
  offered_at timestamp,
  expires_at timestamp,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

-- ============================================
-- COURT AVAILABILITY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS court_availability (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  UNIQUE(court_id, day_of_week, start_time, end_time),
  CHECK (end_time > start_time)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Court types indexes
CREATE INDEX IF NOT EXISTS idx_court_types_surface_type ON court_types(surface_type);
CREATE INDEX IF NOT EXISTS idx_court_types_is_active ON court_types(is_active);

-- Courts indexes
CREATE INDEX IF NOT EXISTS idx_courts_club_id ON courts(club_id);
CREATE INDEX IF NOT EXISTS idx_courts_court_type_id ON courts(court_type_id);
CREATE INDEX IF NOT EXISTS idx_courts_status ON courts(status);
CREATE INDEX IF NOT EXISTS idx_courts_is_active ON courts(is_active);
CREATE INDEX IF NOT EXISTS idx_courts_club_number ON courts(club_id, number);

-- Booking rules indexes
CREATE INDEX IF NOT EXISTS idx_booking_rules_club_id ON booking_rules(club_id);
CREATE INDEX IF NOT EXISTS idx_booking_rules_is_active ON booking_rules(is_active);

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_club_id ON bookings(club_id);
CREATE INDEX IF NOT EXISTS idx_bookings_court_id ON bookings(court_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_end_time ON bookings(end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_number ON bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_bookings_club_court_time ON bookings(club_id, court_id, start_time, end_time);

-- Waitlist entries indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_club_id ON waitlist_entries(club_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_court_id ON waitlist_entries(court_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_user_id ON waitlist_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_status ON waitlist_entries(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_start_time ON waitlist_entries(start_time);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_priority ON waitlist_entries(priority);

-- Court availability indexes
CREATE INDEX IF NOT EXISTS idx_court_availability_court_id ON court_availability(court_id);
CREATE INDEX IF NOT EXISTS idx_court_availability_day_of_week ON court_availability(day_of_week);
CREATE INDEX IF NOT EXISTS idx_court_availability_is_available ON court_availability(is_available);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all court booking tables
ALTER TABLE court_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_availability ENABLE ROW LEVEL SECURITY;

-- Court types policies (read-only for all authenticated users)
CREATE POLICY "authenticated_users_can_view_court_types" ON court_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Courts policies
CREATE POLICY "club_members_can_view_courts" ON courts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = courts.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

CREATE POLICY "admins_can_manage_courts" ON courts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = courts.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- Booking rules policies
CREATE POLICY "club_members_can_view_booking_rules" ON booking_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = booking_rules.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

CREATE POLICY "admins_can_manage_booking_rules" ON booking_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = booking_rules.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- Bookings policies
CREATE POLICY "users_can_view_own_bookings" ON bookings
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = bookings.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "users_can_create_bookings" ON bookings
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = bookings.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

CREATE POLICY "users_can_update_own_bookings" ON bookings
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = bookings.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- Waitlist entries policies
CREATE POLICY "users_can_view_own_waitlist_entries" ON waitlist_entries
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = waitlist_entries.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "users_can_create_waitlist_entries" ON waitlist_entries
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = waitlist_entries.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

CREATE POLICY "users_can_update_own_waitlist_entries" ON waitlist_entries
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = waitlist_entries.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- Court availability policies
CREATE POLICY "club_members_can_view_court_availability" ON court_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM courts c
      JOIN user_club_memberships ucm ON ucm.club_id = c.club_id
      WHERE c.id = court_availability.court_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

CREATE POLICY "admins_can_manage_court_availability" ON court_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM courts c
      JOIN user_club_memberships ucm ON ucm.club_id = c.club_id
      WHERE c.id = court_availability.court_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_court_types_updated_at BEFORE UPDATE ON court_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courts_updated_at BEFORE UPDATE ON courts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_rules_updated_at BEFORE UPDATE ON booking_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waitlist_entries_updated_at BEFORE UPDATE ON waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_court_availability_updated_at BEFORE UPDATE ON court_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS FOR BOOKING NUMBER GENERATION
-- ============================================

CREATE OR REPLACE FUNCTION generate_booking_number(p_club_id uuid)
RETURNS varchar AS $$
DECLARE
  v_year varchar(4);
  v_month varchar(2);
  v_sequence integer;
  v_booking_number varchar(50);
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_month := TO_CHAR(CURRENT_DATE, 'MM');
  
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_sequence
  FROM (
    SELECT 
      CAST(SUBSTRING(booking_number FROM 12 FOR 5) AS integer) as sequence_number
    FROM bookings
    WHERE club_id = p_club_id
    AND booking_number LIKE 'BK-' || v_year || v_month || '-%'
  ) sub;
  
  v_booking_number := 'BK-' || v_year || v_month || '-' || LPAD(v_sequence::text, 5, '0');
  
  RETURN v_booking_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTIONS FOR BOOKING VALIDATION
-- ============================================

CREATE OR REPLACE FUNCTION validate_booking_availability(
  p_court_id uuid,
  p_start_time timestamp,
  p_end_time timestamp,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_conflict_count integer;
BEGIN
  SELECT COUNT(*) INTO v_conflict_count
  FROM bookings
  WHERE court_id = p_court_id
    AND status IN ('confirmed', 'pending')
    AND (
      (start_time < p_end_time AND end_time > p_start_time)
    )
    AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id);
  
  RETURN v_conflict_count = 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTIONS FOR COURT AVAILABILITY
-- ============================================

CREATE OR REPLACE FUNCTION get_court_availability(
  p_court_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  date date,
  day_of_week integer,
  start_time time,
  end_time time,
  is_available boolean
) AS $$
BEGIN
  RETURN QUERY
  WITH dates AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date as date
  ),
  availability AS (
    SELECT
      d.date,
      EXTRACT(DOW FROM d.date)::integer as day_of_week,
      ca.start_time,
      ca.end_time,
      ca.is_available
    FROM dates d
    LEFT JOIN court_availability ca ON ca.court_id = p_court_id AND ca.day_of_week = EXTRACT(DOW FROM d.date)::integer
  )
  SELECT * FROM availability
  ORDER BY date, start_time;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTIONS FOR WAITLIST MANAGEMENT
-- ============================================

CREATE OR REPLACE FUNCTION check_waitlist_availability(
  p_court_id uuid,
  p_start_time timestamp,
  p_end_time timestamp
)
RETURNS boolean AS $$
DECLARE
  v_is_available boolean;
BEGIN
  v_is_available := validate_booking_availability(p_court_id, p_start_time, p_end_time);
  RETURN NOT v_is_available;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DEFAULT COURT TYPES
-- ============================================

INSERT INTO court_types (name, description, surface_type, is_indoor, is_outdoor, requires_lighting, max_players, hourly_rate) VALUES
('Sandplatz (Clay)', 'Tennisplatz mit Sandbelag', 'clay', false, true, true, 4, 15.00),
('Hartplatz (Hard)', 'Tennisplatz mit Hartbelag', 'hard', true, true, false, 4, 20.00),
('Rasenplatz (Grass)', 'Tennisplatz mit Rasenbelag', 'grass', false, true, false, 4, 25.00),
('Teppichplatz (Carpet)', 'Tennisplatz mit Teppichbelag', 'carpet', true, true, false, 4, 18.00),
('Kunstrasenplatz', 'Tennisplatz mit Kunstrasen', 'artificial_grass', true, true, false, 4, 22.00)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE court_types IS 'Types of tennis courts with surface and pricing information';
COMMENT ON TABLE courts IS 'Individual tennis courts belonging to clubs';
COMMENT ON TABLE booking_rules IS 'Rules governing court bookings for each club';
COMMENT ON TABLE bookings IS 'Court bookings with time slots and status';
COMMENT ON TABLE waitlist_entries IS 'Waitlist entries for fully booked time slots';
COMMENT ON TABLE court_availability IS 'Availability schedule for each court';

COMMENT ON COLUMN courts.status IS 'Court status: available, maintenance, closed, reserved';
COMMENT ON COLUMN bookings.status IS 'Booking status: pending, confirmed, cancelled, completed, no_show';
COMMENT ON COLUMN bookings.booking_type IS 'Booking type: regular, lesson, tournament, maintenance, blocked';
COMMENT ON COLUMN waitlist_entries.status IS 'Waitlist status: waiting, offered, accepted, declined, expired';
COMMENT ON COLUMN waitlist_entries.priority IS 'Waitlist priority: higher numbers = higher priority';
