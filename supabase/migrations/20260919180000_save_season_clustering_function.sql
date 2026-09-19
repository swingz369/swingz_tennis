-- save_season_clustering (ADR-005): Speichern eines Clustering-Laufs atomar in EINER Transaktion.
-- Die Berechnung macht die App (lib/season-planning/clustering-engine.ts) und übergibt fertige
-- Zeilen; die Funktion ersetzt Planeinträge und Wartelisten der Saison, legt neue Gruppen an und
-- benennt Gruppen um. Vorher liefen diese Schritte einzeln — ein Abbruch mittendrin hinterließ
-- eine Saison ohne Planeinträge oder mit halb angelegten Gruppen. SECURITY INVOKER: RLS des
-- Aufrufers gilt (Admin des Vereins); Owner rufen sie mit dem Service-Client auf.
--
-- Der Auto-Planer nutzt dieselbe Funktion (ohne Gruppen: Einträge tragen `group_id` direkt) und
-- schreibt zusätzlich Konflikte und Verlauf. Gruppen werden über einen Schlüssel (`key`, frei wählbarer Text je Aufruf) referenziert, weil
-- neue Gruppen erst hier ihre ID bekommen. Rückgabe: { groups: { key: id }, removed_sessions }.

CREATE OR REPLACE FUNCTION save_season_clustering(
  p_season_id uuid,
  p_now timestamptz,
  p_groups jsonb,    -- [{ key, existing_id?, name?, level?, age_group? }]  name bei existing_id = Umbenennung
  p_entries jsonb,   -- [{ group_key, trainer_id, court_id, day_of_week, start_time, end_time,
                     --    duration_minutes, entry_type, max_participants, expected_participants,
                     --    preference_match_score, optimization_score, conflict_score }]
  p_waitlist jsonb,  -- [{ group_key, alternative_group_key?, member_id, position, priority, priority_reason }]
  p_conflicts jsonb DEFAULT '[]'::jsonb,  -- [{ conflict_type, severity, description }]  offene Konflikte (Auto-Planer)
  p_history jsonb DEFAULT NULL            -- Zeile für season_planning_history (ohne season_id/club_id)
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_club uuid;
  v_removed integer := 0;
  v_map jsonb := '{}'::jsonb;
  g record;
  v_id uuid;
BEGIN
  SELECT club_id INTO v_club FROM seasons WHERE id = p_season_id;
  IF v_club IS NULL THEN
    RAISE EXCEPTION 'Saison nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  -- 1. Künftige veröffentlichte Einheiten samt Buchungen verwerfen (sonst kollidieren sie beim
  --    nächsten Veröffentlichen mit den neuen Terminen); stattgefundene bleiben Historie.
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

  -- 2. Bisherige Planeinträge und Wartelisten der Saison ersetzen.
  DELETE FROM season_plan_entries WHERE season_id = p_season_id;
  DELETE FROM season_waitlists WHERE season_id = p_season_id;

  -- 3. Gruppen: bestehende ggf. umbenennen, neue anlegen; Schlüssel → ID merken.
  FOR g IN SELECT * FROM jsonb_to_recordset(p_groups)
    AS x(key text, existing_id uuid, name text, level text, age_group text)
  LOOP
    IF g.existing_id IS NOT NULL THEN
      IF g.name IS NOT NULL THEN
        UPDATE groups SET name = g.name WHERE id = g.existing_id AND club_id = v_club;
      END IF;
      v_id := g.existing_id;
    ELSE
      INSERT INTO groups (club_id, name, level, age_group, is_active, member_ids)
      VALUES (v_club, g.name, g.level, g.age_group, true, '{}')
      RETURNING id INTO v_id;
    END IF;
    v_map := v_map || jsonb_build_object(g.key, v_id);
  END LOOP;

  -- 4. Planeinträge.
  INSERT INTO season_plan_entries (
    season_id, club_id, trainer_id, court_id, group_id, day_of_week, start_time, end_time,
    duration_minutes, starts_from_week, ends_at_week, entry_type, planning_source, max_participants,
    expected_participants, preference_match_score, optimization_score, conflict_score, status
  )
  SELECT p_season_id, v_club, e.trainer_id, e.court_id, COALESCE((v_map ->> e.group_key)::uuid, e.group_id), e.day_of_week,
         e.start_time, e.end_time, e.duration_minutes, 1, NULL, e.entry_type, 'auto',
         e.max_participants, e.expected_participants, e.preference_match_score,
         e.optimization_score, e.conflict_score, 'planned'
  FROM jsonb_to_recordset(p_entries) AS e(
    group_key text, group_id uuid, trainer_id uuid, court_id uuid, day_of_week int, start_time time, end_time time,
    duration_minutes int, entry_type text, max_participants int, expected_participants jsonb,
    preference_match_score numeric, optimization_score numeric, conflict_score numeric
  );

  -- 5. Warteliste.
  INSERT INTO season_waitlists (
    season_id, club_id, group_id, member_id, position, priority, priority_reason, status,
    alternative_group_id
  )
  SELECT p_season_id, v_club, (v_map ->> w.group_key)::uuid, w.member_id, w.position, w.priority,
         w.priority_reason, 'waiting', (v_map ->> w.alternative_group_key)::uuid
  FROM jsonb_to_recordset(p_waitlist) AS w(
    group_key text, alternative_group_key text, member_id uuid, position int, priority int,
    priority_reason text
  );

  -- 6. Konflikte und Verlauf (nur Auto-Planer).
  INSERT INTO planning_conflicts (season_id, club_id, conflict_type, severity, affected_plan_entry_ids,
                                  description, status, detection_source)
  SELECT p_season_id, v_club, c.conflict_type, c.severity, '[]'::jsonb, c.description, 'open',
         'auto_planner'
  FROM jsonb_to_recordset(p_conflicts) AS c(conflict_type text, severity text, description text);

  IF p_history IS NOT NULL THEN
    INSERT INTO season_planning_history (season_id, club_id, action_type, details, entries_affected,
                                         conflicts_created, algorithm_metrics)
    SELECT p_season_id, v_club, h.action_type, h.details, h.entries_affected, h.conflicts_created,
           h.algorithm_metrics
    FROM jsonb_to_recordset(jsonb_build_array(p_history)) AS h(
      action_type text, details jsonb, entries_affected int, conflicts_created int,
      algorithm_metrics jsonb
    );
  END IF;

  -- 7. Saison-Status.
  UPDATE seasons SET planning_status = 'manual_review', last_planned_at = (p_now AT TIME ZONE 'UTC')
  WHERE id = p_season_id;

  RETURN jsonb_build_object('groups', v_map, 'removed_sessions', v_removed);
END;
$$;
