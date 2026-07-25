-- Migration: Scope superadmin RLS access to their own managed clubs
--
-- Rewritten 2026-08-05 after verifying the ACTUAL live database (SSH into
-- the VPS, docker exec into supabase-db, dumped pg_policies directly) —
-- the migrations/ folder does not reflect the deployed state. No
-- supabase_migrations.schema_migrations table exists at all: this project
-- has never used tracked migrations: every policy in this file's DROP/CREATE
-- pairs was verified to exist under this exact name and USING/WITH CHECK
-- clause in the live DB before being touched.
--
-- Problem: is_superadmin() checks ONLY "does this user hold ANY active
-- role='superadmin' membership row anywhere" — never which club. Business
-- rule (confirmed 2026-08-05): superadmin = Tennisschule-Chef, sees/edits/
-- deletes only clubs assigned to them (one real user_club_memberships row
-- with role='superadmin' per club). Owner is unrestricted.
--
-- Two independent bugs found and fixed here:
--   (a) Every is_superadmin() bypass (both inline in scoped policies, and
--       several standalone "FOR ALL USING (is_superadmin())" policies with
--       no scoping at all) granted cross-tenant access.
--   (b) club_members (0 rows, no sync trigger — confirmed via COUNT(*) —
--       vs. user_club_memberships' 442 rows) is a dead, never-populated
--       table. Five tables (trainer_profiles, hourly_rate_tiers,
--       trainer_hourly_rates, rate_history, sepa_mandates) had their
--       admin/trainer/member policies checking club_members — meaning those
--       policies ALWAYS evaluated false, and only the unscoped
--       is_superadmin() bypass ever granted access on those tables at all.
--       Rewritten to check user_club_memberships (the real, populated
--       table) via is_club_admin/is_club_trainer/is_club_member.
--   (c) clubs_select_admin used get_user_role() — a separate, older
--       authorization mechanism (a single global `role` column on
--       public.users, predating user_club_memberships entirely) that let
--       ANY admin (not just superadmin) see every non-deleted club
--       platform-wide. Dropped outright: clubs_select/clubs_owner_select
--       (fixed below) already cover every legitimate case.
--   (d) trainer_availabilities_select had an unrelated bug: it checked
--       "is this user a trainer at all" with no match to the specific row's
--       trainer_id, so every trainer could see every OTHER trainer's
--       availability slots, in any club. Fixed alongside the superadmin
--       scoping fix since the same policy needed rewriting anyway.

-- ============================================================================
-- 0. New helper: is_superadmin_of(club_id) — scoped superadmin check
-- ============================================================================

CREATE OR REPLACE FUNCTION is_superadmin_of(p_club_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND role = 'superadmin'
      AND is_active = true
  )
$$;

COMMENT ON FUNCTION is_superadmin_of(UUID) IS
'Returns true if current user is superadmin of the specified club (real user_club_memberships row, role=superadmin). Unlike is_superadmin(), this is scoped to one club.';

-- ============================================================================
-- 1. clubs
-- ============================================================================

DROP POLICY IF EXISTS "clubs_select" ON clubs;
CREATE POLICY "clubs_select" ON clubs
  FOR SELECT
  USING (id = ANY(get_user_club_ids()));

DROP POLICY IF EXISTS "clubs_owner_select" ON clubs;
CREATE POLICY "clubs_owner_select" ON clubs
  FOR SELECT
  USING (
    is_owner()
    OR (is_club_member(id) AND status != 'deleted')
    OR (
      EXISTS (
        SELECT 1 FROM user_club_memberships
        WHERE club_id = clubs.id
          AND user_id = auth.uid()
          AND is_active = true
      )
      AND status != 'deleted'
    )
  );

DROP POLICY IF EXISTS "clubs_update" ON clubs;
CREATE POLICY "clubs_update" ON clubs
  FOR UPDATE
  USING (is_club_admin(id));

DROP POLICY IF EXISTS "clubs_delete" ON clubs;
CREATE POLICY "clubs_delete" ON clubs
  FOR DELETE
  USING (is_superadmin_of(id));

-- clubs_insert (is_superadmin() OR is_owner()) unchanged: creating a
-- brand-new club has no prior club_id to scope against.

-- clubs_select_admin used the legacy get_user_role() (public.users.role,
-- pre-dates user_club_memberships) and let ANY admin see ALL non-deleted
-- clubs, not just their own. clubs_select / clubs_owner_select above already
-- cover every legitimate case (own club via get_user_club_ids/is_club_member,
-- owner unrestricted). Drop outright, no replacement needed.
DROP POLICY IF EXISTS "clubs_select_admin" ON public.clubs;

-- Standalone unscoped bypass, redundant with the fixed policies above.
DROP POLICY IF EXISTS "clubs_all_superadmin" ON clubs;

-- ============================================================================
-- 2. courts
-- ============================================================================

DROP POLICY IF EXISTS "courts_select" ON courts;
CREATE POLICY "courts_select" ON courts
  FOR SELECT
  USING (club_id = ANY(get_user_club_ids()));

DROP POLICY IF EXISTS "courts_insert" ON courts;
CREATE POLICY "courts_insert" ON courts
  FOR INSERT
  WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "courts_update" ON courts;
CREATE POLICY "courts_update" ON courts
  FOR UPDATE
  USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "courts_delete" ON courts;
CREATE POLICY "courts_delete" ON courts
  FOR DELETE
  USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "courts_all_superadmin" ON courts;

-- ============================================================================
-- 3. sessions (club-scoped via schedules.club_id, no direct club_id column)
-- ============================================================================

DROP POLICY IF EXISTS "sessions_delete" ON sessions;
CREATE POLICY "sessions_delete" ON sessions
  FOR DELETE
  USING (
    is_owner() OR
    EXISTS (
      SELECT 1 FROM schedules s
      WHERE s.id = sessions.schedule_id AND is_club_admin(s.club_id)
    )
  );

DROP POLICY IF EXISTS "sessions_insert" ON sessions;
CREATE POLICY "sessions_insert" ON sessions
  FOR INSERT
  WITH CHECK (
    is_owner() OR
    EXISTS (
      SELECT 1 FROM schedules s
      WHERE s.id = sessions.schedule_id AND is_club_trainer(s.club_id)
    )
  );

DROP POLICY IF EXISTS "sessions_update" ON sessions;
CREATE POLICY "sessions_update" ON sessions
  FOR UPDATE
  USING (
    is_owner() OR
    EXISTS (
      SELECT 1 FROM schedules s
      WHERE s.id = sessions.schedule_id AND is_club_trainer(s.club_id)
    )
  );

-- ============================================================================
-- 4. bookings (has its own club_id column)
-- ============================================================================

DROP POLICY IF EXISTS "bookings_select" ON bookings;
CREATE POLICY "bookings_select" ON bookings
  FOR SELECT
  USING (is_owner() OR (member_id = auth.uid()) OR is_club_trainer(club_id));

DROP POLICY IF EXISTS "bookings_insert" ON bookings;
CREATE POLICY "bookings_insert" ON bookings
  FOR INSERT
  WITH CHECK (
    is_owner() OR is_club_trainer(club_id) OR
    ((member_id = auth.uid()) AND is_club_member(club_id))
  );

DROP POLICY IF EXISTS "bookings_update" ON bookings;
CREATE POLICY "bookings_update" ON bookings
  FOR UPDATE
  USING (is_owner() OR (member_id = auth.uid()) OR is_club_trainer(club_id));

DROP POLICY IF EXISTS "bookings_delete" ON bookings;
CREATE POLICY "bookings_delete" ON bookings
  FOR DELETE
  USING (is_owner() OR is_club_admin(club_id));

DROP POLICY IF EXISTS "bookings_all_superadmin" ON bookings;

-- ============================================================================
-- 5. invoices
-- ============================================================================

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT
  USING (
    (member_id = auth.uid()) OR (trainer_id = auth.uid()) OR is_club_admin(club_id)
  );

DROP POLICY IF EXISTS "invoices_all_superadmin" ON invoices;

-- ============================================================================
-- 6. user_club_memberships
-- ============================================================================

DROP POLICY IF EXISTS "memberships_select" ON user_club_memberships;
CREATE POLICY "memberships_select" ON user_club_memberships
  FOR SELECT
  USING (
    (user_id = auth.uid()) OR ((club_id IS NOT NULL) AND is_club_admin(club_id))
  );

DROP POLICY IF EXISTS "memberships_owner_select" ON user_club_memberships;
CREATE POLICY "memberships_owner_select" ON user_club_memberships
  FOR SELECT
  USING (is_owner() OR is_club_admin(club_id) OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "memberships_owner_insert" ON user_club_memberships;
CREATE POLICY "memberships_owner_insert" ON user_club_memberships
  FOR INSERT
  WITH CHECK (is_owner() OR is_club_admin(club_id));

DROP POLICY IF EXISTS "memberships_owner_update" ON user_club_memberships;
CREATE POLICY "memberships_owner_update" ON user_club_memberships
  FOR UPDATE
  USING (is_owner() OR is_club_admin(club_id));

DROP POLICY IF EXISTS "memberships_all_superadmin" ON user_club_memberships;

-- memberships_manage_admin ((club_id IS NOT NULL) AND is_club_admin(club_id))
-- and user_club_memberships_access_own (user_id = auth.uid()) already
-- correctly scoped, untouched.

-- ============================================================================
-- 7. hours_logs, attendance_records, trainer_availabilities
-- No club_id column on any of these three tables. Scope superadmin via the
-- trainer's actual club assignment (trainer_club) or, for attendance_records
-- (which always has a session_id), via the session's club through schedules.
-- ============================================================================

DROP POLICY IF EXISTS "hours_logs_select" ON hours_logs;
CREATE POLICY "hours_logs_select" ON hours_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trainers
      WHERE trainers.id = hours_logs.trainer_id AND trainers.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trainer_club tc
      WHERE tc.trainer_id = hours_logs.trainer_id AND is_superadmin_of(tc.club_id)
    )
  );

