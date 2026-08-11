-- Migration: Doppelte RLS-Policy-Generationen auflösen
--
-- Geschrieben 2026-08-12 nach direkter Abfrage der Live-DB (psql auf
-- supabase.swingz.cloud:6543). Jeder Policy-Name unten wurde vorher in
-- pg_policies unter exakt diesem Namen mit exakt der beschriebenen
-- USING/WITH-CHECK-Klausel bestätigt. Die Migrationsdateien wurden NICHT
-- als Quelle benutzt (siehe AGENTS.md → Migrationen, Regel 1).
--
-- Ausgangslage: 51 (Tabelle, cmd)-Gruppen haben mehr als eine PERMISSIVE
-- Policy. Mehrere permissive Policies sind per se KEIN Fehler — Postgres
-- verodert sie, und "Mitglied sieht eigenes" + "Admin sieht alles" ist
-- genau so gedacht. Diese Migration fasst deshalb nicht pauschal zusammen,
-- sondern entfernt nur drei nachgewiesene Fehlerklassen:
--
--   (a) exakte Dubletten — dieselbe Klausel unter zwei Namen aus zwei
--       Generationen. Löschen ändert nichts, verhindert aber, dass eine
--       spätere Verschärfung an der einen Generation von der anderen
--       wieder aufgehoben wird.
--   (b) tote Policies — Klauseln, die nie zutreffen können (Vergleich
--       einer trainers.id mit auth.uid(), Rollenname 'super_admin', den
--       es in user_club_memberships nicht gibt).
--   (c) unscoped is_superadmin() — der Cross-Tenant-Bypass, den
--       20260805000000 beseitigen sollte, auf zwei Tabellen übersehen.
--
-- Vorab per SQL verifizierte Fakten, auf denen die Drops beruhen:
--   * sessions.trainer_id und attendance_records.trainer_id sind FKs auf
--     trainers(id), NICHT auf users/auth.users. Jede Klausel der Form
--     `trainer_id = auth.uid()` ist damit strukturell tot; der lebende
--     Trainer-Pfad läuft über trainers.user_id = auth.uid().
--   * user_club_memberships kennt die Rollen owner/superadmin/admin/
--     trainer/member — 'super_admin' (mit Unterstrich) existiert nicht.
--   * is_club_admin(club_id) ist wortgleich mit der ausgeschriebenen
--     Klausel in "Admins can manage seasons of their club".
--   * season_plan_entries hat aktuell 88 Zeilen, alle status='published' —
--     der Draft-Leak unten ist heute folgenlos, aber real.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. attendance_records — 4 SELECT-Policies aus zwei Generationen
--    "Members can view own attendance" (participant_id = auth.uid()) ist
--    eine echte Teilmenge von attendance_records_member_select, das
--    dieselbe Bedingung als eines von drei ODER-Gliedern enthält.
--    "Trainers can view session attendance" vergleicht sessions.trainer_id
--    (FK auf trainers) mit auth.uid() (users) — kann nie zutreffen.
--    Es bleiben attendance_records_select (Trainer über trainers.user_id,
--    plus is_superadmin_of) und attendance_records_member_select.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view own attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Trainers can view session attendance" ON public.attendance_records;

-- ---------------------------------------------------------------------
-- 2. member_schedule_preferences — 4× SELECT, 3× UPDATE, 2× INSERT
--    Exakte Dubletten (alt "Users can ..." vs. neu
--    member_schedule_prefs_*_own, beide `auth.uid() = user_id`).
--    Zusätzlich: member_schedule_prefs_admin_select prüft die
--    Admin-Mitgliedschaft OHNE is_active — es ist die LOCKERERE der beiden
--    Admin-Policies und hebt die Prüfung der strengeren auf. Ein Admin mit
--    deaktivierter Mitgliedschaft sah damit weiter alle Präferenzen.
--    Behalten wird jeweils die Variante mit is_active-Prüfung.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own schedule preferences" ON public.member_schedule_preferences;
DROP POLICY IF EXISTS "Users can update own schedule preferences" ON public.member_schedule_preferences;
DROP POLICY IF EXISTS "Users can insert own schedule preferences" ON public.member_schedule_preferences;
DROP POLICY IF EXISTS member_schedule_prefs_admin_select ON public.member_schedule_preferences;

