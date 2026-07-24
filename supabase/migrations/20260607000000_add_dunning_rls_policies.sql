-- ═══════════════════════════════════════════════════════════════
-- Migration: Fehlende RLS-Policies für dunning_records
-- club_id + member_id existieren jetzt → Policies können greifen
-- Die Spalten wurden in 20260607_sync_dunning_records.sql ergänzt
-- ═══════════════════════════════════════════════════════════════

-- 1. Members können ihre eigenen Dunning-Records sehen
--    (member_id match ODER Club-Admin über user_club_memberships)
DROP POLICY IF EXISTS "members_can_view_own_dunning" ON dunning_records;
CREATE POLICY "members_can_view_own_dunning" ON dunning_records
  FOR SELECT USING (
    member_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = dunning_records.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- 2. Admins können Dunning-Records verwalten (INSERT/UPDATE/DELETE/SELECT)
--    Berechtigung nur für aktive Admins des jeweiligen Vereins
DROP POLICY IF EXISTS "admins_can_manage_dunning" ON dunning_records;
CREATE POLICY "admins_can_manage_dunning" ON dunning_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = dunning_records.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );
