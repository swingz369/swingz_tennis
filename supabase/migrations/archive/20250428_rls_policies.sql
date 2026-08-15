-- RLS Policies für Multi-Tenant Tennisclub Management
-- V1 MVP: Jeder Verein (Tenant) sieht nur seine eigenen Daten

-- Enable RLS on all tables
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_club_memberships ENABLE ROW LEVEL SECURITY;

-- POLICY: Clubs – nur Mitglieder des Vereins dürfen zugreifen
CREATE POLICY "club_member_access" ON clubs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE club_id = clubs.id
      AND user_id = auth.uid()
    )
  );

-- POLICY: Schedules – über Club-Zugehörigkeit
CREATE POLICY "schedule_access_via_club" ON schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clubs c
      JOIN user_club_memberships m ON m.club_id = c.id
      WHERE c.id = schedules.club_id
      AND m.user_id = auth.uid()
    )
  );

-- POLICY: Sessions – über Schedule-Club verknüpfen
CREATE POLICY "session_access_via_schedule" ON sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schedules s
      JOIN clubs c ON s.club_id = c.id
      JOIN user_club_memberships m ON m.club_id = c.id
      WHERE s.id = sessions.schedule_id
      AND m.user_id = auth.uid()
    )
  );

-- POLICY: Bookings – Member sieht nur eigene Buchungen, Trainer/Admin sieht alle im Verein
CREATE POLICY "booking_access" ON bookings
  FOR ALL USING (
    member_id = auth.uid() -- eigene Buchungen
    OR
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE club_id = bookings.club_id
      AND user_id = auth.uid()
    )
  );

-- POLICY: Trainer – nur sichtbar für Mitglieder des eigenen Vereins
CREATE POLICY "trainer_club_access" ON trainers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trainer_club tc
      JOIN user_club_memberships m ON m.club_id = tc.club_id
      WHERE tc.trainer_id = trainers.id
      AND m.user_id = auth.uid()
    )
  );

-- POLICY: Courts – Club-Zugehörigkeit
CREATE POLICY "court_access" ON courts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE club_id = courts.club_id
      AND user_id = auth.uid()
    )
  );

-- POLICY: User Club Memberships – nur eigene Mitgliedschaften + Admin des Clubs
CREATE POLICY "club_membership_access" ON user_club_memberships
  FOR ALL USING (
    user_id = auth.uid() -- eigene Mitgliedschaft
    OR
    EXISTS (
      SELECT 1 FROM user_club_memberships m2
      WHERE m2.club_id = user_club_memberships.club_id
      AND m2.user_id = auth.uid()
      AND m2.role IN ('admin', 'superadmin')
    )
  );

-- POLICY: Trainer-Club Beziehungen – nur für Club-Admins sichtbar
CREATE POLICY "trainer_club_access_policy" ON trainer_club
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE club_id = trainer_club.club_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'superadmin')
    )
  );

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_user_club_memberships_user_id ON user_club_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_club_memberships_club_id ON user_club_memberships(club_id);
CREATE INDEX IF NOT EXISTS idx_sessions_trainer_id ON sessions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_member_id ON bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session_id ON bookings(session_id);
