-- „Eigene Zeile"-Policies ohne Vereins- und Spaltenschutz (05.10.2026)
--
-- Gleiches Muster wie shop_orders (20261005120000): Schreibrecht hing nur an
-- user_id = auth.uid(), Admin-Rechte an Helfern ohne Vereinsbezug der Zeile.
--
-- 1. tournament_registrations / tournament_matches: is_superadmin() ist global —
--    der Superadmin irgendeines Vereins verwaltete Anmeldungen und Spiele aller
--    Turniere. Mitglieder konnten sich in Turniere fremder Vereine eintragen und
--    status 'confirmed', seed und payment_status selbst setzen.
-- 2. special_event_registrations: own_registrations (ALL) erlaubte Anmeldungen zu
--    Events fremder Vereine mit beliebigem Status.
-- 3. qr_checkins: Check-in ohne Buchung und mit frei gewähltem Zeitpunkt; Admin/
--    Staff über is_admin_of_user/is_staff_of_user statt über den Verein der Session.

-- 1. Turniere ---------------------------------------------------------------
DROP POLICY IF EXISTS reg_insert ON public.tournament_registrations;
DROP POLICY IF EXISTS reg_manage ON public.tournament_registrations;
DROP POLICY IF EXISTS reg_select ON public.tournament_registrations;

CREATE POLICY reg_insert ON public.tournament_registrations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_club_member((SELECT t.club_id FROM public.tournaments t WHERE t.id = tournament_id))
    AND status = 'registered'
    AND payment_status = 'pending'
    AND seed IS NULL
  );
CREATE POLICY reg_manage ON public.tournament_registrations FOR ALL TO authenticated
  USING (public.is_club_admin((SELECT t.club_id FROM public.tournaments t WHERE t.id = tournament_id)))
  WITH CHECK (public.is_club_admin((SELECT t.club_id FROM public.tournaments t WHERE t.id = tournament_id)));
CREATE POLICY reg_select ON public.tournament_registrations FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_club_admin((SELECT t.club_id FROM public.tournaments t WHERE t.id = tournament_id))
  );

DROP POLICY IF EXISTS matches_manage ON public.tournament_matches;
DROP POLICY IF EXISTS matches_select ON public.tournament_matches;
CREATE POLICY matches_manage ON public.tournament_matches FOR ALL TO authenticated
  USING (public.is_club_admin((SELECT t.club_id FROM public.tournaments t WHERE t.id = tournament_id)))
  WITH CHECK (public.is_club_admin((SELECT t.club_id FROM public.tournaments t WHERE t.id = tournament_id)));
CREATE POLICY matches_select ON public.tournament_matches FOR SELECT TO authenticated
  USING (public.is_club_member((SELECT t.club_id FROM public.tournaments t WHERE t.id = tournament_id)));

-- 2. Sonderveranstaltungen --------------------------------------------------
DROP POLICY IF EXISTS own_registrations ON public.special_event_registrations;
DROP POLICY IF EXISTS admin_see_registrations ON public.special_event_registrations;
DROP POLICY IF EXISTS special_event_registrations_select ON public.special_event_registrations;
DROP POLICY IF EXISTS special_event_registrations_insert_own ON public.special_event_registrations;
DROP POLICY IF EXISTS special_event_registrations_delete_own ON public.special_event_registrations;
DROP POLICY IF EXISTS special_event_registrations_manage_admin ON public.special_event_registrations;

CREATE POLICY special_event_registrations_select ON public.special_event_registrations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_club_admin((SELECT e.club_id FROM public.special_events e WHERE e.id = event_id))
  );
CREATE POLICY special_event_registrations_insert_own ON public.special_event_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_club_member((SELECT e.club_id FROM public.special_events e WHERE e.id = event_id))
    AND status = 'registered'
  );
CREATE POLICY special_event_registrations_delete_own ON public.special_event_registrations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY special_event_registrations_manage_admin ON public.special_event_registrations
  FOR ALL TO authenticated
  USING (public.is_club_admin((SELECT e.club_id FROM public.special_events e WHERE e.id = event_id)))
  WITH CHECK (public.is_club_admin((SELECT e.club_id FROM public.special_events e WHERE e.id = event_id)));

-- 3. QR-Check-ins -----------------------------------------------------------
DROP POLICY IF EXISTS "Users can check in" ON public.qr_checkins;
DROP POLICY IF EXISTS qr_checkins_insert_own ON public.qr_checkins;
DROP POLICY IF EXISTS qr_checkins_delete_club_admin ON public.qr_checkins;
DROP POLICY IF EXISTS qr_checkins_update_club_admin ON public.qr_checkins;
DROP POLICY IF EXISTS qr_checkins_select_own_or_staff ON public.qr_checkins;

-- Einchecken nur mit eigener bestätigter Buchung genau dieser Session.
CREATE POLICY qr_checkins_insert_own ON public.qr_checkins FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bookings b
       WHERE b.id = booking_id
         AND b.session_id = qr_checkins.session_id
         AND b.member_id = auth.uid()
         AND b.status = 'confirmed'
    )
  );
CREATE POLICY qr_checkins_select_own_or_staff ON public.qr_checkins FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_club_trainer((SELECT c.club_id FROM public.sessions s JOIN public.courts c ON c.id = s.court_id WHERE s.id = session_id))
  );
CREATE POLICY qr_checkins_update_club_admin ON public.qr_checkins FOR UPDATE TO authenticated
  USING (public.is_club_admin((SELECT c.club_id FROM public.sessions s JOIN public.courts c ON c.id = s.court_id WHERE s.id = session_id)))
  WITH CHECK (public.is_club_admin((SELECT c.club_id FROM public.sessions s JOIN public.courts c ON c.id = s.court_id WHERE s.id = session_id)));
CREATE POLICY qr_checkins_delete_club_admin ON public.qr_checkins FOR DELETE TO authenticated
  USING (public.is_club_admin((SELECT c.club_id FROM public.sessions s JOIN public.courts c ON c.id = s.court_id WHERE s.id = session_id)));

-- Zeitpunkt setzt die DB (Default now()), nicht der Client.
REVOKE INSERT ON public.qr_checkins FROM authenticated;
GRANT INSERT (session_id, user_id, booking_id) ON public.qr_checkins TO authenticated;

REVOKE ALL ON public.qr_checkins, public.special_event_registrations,
  public.tournament_registrations, public.tournament_matches FROM anon;
