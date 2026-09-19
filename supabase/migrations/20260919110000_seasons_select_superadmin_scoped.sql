-- seasons_select (ADR-005): is_superadmin() ist plattformweit — jeder Superadmin sah per RLS die
-- Saisons ALLER Vereine. Superadmins sind nur für zugewiesene Vereine zuständig; ihre
-- Membership-Zeile (Rolle superadmin) wird von is_club_member(club_id) bereits erfasst.
-- Live-Zustand am 19.09.2026 per pg_policies geprüft.

DROP POLICY IF EXISTS "seasons_select" ON seasons;
CREATE POLICY "seasons_select" ON seasons
  FOR SELECT
  USING (is_club_member(club_id));
