-- k8s/rls-policies.sql
-- Multi-Tenant RLS Policies

-- Clubs: Superadmin can see all, regular users only their clubs
CREATE POLICY "clubs_multi_tenant_access" ON clubs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = clubs.id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.user_id = auth.uid()
      AND ucm.role = 'superadmin'
    )
  );

-- Users: Superadmin can see all users
CREATE POLICY "users_superadmin_access" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.user_id = auth.uid()
      AND ucm.role = 'superadmin'
    )
  );

-- Tenant-Specific Data Isolation
CREATE POLICY "tenant_data_isolation" ON schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = schedules.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.tenant_id = (SELECT tenant_id FROM user_club_memberships WHERE user_id = auth.uid() LIMIT 1)
    )
  );
