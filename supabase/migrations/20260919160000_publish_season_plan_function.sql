-- publish_season_plan (ADR-005): Veröffentlichen eines Saisonplans atomar in EINER Transaktion.
-- Die Berechnung (Termine, Ferien, Buchungen) macht die App (lib/season-planning/publish-plan.ts)
-- und übergibt fertige Zeilen; die Funktion schreibt sie. SECURITY INVOKER: RLS des Aufrufers
-- gilt (Admin des Vereins); Owner rufen sie mit dem Service-Client auf.
-- Ersetzt die Drizzle-Transaktion in app/api/seasons/[id]/planning/confirm.

CREATE OR REPLACE FUNCTION publish_season_plan(
  p_season_id uuid,
  p_republish boolean,
  p_now timestamptz,
  p_schedule jsonb,      -- { season_type, season_year, season_start_date, season_end_date }
  p_sessions jsonb,      -- [{ id, trainer_id, group_ids, week_number, timeslot_start, timeslot_end,
                         --    court_id, max_participants, notes, plan_entry_id }]
  p_bookings jsonb,      -- [{ id?, member_id, session_id, court_id, session_start_time, start_time, end_time, ... }]
  p_entry_updates jsonb, -- [{ id, sid }]  (Planeintrag → erste Session)
  p_conflicts jsonb,     -- [{ conflict_type, severity, ... }]  offene Konflikte
  p_history jsonb        -- Zeile für season_planning_history (ohne season_id/club_id)
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_club uuid;
  v_schedule uuid;
  v_removed integer := 0;
BEGIN
  SELECT club_id INTO v_club FROM seasons WHERE id = p_season_id;
  IF v_club IS NULL THEN
    RAISE EXCEPTION 'Saison nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  -- 1. Erneutes Veröffentlichen: künftige Sessions samt Buchungen verwerfen.
  IF p_republish THEN
    WITH stale AS (
      SELECT s.id FROM sessions s
      JOIN season_plan_entries e ON e.id = s.plan_entry_id
      WHERE e.season_id = p_season_id AND s.timeslot_start >= (p_now AT TIME ZONE 'UTC')
    ), del_b AS (
      DELETE FROM bookings WHERE session_id IN (SELECT id FROM stale)
    ), del_s AS (
      DELETE FROM sessions WHERE id IN (SELECT id FROM stale) RETURNING 1
    )
    SELECT count(*) INTO v_removed FROM del_s;
  END IF;

  -- 2. Schedule finden oder anlegen (Saisontyp gehört in den Schlüssel).
  IF jsonb_array_length(p_sessions) > 0 THEN
    SELECT id INTO v_schedule FROM schedules
    WHERE club_id = v_club
      AND season_year = (p_schedule->>'season_year')::int
      AND season_type = p_schedule->>'season_type'
    LIMIT 1;
    IF v_schedule IS NULL THEN
      INSERT INTO schedules (club_id, season_type, season_year, season_start_date, season_end_date, is_active)
      VALUES (v_club, p_schedule->>'season_type', (p_schedule->>'season_year')::int,
              (p_schedule->>'season_start_date')::timestamp, (p_schedule->>'season_end_date')::timestamp, true)
      RETURNING id INTO v_schedule;
    END IF;

    -- 3. Sessions und Buchungen (IDs stammen aus der App, damit Verweise passen).
    INSERT INTO sessions (id, schedule_id, trainer_id, group_ids, week_number, timeslot_start,
                          timeslot_end, court_id, max_participants, notes, plan_entry_id)
    SELECT r.id, v_schedule, r.trainer_id, r.group_ids, r.week_number, r.timeslot_start,
           r.timeslot_end, r.court_id, r.max_participants, r.notes, r.plan_entry_id
    FROM jsonb_populate_recordset(null::sessions, p_sessions) r;

    INSERT INTO bookings (club_id, member_id, schedule_id, session_id, court_id, status, booking_type,
                          is_recurring, session_start_time, start_time, end_time, notes)
    SELECT v_club, r.member_id, v_schedule, r.session_id, r.court_id, 'confirmed', 'session',
           true, r.session_start_time, r.start_time, r.end_time, r.notes
    FROM jsonb_populate_recordset(null::bookings, p_bookings) r;

    UPDATE season_plan_entries e
    SET status = 'published', published_session_id = u.sid, published_at = p_now
    FROM jsonb_to_recordset(p_entry_updates) AS u(id uuid, sid uuid)
    WHERE e.id = u.id AND e.season_id = p_season_id;
  END IF;

  -- 4. Saison-Status: höchstens eine aktive Saison je Verein.
  UPDATE seasons SET is_active = false WHERE club_id = v_club AND is_active = true;
  UPDATE seasons SET planning_status = 'published', published_at = p_now, is_active = true
  WHERE id = p_season_id;

  -- 5. Offene Konflikte ersetzen (gelöste/ignorierte bleiben).
  DELETE FROM planning_conflicts WHERE season_id = p_season_id AND status = 'open';
  INSERT INTO planning_conflicts (season_id, club_id, conflict_type, severity, affected_plan_entry_ids,
                                  affected_trainer_id, affected_court_id, affected_user_ids,
                                  affected_group_ids, conflict_time_slot, description,
                                  suggested_resolution, status, detection_source)
  SELECT p_season_id, v_club, r.conflict_type, r.severity, r.affected_plan_entry_ids,
         r.affected_trainer_id, r.affected_court_id, r.affected_user_ids, r.affected_group_ids,
         r.conflict_time_slot, r.description, r.suggested_resolution, 'open', 'auto_planner'
  FROM jsonb_populate_recordset(null::planning_conflicts, p_conflicts) r;

  -- 6. Protokoll. Die Zahl der verworfenen Sessions kennt erst die Funktion.
  INSERT INTO season_planning_history (season_id, club_id, action_type, actor_id, actor_role, details,
                                       entries_affected, conflicts_created, conflicts_resolved, notes)
  SELECT p_season_id, v_club, 'plan_published', r.actor_id, r.actor_role,
         coalesce(r.details, '{}'::jsonb) || jsonb_build_object('removedSessions', v_removed),
         r.entries_affected, r.conflicts_created, r.conflicts_resolved,
         CASE WHEN p_republish
           THEN format('Plan erneut veröffentlicht: %s künftige Sessions ersetzt durch %s neue', v_removed, r.entries_affected)
           ELSE format('Plan veröffentlicht: %s Sessions aus %s Einträgen', r.entries_affected, r.notes)
         END
  FROM jsonb_populate_record(null::season_planning_history, p_history) r;

  RETURN jsonb_build_object('removed_sessions', v_removed, 'schedule_id', v_schedule);
END;
$$;
