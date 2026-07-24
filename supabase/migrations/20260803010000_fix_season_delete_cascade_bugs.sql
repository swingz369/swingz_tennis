-- Saison-Löschen schlug weiterhin mit 500 fehl, obwohl die RLS-DELETE-Policies aus
-- 20260803000000 schon live waren. Live-Diagnose (pg_get_functiondef, pg_constraint)
-- fand den eigentlichen Blocker:
--
-- 1) log_season_plan_entry_changes() (AFTER DELETE ON season_plan_entries) schreibt
--    bei JEDEM gelöschten Plan-Eintrag einen Audit-Datensatz nach
--    season_planning_history(season_id=OLD.season_id, ...). Beim Löschen einer Saison
--    cascadet Postgres zuerst die Saison weg, dann season_plan_entries — der Trigger
--    feuert danach und versucht, gegen eine bereits nicht mehr existierende seasons.id
--    zu inserten. season_planning_history.season_id hat FK ... REFERENCES seasons(id),
--    das INSERT verletzt also die FK und die gesamte DELETE-Transaktion scheitert.
--    Betraf JEDE Saison mit mindestens einem Plan-Eintrag (aktiv, in Planung, frisch
--    per Wizard angelegt) — exakt der gemeldete Fall bei TC Blau-Weiß Münster.
--    Fix: Audit-Insert nur schreiben, wenn die Saison noch existiert.
--
-- 2) invoices.season_id verweist per FK fälschlich auf schedules(id) statt seasons(id)
--    (Copy-Paste-Fehler in 20260519000000_billing_training_system.sql). Aktuell sind
--    alle 402 invoices.season_id-Werte NULL (verifiziert), der Fix ist also
--    datenunkritisch — aber die season-basierte Rechnungs-RPC (atomic_invoices_rpc,
--    p_season_id) kann mit der falschen FK nie erfolgreich gegen eine echte Saison
--    inserten. ON DELETE SET NULL bewusst beibehalten: Rechnungen sind Finanzbelege
--    und dürfen beim Löschen einer Saison NIEMALS mitgelöscht werden, nur die
--    Saison-Verknüpfung wird genullt.

CREATE OR REPLACE FUNCTION log_season_plan_entry_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO season_planning_history (
      season_id, club_id, action_type, entity_type, entity_id,
      changed_by, changes
    ) VALUES (
      NEW.season_id, NEW.club_id, 'created', 'plan_entry', NEW.id,
      auth.uid(), row_to_json(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO season_planning_history (
      season_id, club_id, action_type, entity_type, entity_id,
      changed_by, changes
    ) VALUES (
      NEW.season_id, NEW.club_id, 'updated', 'plan_entry', NEW.id,
      auth.uid(), jsonb_build_object(
        'old', row_to_json(OLD),
        'new', row_to_json(NEW)
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    -- Nur loggen, wenn die Saison noch existiert (kein Cascade-Delete des Parents).
    IF EXISTS (SELECT 1 FROM seasons WHERE id = OLD.season_id) THEN
      INSERT INTO season_planning_history (
        season_id, club_id, action_type, entity_type, entity_id,
        changed_by, changes
      ) VALUES (
        OLD.season_id, OLD.club_id, 'deleted', 'plan_entry', OLD.id,
        auth.uid(), row_to_json(OLD)
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_season_id_fkey;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_season_id_fkey
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE SET NULL;
