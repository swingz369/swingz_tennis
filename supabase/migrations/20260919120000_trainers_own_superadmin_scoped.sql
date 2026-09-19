-- trainers_own (ADR-005): is_superadmin() ist plattformweit — jeder Superadmin sah per RLS ALLE
-- Trainer. Zugewiesene Vereine deckt trainers_admin_select ab (is_club_admin schließt die
-- Rolle superadmin je Verein ein), daher entfällt der Zweig ersatzlos.
-- Live-Zustand am 19.09.2026 per pg_policies geprüft.

DROP POLICY IF EXISTS "trainers_own" ON trainers;
CREATE POLICY "trainers_own" ON trainers
  FOR SELECT
  USING (id = auth.uid() OR user_id = auth.uid() OR id = get_my_trainer_id());
