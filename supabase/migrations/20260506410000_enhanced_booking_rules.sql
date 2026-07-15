-- Enhanced Booking Rules Migration
-- Based on TSOWAPP analysis - role-based booking restrictions
-- Created: 2026-05-06

-- ============================================
-- ALTER BOOKING_RULES TABLE
-- Add role-based booking restrictions
-- ============================================

-- Add role column to differentiate rules per role
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS role varchar(20) DEFAULT 'member' 
  CHECK (role IN ('member', 'trainer', 'admin', 'guest'));

-- Add more granular booking controls
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS min_advance_booking_hours integer NOT NULL DEFAULT 1;
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS allow_weekend_booking boolean NOT NULL DEFAULT true;
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS weekend_advance_days integer NOT NULL DEFAULT 7;
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS allow_prime_time_booking boolean NOT NULL DEFAULT true;
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS prime_time_start time DEFAULT '17:00:00';
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS prime_time_end time DEFAULT '21:00:00';
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS max_concurrent_bookings integer NOT NULL DEFAULT 3;
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS allow_partner_booking boolean NOT NULL DEFAULT true;
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS require_approval boolean NOT NULL DEFAULT false;

-- Add priority field for conflicting rules (higher = more important)
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;

-- Add booking slot configuration
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS allowed_time_slots jsonb DEFAULT '[]'::jsonb;
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS blocked_time_slots jsonb DEFAULT '[]'::jsonb;

-- Add seasonal restrictions
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS season_start_date date;
ALTER TABLE booking_rules ADD COLUMN IF NOT EXISTS season_end_date date;

-- Make club-role combination unique
DROP INDEX IF EXISTS idx_booking_rules_club_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_rules_club_role ON booking_rules(club_id, role) WHERE is_active = true;

-- ============================================
-- CREATE MEMBER PREFERENCES TABLE
-- For storing member booking preferences
-- ============================================

CREATE TABLE IF NOT EXISTS member_booking_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  preferred_courts uuid[] DEFAULT '{}',
  preferred_time_slots jsonb DEFAULT '[]'::jsonb,
  preferred_partners uuid[] DEFAULT '{}',
  avoid_partners uuid[] DEFAULT '{}',
  notification_preferences jsonb DEFAULT '{
    "booking_confirmed": true,
    "booking_cancelled": true,
    "waitlist_available": true,
    "reminder_24h": true,
    "reminder_1h": false
  }'::jsonb,
  auto_cancel_no_show boolean NOT NULL DEFAULT false,
  default_booking_duration integer NOT NULL DEFAULT 90,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, club_id)
);

-- ============================================
-- CREATE BOOKING RESTRICTIONS TABLE
-- For temporary restrictions (holidays, maintenance)
-- ============================================

CREATE TABLE IF NOT EXISTS booking_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  court_id uuid REFERENCES courts(id) ON DELETE CASCADE, -- NULL = applies to all courts
  restriction_type varchar(50) NOT NULL CHECK (restriction_type IN ('holiday', 'maintenance', 'event', 'weather', 'other')),
  name varchar(200) NOT NULL,
  description text,
  start_datetime timestamp NOT NULL,
  end_datetime timestamp NOT NULL,
  affects_existing_bookings boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  CHECK (end_datetime > start_datetime)
);

-- ============================================
-- INDEXES
-- ============================================

-- Member booking preferences indexes
CREATE INDEX IF NOT EXISTS idx_member_booking_prefs_user_id ON member_booking_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_member_booking_prefs_club_id ON member_booking_preferences(club_id);

-- Booking restrictions indexes
CREATE INDEX IF NOT EXISTS idx_booking_restrictions_club_id ON booking_restrictions(club_id);
CREATE INDEX IF NOT EXISTS idx_booking_restrictions_court_id ON booking_restrictions(court_id);
CREATE INDEX IF NOT EXISTS idx_booking_restrictions_type ON booking_restrictions(restriction_type);
CREATE INDEX IF NOT EXISTS idx_booking_restrictions_dates ON booking_restrictions(start_datetime, end_datetime);
CREATE INDEX IF NOT EXISTS idx_booking_restrictions_active ON booking_restrictions(is_active);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE member_booking_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_restrictions ENABLE ROW LEVEL SECURITY;

