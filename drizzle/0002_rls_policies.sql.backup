-- RLS Policies für SwingZ Multi-Tenant System
-- Jede Tabelle muss club_id haben und nur own-club Daten zugänglich sein

-- 1. clubs: Jeder kann nur eigenen Verein sehen (superadmin ausgenommen)
CREATE POLICY "clubs_select_own" ON clubs
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      id = (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND role = 'superadmin' LIMIT 1)
      OR id IN (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true)
    )
  );

-- 2. club_branding: Nur superadmin des Vereins
CREATE POLICY "branding_select_own" ON club_branding
  FOR SELECT USING (
    club_id IN (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "branding_update_own" ON club_branding
  FOR UPDATE USING (
    club_id IN (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND role = 'superadmin')
  );

-- 3. users (members): Nur Mitglieder des gleichen Vereins
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (
    id IN (SELECT user_id FROM user_club_memberships WHERE club_id IN (
      SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true
    ))
  );

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (
    id = auth.uid()
  );

-- 4. user_club_memberships: Nur für Mitglieder des Vereins
CREATE POLICY "memberships_select_own" ON user_club_memberships
  FOR SELECT USING (
    club_id IN (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true)
  );

-- 5. bookings: Nur Buchungen des eigenen Vereins
CREATE POLICY "bookings_select_own" ON bookings
  FOR SELECT USING (
    club_id IN (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "bookings_insert_own" ON bookings
  FOR INSERT WITH CHECK (
    club_id IN (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "bookings_update_own" ON bookings
  FOR UPDATE USING (
    club_id IN (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- 6. sessions
CREATE POLICY "sessions_select_own" ON sessions
  FOR SELECT USING (
    schedule_id IN (SELECT id FROM schedules WHERE club_id IN (
      SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true
    ))
  );

CREATE POLICY "sessions_insert_own" ON sessions
  FOR INSERT WITH CHECK (
    schedule_id IN (SELECT id FROM schedules WHERE club_id IN (
      SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
    ))
  );

-- 7. schedules
CREATE POLICY "schedules_select_own" ON schedules
  FOR SELECT USING (
    club_id IN (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "schedules_insert_own" ON schedules
  FOR INSERT WITH CHECK (
    club_id IN (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- 8. courts
CREATE POLICY "courts_select_own" ON courts
  FOR SELECT USING (
    club_id IN (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true)
  );

-- 9. trainers
CREATE POLICY "trainers_select_own" ON trainers
  FOR SELECT USING (
    id IN (SELECT trainer_id FROM trainer_clubs WHERE club_id IN (
      SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true
    ))
  );

-- 10. trainer_clubs
CREATE POLICY "trainer_clubs_select_own" ON trainer_clubs
  FOR SELECT USING (
    club_id IN (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true)
  );

-- 11. audit_logs
CREATE POLICY "audit_logs_select_own" ON audit_logs
  FOR SELECT USING (
    -- Nur superadmin und admin können Audit-Logs sehen
    EXISTS (SELECT 1 FROM user_club_memberships 
            WHERE user_id = auth.uid() 
              AND club_id = (SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() LIMIT 1)
              AND role IN ('superadmin', 'admin'))
  );