DROP POLICY IF EXISTS "hours_logs_insert" ON hours_logs;
CREATE POLICY "hours_logs_insert" ON hours_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trainers
      WHERE trainers.id = hours_logs.trainer_id AND trainers.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trainer_club tc
      WHERE tc.trainer_id = hours_logs.trainer_id AND is_superadmin_of(tc.club_id)
    )
  );

DROP POLICY IF EXISTS "hours_logs_update" ON hours_logs;
CREATE POLICY "hours_logs_update" ON hours_logs
  FOR UPDATE
  USING (
    (status = 'pending' AND EXISTS (
      SELECT 1 FROM trainers
      WHERE trainers.id = hours_logs.trainer_id AND trainers.user_id = auth.uid()
    )) OR
    EXISTS (
      SELECT 1 FROM trainer_club tc
      WHERE tc.trainer_id = hours_logs.trainer_id AND is_superadmin_of(tc.club_id)
    )
  );

DROP POLICY IF EXISTS "hours_logs_delete" ON hours_logs;
CREATE POLICY "hours_logs_delete" ON hours_logs
  FOR DELETE
  USING (
    (status = 'pending' AND EXISTS (
      SELECT 1 FROM trainers
      WHERE trainers.id = hours_logs.trainer_id AND trainers.user_id = auth.uid()
    )) OR
    EXISTS (
      SELECT 1 FROM trainer_club tc
      WHERE tc.trainer_id = hours_logs.trainer_id AND is_superadmin_of(tc.club_id)
    )
  );

