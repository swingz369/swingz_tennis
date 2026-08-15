-- Verknüpft eine materialisierte Session mit ihrer Saisonplanungs-Vorlage,
-- damit ein Admin eine Trainingszeit mitten in der Saison verschieben kann
-- (Reschedule-Endpoint muss von der Session zurück zum Plan-Entry finden).
ALTER TABLE sessions
  ADD COLUMN plan_entry_id uuid REFERENCES season_plan_entries(id) ON DELETE SET NULL;

CREATE INDEX sessions_plan_entry_idx ON sessions (plan_entry_id);
