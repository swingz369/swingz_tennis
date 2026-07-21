-- Q2-Audit (Saisonplanungs-Algorithmus, Punkt 11): individuelle Gruppenkapazität.
-- Bisher gab es nur einen globalen Default (season_planning_configs.group_max_size /
-- kids_group_max_size) — reale Vereine variieren die Gruppengröße aber je nach
-- Trainer/Platzverhältnis oder Gruppentyp. NULL = weiterhin globaler Default.
ALTER TABLE groups ADD COLUMN IF NOT EXISTS max_size integer;

COMMENT ON COLUMN groups.max_size IS
  'Optionale individuelle Kapazität dieser Gruppe. NULL = globaler Default aus season_planning_configs (group_max_size / kids_group_max_size).';
