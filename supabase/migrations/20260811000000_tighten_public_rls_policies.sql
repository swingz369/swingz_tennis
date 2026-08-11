-- Migration: Öffentlich lesbare/schreibbare RLS-Policies einschränken
--
-- Geschrieben 2026-08-11 nach direkter Abfrage der Live-DB
-- (psql auf supabase.swingz.cloud:6543, pg_policies + pg_roles). Jeder
-- DROP unten nennt einen Policy-Namen, der in der Live-DB unter exakt
-- diesem Namen mit exakt der beschriebenen USING/WITH-CHECK-Klausel
-- existiert. Die migrations/-Dateien wurden NICHT als Quelle benutzt.
--
-- Problem: Fünf Policies stehen auf `USING (true)` bzw. `WITH CHECK (true)`
-- ohne `TO`-Klausel. Ohne `TO` gilt eine Policy für `PUBLIC` — und `PUBLIC`
-- schließt die Rolle `anon` ein, also jeden, der den öffentlichen
-- NEXT_PUBLIC_SUPABASE_ANON_KEY hat (der steht im Browser-Bundle).
--
-- Verifiziert vorab (pg_roles): service_role und postgres haben
-- rolbypassrls = true, anon/authenticated/authenticator haben false.
-- Alle schreibenden Code-Pfade auf diese Tabellen laufen über
-- createServiceClient() — die "System can ..."-Policies mit `true` werden
-- also von keinem Code gebraucht und können ersatzlos entfallen.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. contact_requests — Kontaktformular-Eingänge
--    Live: SELECT USING (true) für PUBLIC, INSERT WITH CHECK (true) für
--    PUBLIC. Damit sind Vor-/Nachname, E-Mail und Nachrichtentext aller
--    Kontaktanfragen mit dem Anon-Key lesbar, und jeder kann beliebig
--    viele Zeilen direkt über /rest/v1 einfügen — vorbei am
--    checkRateLimit() in app/api/contact/route.ts.
--    Schreibpfad ist ausschließlich app/api/contact/route.ts
--    (createServiceClient), Lesepfad existiert im Code aktuell gar nicht.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS contact_requests_service_read ON public.contact_requests;
DROP POLICY IF EXISTS contact_requests_insert_public ON public.contact_requests;

CREATE POLICY contact_requests_owner_read ON public.contact_requests
  FOR SELECT TO authenticated
  USING (is_owner() OR is_superadmin());

-- ---------------------------------------------------------------------
-- 2. club_access_requests — Interessenten-Anfragen ("Verein anlegen")
--    Live: "owner can read access requests" SELECT USING (true) für PUBLIC.
--    Der Name sagt owner, die Policy sagt jeder. Enthält Name, E-Mail,
--    Vereinsname, Nachricht.
--    Leser ist app/(protected)/owner/access/page.tsx (Service-Client),
--    Schreiber app/api/auth/register-interest/route.ts (Service-Client).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "owner can read access requests" ON public.club_access_requests;

CREATE POLICY club_access_requests_owner_read ON public.club_access_requests
  FOR SELECT TO authenticated
  USING (is_owner() OR is_superadmin());

-- ---------------------------------------------------------------------
-- 3. gamification_points
--    Live: SELECT USING (true) für PUBLIC, UPDATE USING (true) für PUBLIC,
--    INSERT WITH CHECK (true) für PUBLIC. Punktestände waren damit anonym
--    les- UND schreibbar.
--    Lesepfad ist app/api/gamification/route.ts über withApiAuth, also
--    Rolle `authenticated` — inkl. Leaderboard über fremde User. Das Lesen
--    bleibt deshalb erhalten, nur ohne anon.
--    Alle Schreibpfade (bookings, attendance-records, qr-checkin) nutzen
--    createServiceClient und brauchen keine Policy.
--    ponytail: SELECT bleibt bei `true` statt club-scoped — die Tabelle
--    hat keine club_id, das Leaderboard ist schon heute vereinsübergreifend.
--    Club-Scoping erst, wenn gamification_points eine club_id bekommt.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Everyone can view gamification points" ON public.gamification_points;
DROP POLICY IF EXISTS "System can update gamification points" ON public.gamification_points;
DROP POLICY IF EXISTS "System can upsert gamification points" ON public.gamification_points;

CREATE POLICY gamification_points_select_authenticated ON public.gamification_points
  FOR SELECT TO authenticated
  USING (true);

-- "Admins can insert gamification points" und "Admins can update
-- gamification points" bleiben unverändert bestehen.

-- ---------------------------------------------------------------------
-- 4. players — nur (id, elo_rating, created_at, updated_at)
--    Live: players_select_all SELECT USING (true) TO authenticated, aus
--    20260731_fix_security_advisor_findings.sql. Kein einziger Code-Pfad
--    liest oder schreibt diese Tabelle (grep über app/, lib/, src/).
--    players_admin_manage (FOR ALL, is_superadmin() OR is_owner()) deckt
--    die Admin-Sicht weiterhin ab.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS players_select_all ON public.players;

COMMIT;
