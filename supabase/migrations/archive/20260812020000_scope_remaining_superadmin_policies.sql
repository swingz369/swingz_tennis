-- Migration: Restliche unscoped is_superadmin()-Policies club-scopen
--
-- Geschrieben 2026-08-12 nach direkter Abfrage der Live-DB (docker exec
-- supabase-db psql auf dem VPS, Stack `swingz`). Policy-Namen und Klauseln
-- aus pg_policies übernommen (AGENTS.md → Migrationen, Regel 1).
--
-- Dritter und letzter Durchgang zu derselben Fehlerklasse wie
-- 20260805000000 und 20260812000000: `is_superadmin()` ohne Club-Bezug
-- prüft nur "hat dieser User IRGENDWO eine superadmin-Zeile" und gewährt
-- dann Zugriff auf ALLE Zeilen der Tabelle, auch fremder Vereine.
--
-- Vorab verifizierte Fakten:
--   * audit_logs hat club_id, 0 von 2 Zeilen haben club_id IS NULL —
--     Scoping über club_id verliert also keine Zeile.
--   * trainers hat KEINE club_id; die Vereinszuordnung läuft über
--     trainer_club(trainer_id, club_id).
--   * Schreibende Zugriffe auf trainers laufen ausschließlich über den
--     Service-Client (`adminSupabase.from('trainers').upsert(...)` in
--     app/api/members/invite/route.ts und .../bulk-import/route.ts) —
--     eine INSERT-Policy wird deshalb nicht gebraucht.
--   * trainers hatte bisher überhaupt keine Admin-Policy: nur
--     trainers_own (eigene Zeile) und den unscoped Superadmin-Bypass.
--     Club-Admins bekommen hier also Zugriff, den sie vorher nicht hatten.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. audit_logs — zwei SELECT-Policies zu einer zusammengeführt.
--    audit_logs_superadmin (is_superadmin()) gab jedem Superadmin die
--    Audit-Logs aller Vereine. audit_logs_admin prüfte club-scoped, aber
--    mit ausgeschriebener Klausel. is_club_admin(club_id) deckt admin +
--    superadmin club-scoped ab und prüft zusätzlich is_active.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_superadmin ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_admin ON public.audit_logs;

CREATE POLICY audit_logs_admin_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id));

-- ---------------------------------------------------------------------
-- 2. trainers — FOR ALL is_superadmin() ersetzt durch club-scoped
--    Lesen/Ändern/Löschen über trainer_club. Kein INSERT-Pendant:
--    Trainer werden per Service-Client angelegt, und eine INSERT-Policy
--    ließe sich hier ohnehin nicht sinnvoll prüfen (die trainer_club-Zeile
--    entsteht erst nach dem Trainer).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS trainers_all_superadmin ON public.trainers;

CREATE POLICY trainers_admin_select ON public.trainers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trainer_club tc
    WHERE tc.trainer_id = trainers.id AND is_club_admin(tc.club_id)
  ));

CREATE POLICY trainers_admin_update ON public.trainers
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trainer_club tc
    WHERE tc.trainer_id = trainers.id AND is_club_admin(tc.club_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM trainer_club tc
    WHERE tc.trainer_id = trainers.id AND is_club_admin(tc.club_id)
  ));

CREATE POLICY trainers_admin_delete ON public.trainers
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trainer_club tc
    WHERE tc.trainer_id = trainers.id AND is_club_admin(tc.club_id)
  ));

-- ---------------------------------------------------------------------
-- 3. users UPDATE — users_update_superadmin_all (is_superadmin()) erlaubte
--    jedem Superadmin, JEDEN User der Plattform zu ändern. Ersetzt durch
--    club-scoped: nur User, die in einem Verein Mitglied sind, in dem ich
--    admin/superadmin bin. users_update_own bleibt unverändert.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS users_update_superadmin_all ON public.users;

CREATE POLICY users_update_admin_club ON public.users
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_club_memberships ucm
    WHERE ucm.user_id = users.id AND is_club_admin(ucm.club_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_club_memberships ucm
    WHERE ucm.user_id = users.id AND is_club_admin(ucm.club_id)
  ));

COMMIT;
