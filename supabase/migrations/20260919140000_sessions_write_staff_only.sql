-- sessions (ADR-005): sessions_access und session_access_via_schedule waren FOR ALL für jedes
-- Vereinsmitglied (session_access_via_schedule nicht einmal auf aktive Mitgliedschaften
-- beschränkt) — ein Mitglied konnte Termine seines Vereins ändern oder löschen. Lesen bleibt über
-- "Club members can view sessions"; Schreiben regeln sessions_insert/_update (Trainer/Admin) und
-- sessions_delete (Admin). Mitglieder-Flows (Buchen, Absagen, RSVP) schreiben über den
-- Service-Client bzw. lesen nur — am 19.09.2026 in app/api/{bookings,sessions} geprüft.
-- Live-Zustand am 19.09.2026 per pg_policies geprüft.

DROP POLICY IF EXISTS "sessions_access" ON sessions;
DROP POLICY IF EXISTS "session_access_via_schedule" ON sessions;
