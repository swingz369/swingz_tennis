-- Live am 26.09.2026 geprüft (lokal und Produktion identisch): Policy
-- `booking_access` (ALL) erlaubt jedem mit irgendeiner Mitgliedschaft im Verein
-- – ohne Rolle, ohne is_active – fremde Buchungen zu ändern und zu löschen.
-- RLS verknüpft permissive Policies mit OR, also hebelt sie bookings_update/
-- bookings_delete aus. Die zwei weiteren Alt-Policies sind echte Teilmengen von
-- bookings_insert/bookings_update und fallen mit weg.
DROP POLICY IF EXISTS booking_access ON public.bookings;
DROP POLICY IF EXISTS "Members can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Members can update their bookings" ON public.bookings;

-- Der Gruppenwechsel (Trainer erlaubt, lib/services/group-change.service.ts)
-- löscht Buchungen mit dem Nutzer-Client. Das ging bisher nur über
-- booking_access; jetzt ausdrücklich für aktive Trainer/Admins des Vereins.
DROP POLICY IF EXISTS bookings_delete ON public.bookings;
CREATE POLICY bookings_delete ON public.bookings FOR DELETE
  USING (is_owner() OR is_club_trainer(club_id));
