-- Fix: Supabase Security Advisor findings (live scan, 2026-07-04)
--
-- Scope note: this migration targets ONLY the 8 findings the advisor
-- reported. It deliberately does NOT catch the DB up on the ~40 days of
-- other pending local migrations sitting in this folder (confirmed via
-- `supabase migration list` — most of `20260620` through `20260730` show
-- no matching remote entry). Several of those files already contain
-- correct fixes for some of these exact tables (`20260624_mahnwesen_verzugszins_decisions.sql`,
-- `20260506_trainer_availability.sql`, `20260724_fix_rls_missing_tables.sql`)
-- but were never applied — this migration re-asserts the same policies
-- directly so the live DB is fixed without pulling in unrelated pending
-- schema changes. All statements are idempotent (safe to re-run once the
-- backlog does get pushed).

-- ── rls_disabled_in_public ──────────────────────────────────────────────

-- base_interest_rates (Bundesbank-Basiszinssatz, §247 BGB) — owner-only.
ALTER TABLE public.base_interest_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS base_interest_rates_owner_all ON public.base_interest_rates;
CREATE POLICY base_interest_rates_owner_all ON public.base_interest_rates
  FOR ALL USING (is_superadmin());

-- trainer_assignments — members of the club can see assignments, trainers
-- see their own, admins manage. Matches 20260506_trainer_availability.sql.
ALTER TABLE public.trainer_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_trainer_assignments" ON public.trainer_assignments;
CREATE POLICY "members_can_view_trainer_assignments" ON public.trainer_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = trainer_assignments.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

DROP POLICY IF EXISTS "trainers_can_view_own_assignments" ON public.trainer_assignments;
CREATE POLICY "trainers_can_view_own_assignments" ON public.trainer_assignments
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_can_manage_trainer_assignments" ON public.trainer_assignments;
CREATE POLICY "admins_can_manage_trainer_assignments" ON public.trainer_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = trainer_assignments.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- session_waitlist + trainer_member_notes — already written correctly in
-- 20260724_fix_rls_missing_tables.sql, reasserted verbatim here.
ALTER TABLE public.session_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_waitlist_select" ON public.session_waitlist;
CREATE POLICY "session_waitlist_select" ON public.session_waitlist
  FOR SELECT USING (
    member_id = auth.uid()
    OR is_superadmin()
    OR is_club_trainer(club_id)
  );

DROP POLICY IF EXISTS "session_waitlist_insert" ON public.session_waitlist;
CREATE POLICY "session_waitlist_insert" ON public.session_waitlist
  FOR INSERT WITH CHECK (
    member_id = auth.uid()
    OR is_superadmin()
    OR is_club_trainer(club_id)
  );

DROP POLICY IF EXISTS "session_waitlist_update" ON public.session_waitlist;
CREATE POLICY "session_waitlist_update" ON public.session_waitlist
  FOR UPDATE USING (
    is_superadmin() OR is_club_trainer(club_id)
  );

DROP POLICY IF EXISTS "session_waitlist_delete" ON public.session_waitlist;
CREATE POLICY "session_waitlist_delete" ON public.session_waitlist
  FOR DELETE USING (
    member_id = auth.uid()
    OR is_superadmin()
    OR is_club_trainer(club_id)
  );

ALTER TABLE public.trainer_member_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_notes_select" ON public.trainer_member_notes;
CREATE POLICY "trainer_notes_select" ON public.trainer_member_notes
  FOR SELECT USING (
    is_superadmin()
    OR is_club_admin(club_id)
    OR EXISTS (
      SELECT 1 FROM trainers t
      WHERE t.id = trainer_member_notes.trainer_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "trainer_notes_insert" ON public.trainer_member_notes;
CREATE POLICY "trainer_notes_insert" ON public.trainer_member_notes
  FOR INSERT WITH CHECK (
    is_superadmin()
    OR is_club_trainer(club_id)
  );

DROP POLICY IF EXISTS "trainer_notes_update" ON public.trainer_member_notes;
CREATE POLICY "trainer_notes_update" ON public.trainer_member_notes
  FOR UPDATE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM trainers t
      WHERE t.id = trainer_member_notes.trainer_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "trainer_notes_delete" ON public.trainer_member_notes;
CREATE POLICY "trainer_notes_delete" ON public.trainer_member_notes
  FOR DELETE USING (
    is_superadmin()
    OR is_club_admin(club_id)
    OR EXISTS (
      SELECT 1 FROM trainers t
      WHERE t.id = trainer_member_notes.trainer_id AND t.user_id = auth.uid()
    )
  );

-- trainer_clubs — confirmed empty (0 rows) live. 20260605_drop_legacy_trainer_tables.sql
-- already documents this as a superseded duplicate that should have been
-- dropped; that migration never reached production either. Dropping here
-- instead of granting RLS to a table nothing references (no app code hits
-- it — verified via grep across app/, lib/, src/).
DROP TABLE IF EXISTS public.trainer_clubs CASCADE;

-- _negation_test — dead CI-lock test table (20260611_test_negation.sql),
-- its own comment already says "wird in der nächsten Migration gedroppt".
DROP TABLE IF EXISTS public._negation_test;

-- players — created without RLS by 20260630030000_elo_trigger.sql (a
-- migration applied later in this same remediation pass). Public
-- leaderboard read; writes only via the SECURITY DEFINER ELO trigger or
-- admins.
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS players_select_all ON public.players;
CREATE POLICY players_select_all ON public.players
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS players_admin_manage ON public.players;
CREATE POLICY players_admin_manage ON public.players
  FOR ALL TO authenticated
  USING (is_superadmin() OR is_owner());

-- ── security_definer_view ───────────────────────────────────────────────
-- Metadata-only change: makes each view run with the querying user's
-- privileges (and RLS) instead of the view owner's. Does not touch the
-- view body, so this is safe regardless of the underlying query.
ALTER VIEW public.attendance_hours_summary SET (security_invoker = true);
ALTER VIEW public.cron_job_health SET (security_invoker = true);
