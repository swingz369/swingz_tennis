-- season_planning_configs + season_statistics: fehlende RLS-Policies
--
-- Beide Tabellen hatten `ENABLE ROW LEVEL SECURITY` (und FORCE, siehe
-- 20260812010000) aber 0 Policies — faktisch nur über den Drizzle/Service-
-- Client erreichbar (der BYPASSRLS nutzt). Diese Migration ergänzt die
-- club-scoped Policies als Defense-in-Depth, damit die Tabellen sofort
-- geschützt sind, sobald die App auf eine Rolle ohne BYPASSRLS umgestellt
-- wird (siehe docs/DATABASE.md, "FORCE RLS").
--
-- Zugriffsmodell (aus dem App-Code abgeleitet):
--   * season_planning_configs — Planungsparameter pro Saison/Verein.
--     Gelesen/geschrieben nur über Admin-Routen (seasons/[id]/config,
--     seasons/[id]/planning/config, seasons/[id]/planning/trainers).
--     → SELECT/INSERT/UPDATE/DELETE für Club-Admins (is_club_admin).
--   * season_statistics — serverseitig berechnete Kennzahlen, nur gelesen
--     (seasons/[id]/planning/preferences-summary). Kein Client-Schreibpfad.
--     → nur SELECT für Club-Admins (is_club_admin).
--
-- Live-Zustand VOR Anwendung prüfen (AGENTS.md):
--   select policyname, cmd from pg_policies
--   where tablename in ('season_planning_configs','season_statistics');
-- Erwartung: 0 Zeilen für beide Tabellen.
--
-- Verifikation NACH Anwendung (je Rolle Zeilen zählen):
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<admin-user-id>","role":"authenticated"}';
--   select count(*) from season_planning_configs;   -- nur eigene Vereine
--   select count(*) from season_statistics;         -- nur eigene Vereine

BEGIN;

-- season_planning_configs (Admin CRUD, club-scoped)
DROP POLICY IF EXISTS season_planning_configs_admin_select ON season_planning_configs;
CREATE POLICY season_planning_configs_admin_select ON season_planning_configs
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id));

DROP POLICY IF EXISTS season_planning_configs_admin_insert ON season_planning_configs;
CREATE POLICY season_planning_configs_admin_insert ON season_planning_configs
  FOR INSERT TO authenticated
  WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS season_planning_configs_admin_update ON season_planning_configs;
CREATE POLICY season_planning_configs_admin_update ON season_planning_configs
  FOR UPDATE TO authenticated
  USING (is_club_admin(club_id));

DROP POLICY IF EXISTS season_planning_configs_admin_delete ON season_planning_configs;
CREATE POLICY season_planning_configs_admin_delete ON season_planning_configs
  FOR DELETE TO authenticated
  USING (is_club_admin(club_id));

-- season_statistics (nur lesbar, club-scoped; wird serverseitig berechnet)
DROP POLICY IF EXISTS season_statistics_admin_select ON season_statistics;
CREATE POLICY season_statistics_admin_select ON season_statistics
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id));

COMMIT;
