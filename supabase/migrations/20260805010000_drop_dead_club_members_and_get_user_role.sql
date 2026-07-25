-- Migration: Remove club_members (dead table) and get_user_role() (broken legacy function)
--
-- Follow-up to 20260805000000_scope_superadmin_to_managed_clubs.sql. Verified live 2026-08-05:
--
-- club_members: 0 rows, no sync trigger, not created by any tracked migration (see
-- docs/DATABASE.md). Before this migration, trial_trainings' four "Club admins can..."
-- policies (create/delete/update/view) relied SOLELY on club_members — meaning club
-- admins had NO working RLS access to trial_trainings at all. Also found: the app's
-- Drizzle repository (src/infrastructure/persistence/repositories/member.repository.ts)
-- was querying/inserting into this same dead table via findByClub()/save() — a real,
-- live production bug (member lists always empty, new memberships written nowhere
-- anything else reads). Fixed in application code in the same change as this migration.
--
-- get_user_role() (004_enhanced_rls_policies.sql) reads `role` from public.users —
-- confirmed live: that column does NOT exist on public.users at all. The function
-- would error if ever invoked. Its only remaining policy reference (clubs_select_admin)
-- was already dropped in 20260805000000. Confirmed zero remaining pg_policies reference
-- it before this migration runs.

-- ============================================================================
-- 1. trial_trainings — replace club_members-based admin policies with the real,
-- populated user_club_memberships table via is_club_admin(club_id).
-- ============================================================================

DROP POLICY IF EXISTS "Club admins can view trial trainings in their clubs" ON trial_trainings;
CREATE POLICY "Club admins can view trial trainings in their clubs" ON trial_trainings
  FOR SELECT USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can create trial trainings in their clubs" ON trial_trainings;
CREATE POLICY "Club admins can create trial trainings in their clubs" ON trial_trainings
  FOR INSERT WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can update trial trainings in their clubs" ON trial_trainings;
CREATE POLICY "Club admins can update trial trainings in their clubs" ON trial_trainings
  FOR UPDATE USING (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admins can delete trial trainings in their clubs" ON trial_trainings;
CREATE POLICY "Club admins can delete trial trainings in their clubs" ON trial_trainings
  FOR DELETE USING (is_club_admin(club_id));

-- ============================================================================
-- 2. fee_configurations — drop the redundant club_members-based duplicate.
-- "Members can view active fee configurations" (is_club_member-based, already
-- correct) already covers this exact case; this was a dead no-op duplicate.
-- ============================================================================

DROP POLICY IF EXISTS "Members can view active fee configurations in their clubs" ON fee_configurations;

-- ============================================================================
-- 2b. season_group_weeks — same club_members dependency, found only when the
-- DROP TABLE below first failed with a dependency error (first attempt at
-- this migration rolled back cleanly, no partial damage — single transaction).
-- ============================================================================

DROP POLICY IF EXISTS "season_group_weeks_admin_all" ON season_group_weeks;
CREATE POLICY "season_group_weeks_admin_all" ON season_group_weeks
  FOR ALL USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "season_group_weeks_member_read" ON season_group_weeks;
CREATE POLICY "season_group_weeks_member_read" ON season_group_weeks
  FOR SELECT USING (is_club_member(club_id));

-- ============================================================================
-- 3. Drop the dead table and the broken legacy function.
-- ============================================================================

DROP TABLE IF EXISTS public.club_members;

DROP FUNCTION IF EXISTS get_user_role();
