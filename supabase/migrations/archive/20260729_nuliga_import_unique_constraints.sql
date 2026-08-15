-- Fix nuLiga CSV-import silently faking success (app/api/admin/nuliga/import/route.ts):
-- the route upserts with onConflict:'league_id,name' / 'league_id,matchday_number'
-- but neither constraint existed, so every upsert failed with a Postgres
-- "no unique or exclusion constraint" error that the route never checked.

ALTER TABLE public.teams
  ADD CONSTRAINT teams_league_id_name_key UNIQUE (league_id, name);

ALTER TABLE public.match_days
  ADD CONSTRAINT match_days_league_id_matchday_number_key UNIQUE (league_id, matchday_number);
