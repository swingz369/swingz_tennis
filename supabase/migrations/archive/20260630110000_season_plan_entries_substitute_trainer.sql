-- Trainer-Vertretungsplanung auf season_plan_entries
-- Wenn substitute_trainer_id gesetzt, übernimmt dieser Trainer in Wochen [from..to].
ALTER TABLE season_plan_entries
  ADD COLUMN IF NOT EXISTS substitute_trainer_id uuid REFERENCES trainers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substitute_from_week integer,
  ADD COLUMN IF NOT EXISTS substitute_to_week integer;

COMMENT ON COLUMN season_plan_entries.substitute_trainer_id IS 'Vertretungs-Trainer für einen Wochen-Bereich';
COMMENT ON COLUMN season_plan_entries.substitute_from_week IS 'Ab dieser Woche gilt die Vertretung (inklusiv)';
COMMENT ON COLUMN season_plan_entries.substitute_to_week IS 'Bis einschließlich dieser Woche gilt die Vertretung';
