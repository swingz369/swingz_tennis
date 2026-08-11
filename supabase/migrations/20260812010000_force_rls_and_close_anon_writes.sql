-- Migration: FORCE ROW LEVEL SECURITY + anonyme Schreibrechte schließen
--
-- Geschrieben 2026-08-12 nach direkter Abfrage der Live-DB (psql auf
-- supabase.swingz.cloud:6543). Alle Policy-Namen aus pg_policies
-- übernommen, nicht aus Migrationsdateien (AGENTS.md → Migrationen).
--
-- ==== Teil 1: FORCE RLS ====
-- Live-Befund: relrowsecurity = true auf allen 114 public-Tabellen,
-- relforcerowsecurity = false auf allen 114.
--
-- WICHTIG, damit sich niemand in falscher Sicherheit wiegt: FORCE RLS
-- ändert HEUTE faktisch nichts. Es unterwirft den Tabelleneigentümer der
-- RLS — Eigentümer aller 114 Tabellen ist `postgres`, und `postgres` hat
-- rolbypassrls = true. Das BYPASSRLS-Attribut gewinnt immer gegen FORCE.
-- Die Anweisung ist trotzdem richtig: sie wirkt in dem Moment, in dem die
-- Anwendung (wie unten empfohlen) auf eine eigene Rolle ohne BYPASSRLS
-- umgestellt wird, und schließt aus, dass ein künftiger Eigentümerwechsel
-- RLS still aushebelt.
--
-- Das eigentliche Risiko dahinter, das diese Migration NICHT beheben kann:
-- DATABASE_URL verbindet sich als `postgres` (BYPASSRLS). Die 26
-- API-Routes, die Drizzle statt des Supabase-REST-Clients verwenden,
-- umgehen damit RLS vollständig — dort zählt allein die Prüfung im
-- Anwendungscode. Fix ist eine dedizierte App-Rolle ohne BYPASSRLS plus
-- Umstellung der DATABASE_URL; das ist eine Infra-Änderung mit
-- Ausfallrisiko und gehört nicht in eine Migration.

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.oid::regclass AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND NOT c.relforcerowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', t.tbl);
  END LOOP;
END $$;

-- ==== Teil 2: anonyme INSERT-Policies ====
-- Live-Befund: sechs Tabellen haben eine INSERT-Policy mit
-- WITH CHECK (true) ohne TO-Klausel (gilt also für PUBLIC inkl. anon),
-- und `anon` hat auf allen sechs das INSERT-Grant. Jeder mit dem
-- öffentlichen Anon-Key konnte dort direkt über /rest/v1 Zeilen anlegen.
-- Vier der Namen sagen selbst "System"/"service role" — die Absicht war
-- service_role, die Wirkung war jeder.

BEGIN;

-- email_queue — der gravierendste Fall: die Versand-Warteschlange.
-- Anonyme Zeilen hier bedeuten Mailversand über die eigene Absenderdomain
-- (noreply@swingz.cloud), also Spam-/Phishing-Relay auf Kosten der
-- Domain-Reputation. Einziger Schreibpfad im Code ist
-- app/api/email-campaigns/route.ts über createServiceClient() —
-- service_role hat BYPASSRLS und braucht die Policy nicht.
DROP POLICY IF EXISTS "System can insert into email queue" ON public.email_queue;

-- nuliga_sync_log — Schreibpfade: app/api/cron/nuliga-sync/route.ts und
-- app/api/leagues/[id]/sync/route.ts, beide createServiceClient().
DROP POLICY IF EXISTS sync_log_insert_service ON public.nuliga_sync_log;

-- newsletter_send_logs, rate_history — kein Schreibpfad im Anwendungscode
-- (grep über app/, lib/, src/); beide Policy-Namen sagen service.
DROP POLICY IF EXISTS "service role insert newsletter_send_logs" ON public.newsletter_send_logs;
DROP POLICY IF EXISTS rate_history_system_insert ON public.rate_history;

-- gamification_badges — hier NICHT ersatzlos droppen: der Schreibpfad
-- app/api/gamification/route.ts läuft über withApiAuth, also mit dem
-- User-Client in der Rolle `authenticated`. Die Policy wird deshalb nur
-- um anon beschnitten, die Bedingung bleibt gleich.
-- ponytail: WITH CHECK bleibt (true) statt user_id = auth.uid() — damit
-- kann jeder eingeloggte User weiterhin beliebige Badges anlegen. Das
-- schließt das anonyme Loch, ohne den Badge-Code anzufassen; die engere
-- Bedingung erst, wenn geklärt ist, welche Spalte den Empfänger hält.
DROP POLICY IF EXISTS "System can insert badges" ON public.gamification_badges;

CREATE POLICY gamification_badges_insert_authenticated ON public.gamification_badges
  FOR INSERT TO authenticated
  WITH CHECK (true);

COMMIT;

-- Bewusst NICHT angefasst:
--   registration_requests / "Anyone can insert registration" — das ist der
--   öffentliche Registrierungspfad (app/api/public/register/route.ts nutzt
--   den User-/Anon-Client, nicht den Service-Client). Anonymes INSERT ist
--   hier gewollt. Die Route hat checkRateLimit(); wer direkt gegen
--   /rest/v1 schreibt, umgeht das allerdings — offener Punkt, gehört mit
--   einem DB-seitigen Limit oder einer Umstellung auf den Service-Client
--   gelöst, nicht mit einem Policy-Drop.