-- ---------------------------------------------------------------------
-- 3. user_training_preferences — user_prefs_admin_view ist inhaltlich
--    wortgleich mit "Admins can view all preferences in club" (beide:
--    Mitgliedschaft in club_id, Rolle admin/superadmin, is_active), nur
--    anders formuliert (EXISTS vs. IN).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS user_prefs_admin_view ON public.user_training_preferences;

-- ---------------------------------------------------------------------
-- 4. users — 3× SELECT
--    users_admin_club heißt "admin", prüft aber gar keine Rolle: es liefert
--    alle User aus Clubs, in denen ich Mitglied bin — inhaltlich dasselbe
--    wie "Members can view club members". Dublette.
--    users_superadmin = is_superadmin() OHNE Club-Bezug: jeder Superadmin
--    sah damit ALLE User der Plattform, quer über fremde Vereine. Genau
--    der Bypass, den 20260805000000 abstellen sollte. Superadmins behalten
--    ihre User-Sicht über "Members can view club members", weil sie pro
--    verwaltetem Verein eine eigene user_club_memberships-Zeile haben.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS users_admin_club ON public.users;
DROP POLICY IF EXISTS users_superadmin ON public.users;

-- ---------------------------------------------------------------------
-- 5. seasons — 3× ALL
--    seasons_all_superadmin = is_superadmin() ohne Club-Bezug: derselbe
--    Cross-Tenant-Bypass wie bei users, hier sogar für FOR ALL (also auch
--    UPDATE/DELETE auf Saisons fremder Vereine).
--    "Admins can manage seasons of their club" ist die ausgeschriebene
--    Fassung von is_club_admin(club_id) — seasons_manage_admin bleibt.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS seasons_all_superadmin ON public.seasons;
DROP POLICY IF EXISTS "Admins can manage seasons of their club" ON public.seasons;

-- ---------------------------------------------------------------------
-- 6. season_plan_entries
--    "Users can view plan entries of their club" erlaubt jedem aktiven
--    Vereinsmitglied JEDEN Eintrag, unabhängig vom status — und hebt damit
--    season_plan_entries_member_view_published auf, das bewusst nur
--    status='published' freigibt. Heute folgenlos (alle 88 Zeilen sind
--    published), aber sobald ein Entwurf entsteht, sehen ihn alle.
--    season_plan_entries_admin_all ist die EXISTS-Fassung von
--    "Admins can manage plan entries of their club" — Dublette; die
--    ALL-Policy behält Admins den Zugriff auf Entwürfe.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view plan entries of their club" ON public.season_plan_entries;
DROP POLICY IF EXISTS season_plan_entries_admin_all ON public.season_plan_entries;

-- ---------------------------------------------------------------------
-- 7. trainer_feedback — Tippfehler in der Rollenliste
--    "Admins can view all feedback" prüft auf role IN ('admin',
--    'super_admin'). Die Rolle heißt 'superadmin' (ohne Unterstrich);
--    Superadmins konnten Feedback ihres eigenen Vereins also nicht sehen.
--    Kein Sicherheits-, sondern ein Funktionsfehler — hier mitgefixt, weil
--    dieselbe Policy angefasst wird. is_club_admin(club_id) deckt
--    admin + superadmin club-scoped ab und prüft zusätzlich is_active.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.trainer_feedback;

CREATE POLICY trainer_feedback_admin_select ON public.trainer_feedback
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id));

COMMIT;

-- Nicht angefasst, bewusst:
--   * trainer_absences (3× SELECT): sieht nach Dublette aus, ist keine.
--     trainers_can_view_own_absences prüft trainer_absences.user_id — und
--     diese Spalte ist in ALLEN 22 Zeilen NULL. Der einzige real
--     funktionierende Trainer-Pfad ist die ältere Policy "Trainers can view
--     their own absences", die trainers und users über die E-Mail-Adresse
--     joint. Ein Drop nähme Trainern den Zugriff. Richtiger Fix ist,
--     user_id zu befüllen und den E-Mail-Join danach zu entfernen —
--     eigenes Ticket, weil es eine Datenmigration ist.
--   * dunning_records, fee_configurations (je 3× SELECT): drei
--     unterschiedliche Zielgruppen (Admin / Trainer / Mitglied), keine
--     Generationen. Korrekt so.
