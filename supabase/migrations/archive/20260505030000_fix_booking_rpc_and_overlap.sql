-- Fix 1: Update create_booking_safe RPC to include session_start_time and court_id
CREATE OR REPLACE FUNCTION create_booking_safe(
  p_member_id uuid,
  p_session_id uuid,
  p_club_id uuid,
  p_schedule_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_booking_id uuid;
  v_current_count int;
  v_max_participants int;
  v_session_start timestamptz;
  v_court_id uuid;
BEGIN
  SELECT max_participants, timeslot_start, court_id
  INTO v_max_participants, v_session_start, v_court_id
  FROM sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  IF v_session_start < NOW() THEN
    RAISE EXCEPTION 'Cannot book past sessions';
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM bookings
  WHERE session_id = p_session_id
    AND status IN ('confirmed', 'pending');

  IF v_current_count >= v_max_participants THEN
    RAISE EXCEPTION 'Session is full (%/%)', v_current_count, v_max_participants;
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE member_id = p_member_id
      AND session_id = p_session_id
      AND status NOT IN ('cancelled')
  ) THEN
    RAISE EXCEPTION 'Member already has an active booking for this session';
  END IF;

  INSERT INTO bookings (
    member_id, session_id, club_id, schedule_id,
    court_id, session_start_time,
    status, booked_at
  )
  VALUES (
    p_member_id, p_session_id, p_club_id, p_schedule_id,
    v_court_id, v_session_start,
    'pending', NOW()
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- Fix 2: Trigger-based overlap prevention for bookings (safety net below RPC)
-- Prevents INSERT/UPDATE that would create overlapping bookings on the same court
CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session_end timestamptz;
  v_conflict_count int;
BEGIN
  -- Only check confirmed and pending bookings
  IF NEW.status NOT IN ('confirmed', 'pending') THEN
    RETURN NEW;
  END IF;

  -- Get the session end time
  SELECT timeslot_end::timestamptz INTO v_session_end
  FROM sessions WHERE id = NEW.session_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Check for overlapping confirmed/pending bookings on the same court
  -- Exclude the current booking (for UPDATEs)
  SELECT COUNT(*) INTO v_conflict_count
  FROM bookings b
  JOIN sessions s ON s.id = b.session_id
  WHERE b.court_id = NEW.court_id
    AND b.id != NEW.id
    AND b.status IN ('confirmed', 'pending')
    AND b.session_start_time < v_session_end
    AND s.timeslot_end::timestamptz > NEW.session_start_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Booking overlaps with % existing booking(s) on this court', v_conflict_count;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_check_booking_overlap ON bookings;
CREATE TRIGGER trg_check_booking_overlap
  BEFORE INSERT OR UPDATE OF status, session_start_time, court_id, session_id
  ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_overlap();
