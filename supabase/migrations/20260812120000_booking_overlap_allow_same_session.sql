-- Teilnehmer derselben Trainingseinheit sind kein Platzkonflikt
--
-- `check_booking_overlap()` (aus 20260505030000_fix_booking_rpc_and_overlap.sql)
-- lehnt jede Buchung ab, die sich mit einer bestehenden Buchung auf demselben
-- Platz zeitlich überschneidet. Das ist für Platzreservierungen richtig, macht
-- aber die Saisonplanung unmöglich: sie legt beim Veröffentlichen eine Buchung
-- JE TEILNEHMER an, alle auf demselben Platz zur selben Zeit. Ab dem zweiten
-- Teilnehmer brach die Transaktion mit
--   "Booking overlaps with N existing booking(s) on this court"
-- ab — in der Live-DB stehen deshalb 869 Trainingseinheiten aus veröffentlichten
-- Plänen, aber nur eine einzige Buchung.
--
-- Änderung: Buchungen, die zur SELBEN `session_id` gehören, zählen nicht mehr
-- als Konflikt. Eine fremde Buchung auf demselben Platz im selben Zeitfenster
-- weiterhin schon — der Schutz gegen echte Doppelbelegung bleibt vollständig.
--
-- Live-Zustand vor dieser Migration per pg_get_functiondef geprüft (AGENTS.md);
-- er war mit der Ursprungsmigration identisch.

CREATE OR REPLACE FUNCTION public.check_booking_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Exclude the current booking (for UPDATEs) and all bookings that belong to
  -- the same session (participants of one training share the court by design).
  SELECT COUNT(*) INTO v_conflict_count
  FROM bookings b
  JOIN sessions s ON s.id = b.session_id
  WHERE b.court_id = NEW.court_id
    AND b.id != NEW.id
    AND b.session_id IS DISTINCT FROM NEW.session_id
    AND b.status IN ('confirmed', 'pending')
    AND b.session_start_time < v_session_end
    AND s.timeslot_end::timestamptz > NEW.session_start_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Booking overlaps with % existing booking(s) on this court', v_conflict_count;
  END IF;

  RETURN NEW;
END;
$function$;
