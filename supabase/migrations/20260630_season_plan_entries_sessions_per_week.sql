-- Add sessions_per_week and day_of_week_2 to season_plan_entries
-- Enables groups that train twice per week (e.g. Leistungsgruppen)
-- sessions_per_week=1 is the default, preserving existing behaviour.
-- day_of_week_2 = null → confirm route uses (day_of_week + 3) % 7 as second day.

ALTER TABLE season_plan_entries
  ADD COLUMN IF NOT EXISTS sessions_per_week integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS day_of_week_2 integer;

COMMENT ON COLUMN season_plan_entries.sessions_per_week IS '1 = once/week (default), 2 = twice/week';
COMMENT ON COLUMN season_plan_entries.day_of_week_2 IS 'Day index for second weekly session (0=Mon..6=Sun). NULL = day_of_week+3.';