DROP POLICY IF EXISTS "hours_logs_all_superadmin" ON hours_logs;

-- attendance_records: trainer-facing pair + member-facing pair, both live.

DROP POLICY IF EXISTS "attendance_records_select" ON attendance_records;
CREATE POLICY "attendance_records_select" ON attendance_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trainers
      WHERE trainers.id = attendance_records.trainer_id AND trainers.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM sessions s JOIN schedules sc ON sc.id = s.schedule_id
      WHERE s.id = attendance_records.session_id AND is_superadmin_of(sc.club_id)
    )
  );

DROP POLICY IF EXISTS "attendance_records_insert" ON attendance_records;
CREATE POLICY "attendance_records_insert" ON attendance_records
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trainers
      WHERE trainers.id = attendance_records.trainer_id AND trainers.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM sessions s JOIN schedules sc ON sc.id = s.schedule_id
      WHERE s.id = attendance_records.session_id AND is_superadmin_of(sc.club_id)
    )
  );

DROP POLICY IF EXISTS "attendance_records_update" ON attendance_records;
CREATE POLICY "attendance_records_update" ON attendance_records
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trainers
      WHERE trainers.id = attendance_records.trainer_id AND trainers.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM sessions s JOIN schedules sc ON sc.id = s.schedule_id
      WHERE s.id = attendance_records.session_id AND is_superadmin_of(sc.club_id)
    )
  );

