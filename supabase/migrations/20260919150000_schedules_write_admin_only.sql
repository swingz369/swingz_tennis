-- schedules (ADR-005): schedules_access und schedule_access_via_club waren FOR ALL für jedes
-- Vereinsmitglied (letztere nicht einmal auf aktive Mitgliedschaften beschränkt), und
-- schedules_* nutzte das plattformweite is_superadmin(). Jetzt: Lesen für Vereinsmitglieder,
-- Schreiben nur für Vereins-Admins (is_club_admin schließt superadmin je Verein ein) und Owner.
-- Im Code liest nur app/api/{sessions,bookings,dashboard} schedules; geschrieben wird aus der
-- Publish-Route (Admin). Live-Zustand am 19.09.2026 per pg_policies geprüft.

DROP POLICY IF EXISTS "schedules_access" ON schedules;
DROP POLICY IF EXISTS "schedule_access_via_club" ON schedules;

DROP POLICY IF EXISTS "schedules_select" ON schedules;
CREATE POLICY "schedules_select" ON schedules FOR SELECT
  USING (is_owner() OR is_club_member(club_id));

DROP POLICY IF EXISTS "schedules_insert" ON schedules;
CREATE POLICY "schedules_insert" ON schedules FOR INSERT
  WITH CHECK (is_owner() OR is_club_admin(club_id));

DROP POLICY IF EXISTS "schedules_update" ON schedules;
CREATE POLICY "schedules_update" ON schedules FOR UPDATE
  USING (is_owner() OR is_club_admin(club_id))
  WITH CHECK (is_owner() OR is_club_admin(club_id));

DROP POLICY IF EXISTS "schedules_delete" ON schedules;
CREATE POLICY "schedules_delete" ON schedules FOR DELETE
  USING (is_owner() OR is_club_admin(club_id));