-- Member booking preferences policies
DROP POLICY IF EXISTS "users_can_view_own_booking_preferences" ON member_booking_preferences;
CREATE POLICY "users_can_view_own_booking_preferences" ON member_booking_preferences
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_can_manage_own_booking_preferences" ON member_booking_preferences;
CREATE POLICY "users_can_manage_own_booking_preferences" ON member_booking_preferences
  FOR ALL USING (user_id = auth.uid());

-- Booking restrictions policies
DROP POLICY IF EXISTS "club_members_can_view_restrictions" ON booking_restrictions;
CREATE POLICY "club_members_can_view_restrictions" ON booking_restrictions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = booking_restrictions.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins_can_manage_restrictions" ON booking_restrictions;
CREATE POLICY "admins_can_manage_restrictions" ON booking_restrictions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = booking_restrictions.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_member_booking_prefs_updated_at ON member_booking_preferences;
CREATE TRIGGER update_member_booking_prefs_updated_at BEFORE UPDATE ON member_booking_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_booking_restrictions_updated_at ON booking_restrictions;
CREATE TRIGGER update_booking_restrictions_updated_at BEFORE UPDATE ON booking_restrictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ENHANCED BOOKING VALIDATION FUNCTION
-- Now checks restrictions and role-based rules
-- ============================================

CREATE OR REPLACE FUNCTION validate_booking_rules(
  p_user_id uuid,
  p_club_id uuid,
  p_court_id uuid,
  p_start_time timestamp,
  p_end_time timestamp,
  p_booking_id uuid DEFAULT NULL
)
RETURNS TABLE (
  is_valid boolean,
  error_code varchar,
  error_message text
) AS $$
DECLARE
  v_user_role varchar;
  v_booking_rule record;
  v_booking_count_day integer;
  v_booking_count_week integer;
  v_duration_minutes integer;
  v_advance_days integer;
  v_day_of_week integer;
  v_restriction_count integer;
