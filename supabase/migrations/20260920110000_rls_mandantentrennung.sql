-- Mandantentrennung: RLS-Policies, die Vereinsgrenzen ignorierten (Audit 20.09.2026).
--
--  * court_availability   SELECT für `public` mit true      -> Platzbelegung aller Vereine ohne Login lesbar
--  * gamification_points  SELECT authenticated true         -> Punkte aller Vereine für jeden Nutzer lesbar
--  * gamification_*       INSERT/UPDATE "Admin irgendeines Vereins" -> Admin A schreibt Punkte/Badges von Verein B
--  * gamification_badges  INSERT authenticated true         -> jeder Nutzer darf Badges anlegen
--  * registration_requests SELECT/UPDATE "Admin irgendeines Vereins" -> Admin A sieht/ändert Beitrittsanträge
--                          (Name, E-Mail, Adresse, Telefon) aller Vereine
--
-- Policy-Namen aus pg_policies der laufenden DB übernommen (AGENTS.md § Migrationen 1).

-- Ist der aktive Admin/Superadmin (oder Owner) im selben Verein wie der Zielnutzer?
CREATE OR REPLACE FUNCTION public.is_admin_of_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_owner() OR EXISTS (
    SELECT 1
    FROM user_club_memberships a
    JOIN user_club_memberships t ON t.club_id = a.club_id
    WHERE a.user_id = auth.uid()
      AND a.is_active = true
      AND a.role IN ('admin', 'superadmin')
      AND t.user_id = target_user_id
      AND t.is_active = true
  );
$$;

-- court_availability: nur Mitglieder des Vereins, dem der Platz gehört (Admins behalten ALL).
DROP POLICY IF EXISTS all_see_court_availability ON court_availability;
CREATE POLICY court_availability_select_members ON court_availability
  FOR SELECT TO authenticated
  USING (
    public.is_owner()
    OR public.is_club_member((SELECT c.club_id FROM courts c WHERE c.id = court_availability.court_id))
  );

-- gamification_points
DROP POLICY IF EXISTS gamification_points_select_authenticated ON gamification_points;
DROP POLICY IF EXISTS "Admins can insert gamification points" ON gamification_points;
DROP POLICY IF EXISTS "Admins can update gamification points" ON gamification_points;

CREATE POLICY gamification_points_select_same_club ON gamification_points
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.shares_active_club_with(user_id) OR public.is_owner());
CREATE POLICY gamification_points_insert_club_admin ON gamification_points
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_user(user_id));
CREATE POLICY gamification_points_update_club_admin ON gamification_points
  FOR UPDATE TO authenticated
  USING (public.is_admin_of_user(user_id))
  WITH CHECK (public.is_admin_of_user(user_id));

-- gamification_badges
DROP POLICY IF EXISTS "Everyone can view badges" ON gamification_badges;
DROP POLICY IF EXISTS gamification_badges_insert_authenticated ON gamification_badges;
DROP POLICY IF EXISTS "Admins can insert badges" ON gamification_badges;

CREATE POLICY gamification_badges_select_same_club ON gamification_badges
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.shares_active_club_with(user_id) OR public.is_owner());
CREATE POLICY gamification_badges_insert_club_admin ON gamification_badges
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_user(user_id));

-- registration_requests: Admins sehen/ändern nur Anträge des eigenen Vereins.
-- Öffentliches Einreichen bleibt (Anmeldeformular), aber nur als neuer, unbearbeiteter Antrag
-- für einen existierenden Verein.
DROP POLICY IF EXISTS "Admin can view registration requests" ON registration_requests;
DROP POLICY IF EXISTS "Admin can update registration" ON registration_requests;
DROP POLICY IF EXISTS "Anyone can insert registration" ON registration_requests;

CREATE POLICY registration_requests_select_club_admin ON registration_requests
  FOR SELECT TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY registration_requests_update_club_admin ON registration_requests
  FOR UPDATE TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id))
  WITH CHECK (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY registration_requests_insert_public ON registration_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND club_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM clubs c WHERE c.id = club_id)
  );