DROP POLICY IF EXISTS "attendance_records_delete" ON attendance_records;
CREATE POLICY "attendance_records_delete" ON attendance_records
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trainers
      WHERE trainers.id = attendance_records.trainer_id AND trainers.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM sessions s JOIN schedules sc ON sc.id = s.schedule_id
      WHERE s.id = attendance_records.session_id AND is_superadmin_of(sc.club_id)
    )
  );

DROP POLICY IF EXISTS "attendance_records_member_select" ON attendance_records;
CREATE POLICY "attendance_records_member_select" ON attendance_records
  FOR SELECT
  USING (
    trainer_id = auth.uid() OR
    participant_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM sessions s JOIN schedules sc ON sc.id = s.schedule_id
      WHERE s.id = attendance_records.session_id AND is_superadmin_of(sc.club_id)
    )
  );

DROP POLICY IF EXISTS "attendance_records_member_update" ON attendance_records;
CREATE POLICY "attendance_records_member_update" ON attendance_records
  FOR UPDATE
  USING (
    trainer_id = auth.uid() OR
    (participant_id = auth.uid() AND member_status = 'pending') OR
    EXISTS (
      SELECT 1 FROM sessions s JOIN schedules sc ON sc.id = s.schedule_id
      WHERE s.id = attendance_records.session_id AND is_superadmin_of(sc.club_id)
    )
  );

-- trainer_availabilities_select had an unrelated bug (no match to the row's
-- own trainer_id — every trainer saw every other trainer's slots). Fixed
-- alongside the superadmin scoping.
DROP POLICY IF EXISTS "trainer_availabilities_select" ON trainer_availabilities;
CREATE POLICY "trainer_availabilities_select" ON trainer_availabilities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trainers
      WHERE trainers.id = trainer_availabilities.trainer_id AND trainers.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trainer_club tc
      WHERE tc.trainer_id = trainer_availabilities.trainer_id AND is_superadmin_of(tc.club_id)
    )
  );

DROP POLICY IF EXISTS "trainer_availabilities_insert" ON trainer_availabilities;
CREATE POLICY "trainer_availabilities_insert" ON trainer_availabilities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trainers
      WHERE trainers.id = trainer_availabilities.trainer_id AND trainers.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trainer_club tc
      WHERE tc.trainer_id = trainer_availabilities.trainer_id AND is_superadmin_of(tc.club_id)
    )
  );

DROP POLICY IF EXISTS "trainer_availabilities_update" ON trainer_availabilities;
CREATE POLICY "trainer_availabilities_update" ON trainer_availabilities
  FOR UPDATE
  USING (
    (status != 'booked' AND EXISTS (
      SELECT 1 FROM trainers
      WHERE trainers.id = trainer_availabilities.trainer_id AND trainers.user_id = auth.uid()
    )) OR
    EXISTS (
      SELECT 1 FROM trainer_club tc
      WHERE tc.trainer_id = trainer_availabilities.trainer_id AND is_superadmin_of(tc.club_id)
    )
  );

DROP POLICY IF EXISTS "trainer_availabilities_delete" ON trainer_availabilities;
CREATE POLICY "trainer_availabilities_delete" ON trainer_availabilities
  FOR DELETE
  USING (
    (status != 'booked' AND EXISTS (
      SELECT 1 FROM trainers
      WHERE trainers.id = trainer_availabilities.trainer_id AND trainers.user_id = auth.uid()
    )) OR
    EXISTS (
      SELECT 1 FROM trainer_club tc
      WHERE tc.trainer_id = trainer_availabilities.trainer_id AND is_superadmin_of(tc.club_id)
    )
  );