BEGIN
  -- Get user role for this club
  SELECT ucm.role INTO v_user_role
  FROM user_club_memberships ucm
  WHERE ucm.user_id = p_user_id
    AND ucm.club_id = p_club_id
    AND ucm.is_active = true
  ORDER BY 
    CASE ucm.role
      WHEN 'superadmin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'trainer' THEN 3
      WHEN 'member' THEN 4
      ELSE 5
    END
  LIMIT 1;

  IF v_user_role IS NULL THEN
    RETURN QUERY SELECT false, 'NO_MEMBERSHIP'::varchar, 'User has no active membership in this club'::text;
    RETURN;
  END IF;

  -- Get booking rule for this role
  SELECT * INTO v_booking_rule
  FROM booking_rules
  WHERE club_id = p_club_id
    AND role = v_user_role
    AND is_active = true
  ORDER BY priority DESC
  LIMIT 1;

  IF v_booking_rule IS NULL THEN
    -- Use default member rules if no specific rule exists
    SELECT * INTO v_booking_rule
    FROM booking_rules
    WHERE club_id = p_club_id
      AND role = 'member'
      AND is_active = true
    ORDER BY priority DESC
    LIMIT 1;
  END IF;

  IF v_booking_rule IS NULL THEN
    RETURN QUERY SELECT false, 'NO_RULES'::varchar, 'No booking rules configured for this club'::text;
    RETURN;
  END IF;

  -- Check duration
  v_duration_minutes := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60;
  
  IF v_duration_minutes < v_booking_rule.min_booking_duration_minutes THEN
    RETURN QUERY SELECT false, 'DURATION_TOO_SHORT'::varchar, 
      format('Booking duration must be at least %s minutes', v_booking_rule.min_booking_duration_minutes)::text;
    RETURN;
  END IF;

  IF v_duration_minutes > v_booking_rule.max_booking_duration_minutes THEN
    RETURN QUERY SELECT false, 'DURATION_TOO_LONG'::varchar,
      format('Booking duration cannot exceed %s minutes', v_booking_rule.max_booking_duration_minutes)::text;
    RETURN;
  END IF;

  -- Check advance booking
  v_advance_days := EXTRACT(DAY FROM (p_start_time::date - CURRENT_DATE));
  
  IF v_advance_days > v_booking_rule.advance_booking_days THEN
    RETURN QUERY SELECT false, 'TOO_FAR_ADVANCE'::varchar,
      format('Bookings can only be made %s days in advance', v_booking_rule.advance_booking_days)::text;
    RETURN;
  END IF;

  IF EXTRACT(EPOCH FROM (p_start_time - NOW())) / 3600 < v_booking_rule.min_advance_booking_hours THEN
    RETURN QUERY SELECT false, 'TOO_SOON'::varchar,
      format('Bookings must be made at least %s hours in advance', v_booking_rule.min_advance_booking_hours)::text;
    RETURN;
  END IF;

  -- Check weekend restrictions
  v_day_of_week := EXTRACT(DOW FROM p_start_time::date);
  IF v_day_of_week IN (0, 6) AND NOT v_booking_rule.allow_weekend_booking THEN
    RETURN QUERY SELECT false, 'WEEKEND_NOT_ALLOWED'::varchar, 'Weekend bookings are not allowed'::text;
    RETURN;
  END IF;

  -- Check bookings per day
  SELECT COUNT(*) INTO v_booking_count_day
  FROM bookings
  WHERE user_id = p_user_id
    AND club_id = p_club_id
    AND DATE(start_time) = DATE(p_start_time)
    AND status IN ('confirmed', 'pending')
    AND (p_booking_id IS NULL OR id != p_booking_id);

  IF v_booking_count_day >= v_booking_rule.max_bookings_per_day THEN
    RETURN QUERY SELECT false, 'MAX_DAILY_BOOKINGS'::varchar,
      format('Maximum %s bookings per day reached', v_booking_rule.max_bookings_per_day)::text;
    RETURN;
  END IF;

  -- Check bookings per week
  SELECT COUNT(*) INTO v_booking_count_week
  FROM bookings
  WHERE user_id = p_user_id
    AND club_id = p_club_id
    AND DATE(start_time) >= DATE(p_start_time) - INTERVAL '7 days'
    AND DATE(start_time) <= DATE(p_start_time) + INTERVAL '7 days'
    AND status IN ('confirmed', 'pending')
    AND (p_booking_id IS NULL OR id != p_booking_id);

  IF v_booking_count_week >= v_booking_rule.max_bookings_per_week THEN
    RETURN QUERY SELECT false, 'MAX_WEEKLY_BOOKINGS'::varchar,
      format('Maximum %s bookings per week reached', v_booking_rule.max_bookings_per_week)::text;
    RETURN;
  END IF;

  -- Check restrictions (holidays, maintenance, etc.)
  SELECT COUNT(*) INTO v_restriction_count
  FROM booking_restrictions
  WHERE club_id = p_club_id
    AND (court_id IS NULL OR court_id = p_court_id)
    AND is_active = true
    AND (
      (start_datetime <= p_start_time AND end_datetime >= p_start_time)
      OR (start_datetime <= p_end_time AND end_datetime >= p_end_time)
      OR (start_datetime >= p_start_time AND end_datetime <= p_end_time)
    );

  IF v_restriction_count > 0 THEN
    RETURN QUERY SELECT false, 'TIME_RESTRICTED'::varchar, 'This time slot is blocked due to maintenance or special event'::text;
    RETURN;
  END IF;

  -- Check court availability conflict
  IF NOT validate_booking_availability(p_court_id, p_start_time, p_end_time, p_booking_id) THEN
    RETURN QUERY SELECT false, 'TIME_CONFLICT'::varchar, 'This time slot is already booked'::text;
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT true, NULL::varchar, NULL::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DEFAULT BOOKING RULES FOR EACH ROLE
-- ============================================

COMMENT ON TABLE booking_rules IS 'Role-based rules governing court bookings';
COMMENT ON TABLE member_booking_preferences IS 'User preferences for court bookings and notifications';
COMMENT ON TABLE booking_restrictions IS 'Temporary restrictions on bookings (holidays, maintenance, events)';

COMMENT ON COLUMN booking_rules.role IS 'User role this rule applies to: member, trainer, admin, guest';
COMMENT ON COLUMN booking_rules.priority IS 'Rule priority for conflict resolution (higher = more important)';
COMMENT ON COLUMN booking_rules.min_advance_booking_hours IS 'Minimum hours in advance for booking';
COMMENT ON COLUMN booking_rules.max_concurrent_bookings IS 'Maximum simultaneous active bookings';
COMMENT ON COLUMN booking_rules.require_approval IS 'Whether bookings require admin approval';
