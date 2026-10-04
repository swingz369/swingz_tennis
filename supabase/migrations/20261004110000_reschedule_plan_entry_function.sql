-- Eine veröffentlichte Trainingsgruppe verschieben: künftige Termine und die Planvorlage, atomar.
-- Vorher eine Drizzle-Transaktion (Port 6543, RLS umgangen). Die Zeiten rechnet der Service
-- (Berliner Wandzeit, lib/berlin-time.ts); die Funktion schreibt nur.
-- SECURITY INVOKER: RLS des Aufrufers gilt (sessions_update = is_club_trainer inkl. Admin,
-- season_plan_entries = Admin des Vereins). Ein Termin, den RLS ausblendet oder der nicht zum
-- Eintrag gehört, bricht die ganze Verschiebung ab.
CREATE OR REPLACE FUNCTION public.reschedule_plan_entry(
  p_entry_id uuid,
  p_entry jsonb,
  p_moves jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE sessions s
     SET timeslot_start = (m->>'start')::timestamptz,
         timeslot_end   = (m->>'end')::timestamptz,
         trainer_id     = (p_entry->>'trainer_id')::uuid,
         court_id       = (p_entry->>'court_id')::uuid,
         updated_at     = now()
    FROM jsonb_array_elements(p_moves) m
   WHERE s.id = (m->>'id')::uuid
     AND s.plan_entry_id = p_entry_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> jsonb_array_length(p_moves) THEN
    RAISE EXCEPTION 'Nicht alle Termine konnten verschoben werden' USING ERRCODE = '42501';
  END IF;

  UPDATE season_plan_entries
     SET day_of_week = (p_entry->>'day_of_week')::integer,
         start_time  = (p_entry->>'start_time')::time,
         end_time    = (p_entry->>'end_time')::time,
         trainer_id  = (p_entry->>'trainer_id')::uuid,
         court_id    = (p_entry->>'court_id')::uuid,
         admin_notes = p_entry->>'admin_notes'
   WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan-Eintrag nicht gefunden oder keine Berechtigung' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_plan_entry(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_plan_entry(uuid, jsonb, jsonb) TO authenticated, service_role;