-- ============================================================================
-- 8. Standalone "Superadmins have full access" bypass policies, redundant
-- once the paired club-scoped policy (unchanged, already correct) covers
-- superadmin via is_club_admin/is_club_trainer/is_club_member.
-- ============================================================================

DROP POLICY IF EXISTS "Superadmins have full access to all absences" ON trainer_absences;
DROP POLICY IF EXISTS "Superadmins have full access to all fee configurations" ON fee_configurations;
DROP POLICY IF EXISTS "Superadmins have full access to all payment settings" ON payment_settings;
DROP POLICY IF EXISTS "Superadmins have full access to all system settings" ON system_settings;
DROP POLICY IF EXISTS "Superadmins have full access to all trial trainings" ON trial_trainings;

DROP POLICY IF EXISTS "tournaments_manage" ON tournaments;
CREATE POLICY "tournaments_manage" ON tournaments
  FOR ALL
  USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "tournaments_select" ON tournaments;
CREATE POLICY "tournaments_select" ON tournaments
  FOR SELECT USING (is_club_member(club_id));

DROP POLICY IF EXISTS "session_waitlist_select" ON session_waitlist;
CREATE POLICY "session_waitlist_select" ON session_waitlist
  FOR SELECT USING (member_id = auth.uid() OR is_club_trainer(club_id));

DROP POLICY IF EXISTS "session_waitlist_insert" ON session_waitlist;
CREATE POLICY "session_waitlist_insert" ON session_waitlist
  FOR INSERT WITH CHECK (member_id = auth.uid() OR is_club_trainer(club_id));

DROP POLICY IF EXISTS "session_waitlist_update" ON session_waitlist;
CREATE POLICY "session_waitlist_update" ON session_waitlist
  FOR UPDATE USING (is_club_trainer(club_id));

DROP POLICY IF EXISTS "session_waitlist_delete" ON session_waitlist;
CREATE POLICY "session_waitlist_delete" ON session_waitlist
  FOR DELETE USING (member_id = auth.uid() OR is_club_trainer(club_id));

