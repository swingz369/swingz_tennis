-- Enable RLS
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_club ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_club_memberships ENABLE ROW LEVEL SECURITY;

-- Clubs: User can access if they are a member of the club
CREATE POLICY "clubs_access" ON clubs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE user_club_memberships.club_id = clubs.id
      AND user_club_memberships.user_id = auth.uid()
      AND user_club_memberships.is_active = true
    )
  );

-- Club Members: Club members can see other members of same club
CREATE POLICY "club_members_access" ON club_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = club_members.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

-- Trainers: Only accessible if trainer is assigned to a club the user belongs to
CREATE POLICY "trainers_access" ON trainers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trainer_club tc
      JOIN user_club_memberships ucm ON tc.club_id = ucm.club_id
      WHERE tc.trainer_id = trainers.id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

-- Trainer Club: RLS via club_id
CREATE POLICY "trainer_club_access" ON trainer_club
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = trainer_club.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

-- Courts: Accessible if user is member of the club
CREATE POLICY "courts_access" ON courts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = courts.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

-- Schedules: Accessible via club membership
CREATE POLICY "schedules_access" ON schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = schedules.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

-- Training Groups: Accessible via schedule's club
CREATE POLICY "training_groups_access" ON training_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schedules s
      JOIN user_club_memberships ucm ON s.club_id = ucm.club_id
      WHERE s.id = training_groups.schedule_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

-- Sessions: Accessible via schedule's club
CREATE POLICY "sessions_access" ON sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schedules s
      JOIN user_club_memberships ucm ON s.club_id = ucm.club_id
      WHERE s.id = sessions.schedule_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

-- Bookings: User can access their own bookings or bookings for their club
CREATE POLICY "bookings_access" ON bookings
  FOR ALL USING (
    bookings.member_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = bookings.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

-- Users: Users can only update their own record
CREATE POLICY "users_access" ON users
  FOR ALL USING (
    users.id = auth.uid()
  );

-- User Club Memberships: Users can see their own memberships
CREATE POLICY "user_club_memberships_access" ON user_club_memberships
  FOR ALL USING (
    user_club_memberships.user_id = auth.uid()
  );

-- INSERT policies for club memberships (admin only via service role in V1)
-- For regular users, membership creation goes through service role
