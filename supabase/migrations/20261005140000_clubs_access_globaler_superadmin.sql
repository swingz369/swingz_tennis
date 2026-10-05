-- Vereinszeile nur für Admins, kein globaler Superadmin-Bypass (05.10.2026)
--
-- 1. clubs: "clubs_access" (ALL, USING Mitglied des Vereins, ohne WITH CHECK) ließ
--    jedes Mitglied die eigene Vereinszeile per PostgREST ändern und löschen. Lokal
--    belegt: Alpha-Mitglied ändert Name und features (Module freischalten); DELETE
--    scheiterte nur zufällig an audit_logs-FK. Lesen decken clubs_select /
--    clubs_owner_select ab, Ändern clubs_update (Vereinsadmin, Owner), Löschen
--    clubs_delete (is_superadmin_of). Alle App-Schreibwege laufen als Admin oder
--    über systemDb.
-- 2. is_superadmin() ist global (Superadmin irgendeines Vereins). Ersetzt durch
--    is_owner() auf Tabellen ohne Vereinsbezug — die App schreibt sie nur über
--    systemDb (school_holidays) oder gar nicht (players, background_jobs,
--    job_execution_log):
--    - school_holidays: jeder Superadmin konnte die Ferien aller Vereine ändern
--      (die Saisonplanung setzt danach Termine aus).
--    - players: jeder Superadmin setzte ELO-Werte beliebiger Spieler.
--    - background_jobs / job_execution_log: jeder Superadmin las und änderte alle
--      Jobs inkl. payload anderer Vereine; job_execution_log war für jeden schreibbar,
--      der den Job sehen konnte.
-- clubs_insert (Superadmin oder Owner legt Vereine an) bleibt: gewollte Produktregel.

DROP POLICY IF EXISTS clubs_access ON public.clubs;

DROP POLICY IF EXISTS school_holidays_admin_manage ON public.school_holidays;
CREATE POLICY school_holidays_admin_manage ON public.school_holidays FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS players_admin_manage ON public.players;
CREATE POLICY players_admin_manage ON public.players FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS background_jobs_superadmin_all ON public.background_jobs;
DROP POLICY IF EXISTS background_jobs_admin_select ON public.background_jobs;
DROP POLICY IF EXISTS background_jobs_owner_all ON public.background_jobs;
CREATE POLICY background_jobs_owner_all ON public.background_jobs FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY background_jobs_admin_select ON public.background_jobs FOR SELECT TO authenticated
  USING (public.is_club_admin((payload ->> 'club_id')::uuid));

DROP POLICY IF EXISTS job_execution_log_superadmin_all ON public.job_execution_log;
DROP POLICY IF EXISTS job_execution_log_owner_all ON public.job_execution_log;
DROP POLICY IF EXISTS job_execution_log_select ON public.job_execution_log;
CREATE POLICY job_execution_log_owner_all ON public.job_execution_log FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY job_execution_log_select ON public.job_execution_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.background_jobs j WHERE j.id = job_id));

REVOKE ALL ON public.players, public.background_jobs, public.job_execution_log FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.school_holidays FROM anon;