DROP POLICY IF EXISTS "trainer_notes_select" ON trainer_member_notes;
CREATE POLICY "trainer_notes_select" ON trainer_member_notes
  FOR SELECT USING (
    is_club_admin(club_id) OR
    EXISTS (SELECT 1 FROM trainers t WHERE t.id = trainer_member_notes.trainer_id AND t.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "trainer_notes_insert" ON trainer_member_notes;
CREATE POLICY "trainer_notes_insert" ON trainer_member_notes
  FOR INSERT WITH CHECK (is_club_trainer(club_id));

DROP POLICY IF EXISTS "trainer_notes_update" ON trainer_member_notes;
CREATE POLICY "trainer_notes_update" ON trainer_member_notes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM trainers t WHERE t.id = trainer_member_notes.trainer_id AND t.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "trainer_notes_delete" ON trainer_member_notes;
CREATE POLICY "trainer_notes_delete" ON trainer_member_notes
  FOR DELETE USING (
    is_club_admin(club_id) OR
    EXISTS (SELECT 1 FROM trainers t WHERE t.id = trainer_member_notes.trainer_id AND t.user_id = auth.uid())
  );

-- ============================================================================
-- 9. club_members is empty (0 rows, no sync trigger) — these five tables'
-- admin/trainer/member policies checked it and always evaluated false.
-- Rewritten against user_club_memberships (442 real rows) via the confirmed
-- working is_club_admin/is_club_trainer/is_club_member. Also drops each
-- table's standalone superadmin bypass, now redundant.
-- ============================================================================

DROP POLICY IF EXISTS "trainer_profiles_superadmin_all" ON trainer_profiles;
DROP POLICY IF EXISTS "trainer_profiles_admin_manage" ON trainer_profiles;
CREATE POLICY "trainer_profiles_admin_manage" ON trainer_profiles
  FOR ALL USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "trainer_profiles_trainer_view" ON trainer_profiles;
CREATE POLICY "trainer_profiles_trainer_view" ON trainer_profiles
  FOR SELECT USING (is_club_trainer(club_id));

DROP POLICY IF EXISTS "trainer_profiles_trainer_update_own" ON trainer_profiles;
CREATE POLICY "trainer_profiles_trainer_update_own" ON trainer_profiles
  FOR UPDATE USING (user_id = auth.uid() AND is_club_trainer(club_id));

DROP POLICY IF EXISTS "trainer_profiles_member_view_active" ON trainer_profiles;
CREATE POLICY "trainer_profiles_member_view_active" ON trainer_profiles
  FOR SELECT USING (is_club_member(club_id) AND status = 'active');

DROP POLICY IF EXISTS "hourly_rate_tiers_superadmin_all" ON hourly_rate_tiers;
DROP POLICY IF EXISTS "hourly_rate_tiers_admin_manage" ON hourly_rate_tiers;
CREATE POLICY "hourly_rate_tiers_admin_manage" ON hourly_rate_tiers
  FOR ALL USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "hourly_rate_tiers_trainer_view" ON hourly_rate_tiers;
CREATE POLICY "hourly_rate_tiers_trainer_view" ON hourly_rate_tiers
  FOR SELECT USING (is_club_trainer(club_id));

DROP POLICY IF EXISTS "hourly_rate_tiers_member_view_active" ON hourly_rate_tiers;
CREATE POLICY "hourly_rate_tiers_member_view_active" ON hourly_rate_tiers
  FOR SELECT USING (is_club_member(club_id) AND is_active = true);

DROP POLICY IF EXISTS "trainer_hourly_rates_superadmin_all" ON trainer_hourly_rates;
DROP POLICY IF EXISTS "trainer_hourly_rates_admin_manage" ON trainer_hourly_rates;
CREATE POLICY "trainer_hourly_rates_admin_manage" ON trainer_hourly_rates
  FOR ALL USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "trainer_hourly_rates_trainer_view_own" ON trainer_hourly_rates;
CREATE POLICY "trainer_hourly_rates_trainer_view_own" ON trainer_hourly_rates
  FOR SELECT USING (trainer_id = auth.uid() OR is_club_trainer(club_id));

DROP POLICY IF EXISTS "rate_history_superadmin_all" ON rate_history;
DROP POLICY IF EXISTS "rate_history_admin_view" ON rate_history;
CREATE POLICY "rate_history_admin_view" ON rate_history
  FOR SELECT USING (is_club_admin(club_id));
-- rate_history_system_insert (WITH CHECK (true)) unrelated, untouched.

DROP POLICY IF EXISTS "sepa_mandates_superadmin_all" ON sepa_mandates;
DROP POLICY IF EXISTS "sepa_mandates_admin_manage" ON sepa_mandates;
CREATE POLICY "sepa_mandates_admin_manage" ON sepa_mandates
  FOR ALL USING (club_id IS NOT NULL AND is_club_admin(club_id));
-- sepa_mandates_member_view_own / _create_own (member_id = auth.uid())
-- unrelated to club scoping, untouched.

-- ============================================================================
-- NOT changed — documented exclusions (verified live, still true):
-- - billing_periods / trainer_billings / billing_line_items: no club_id
--   column reachable anywhere in these three tables.
-- - background_jobs / job_execution_log: club_id lives inside an optional
--   JSONB payload, not every job is club-specific.
-- - school_holidays, base_interest_rates, players: documented as
--   platform-wide shared reference data, not per-club.
-- - fee_configurations / trial_trainings "Club admins can..." / "Trainers
--   can view..." policies already query user_club_memberships correctly (no
--   club_members, no is_superadmin() bug) — untouched.
-- - hours_logs_own_trainer, session_access_via_schedule, sessions_access,
--   clubs_access, court_access, booking_access, and other legacy
--   membership-EXISTS policies with no is_superadmin() term: harmless
--   duplicates, not touched by this migration.
-- ============================================================================
