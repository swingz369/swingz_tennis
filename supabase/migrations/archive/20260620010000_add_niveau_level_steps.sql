ALTER TABLE season_planning_configs
  ADD COLUMN IF NOT EXISTS max_niveau_level_steps integer NOT NULL DEFAULT 1;
