-- trainer_club (ADR-005): trainer_club_access war FOR ALL für jedes aktive Vereinsmitglied — ein
-- Mitglied konnte Trainer-Zuordnungen seines Vereins anlegen, ändern oder löschen. Jetzt:
-- Lesen für Vereinsmitglieder (Trainer-/Nachrichten-Lookups), Schreiben nur für Vereins-Admins.
-- trainer_club_access_policy (Admin, ALL) bleibt; is_club_admin deckt sie ab und prüft is_active.
-- Live-Zustand am 19.09.2026 per pg_policies geprüft.

DROP POLICY IF EXISTS "trainer_club_access" ON trainer_club;
DROP POLICY IF EXISTS "trainer_club_access_policy" ON trainer_club;

CREATE POLICY "trainer_club_member_select" ON trainer_club
  FOR SELECT
  USING (is_club_member(club_id));

CREATE POLICY "trainer_club_admin_manage" ON trainer_club
  FOR ALL
  USING (is_club_admin(club_id))
  WITH CHECK (is_club_admin(club_id));
