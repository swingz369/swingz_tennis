-- ============================================================
-- SWINGZ: Seed example user club memberships with all roles
-- ============================================================
-- This script creates a demo user (if not exists) and assigns
-- all four role types (superadmin, admin, trainer, member) to
-- that user across different clubs or same club for testing.
--
-- Usage: Run in Supabase SQL Editor or via supabase CLI
-- ============================================================

-- 1. Ensure a demo user exists (or use an existing one)
--    Adjust email as needed; this creates user if missing.
INSERT INTO users (id, email, full_name, created_at, updated_at)
SELECT gen_random_uuid(), 'demo@swingz.com', 'Demo User', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo@swingz.com')
RETURNING id INTO STRICT demo_user_id;

-- Get the user ID into a variable for reuse
DO $$
DECLARE
  demo_user_id uuid;
  demo_club_id uuid;
BEGIN
  SELECT id INTO demo_user_id FROM users WHERE email = 'demo@swingz.com' LIMIT 1;

  -- 2. Ensure a demo club exists
  INSERT INTO clubs (id, name, max_members, opening_hours, status, created_at, updated_at)
  SELECT gen_random_uuid(), 'Demo Tennis Club', 500,
         '{"monday":{"open":"08:00","close":"22:00"},"tuesday":{"open":"08:00","close":"22:00"},"wednesday":{"open":"08:00","close":"22:00"},"thursday":{"open":"08:00","close":"22:00"},"friday":{"open":"08:00","close":"22:00"},"saturday":{"open":"08:00","close":"20:00"},"sunday":{"open":"10:00","close":"18:00"}}'::jsonb,
         'active', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM clubs WHERE name = 'Demo Tennis Club')
  RETURNING id INTO demo_club_id;

  SELECT id INTO demo_club_id FROM clubs WHERE name = 'Demo Tennis Club' LIMIT 1;

  -- 3. Seed memberships with all roles
  --    If a membership for (user, club, role) already exists, skip it.
  --
  --    superadmin  – full system access across all clubs
  --    admin       – club-level administration
  --    trainer     – can create/manage sessions, view bookings
  --    member      – standard member, can book sessions

  INSERT INTO user_club_memberships (user_id, club_id, role, joined_at, is_active, created_at)
  SELECT demo_user_id, demo_club_id, 'superadmin', NOW() - INTERVAL '90 days', true, NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = demo_user_id AND club_id = demo_club_id AND role = 'superadmin'
  );

  INSERT INTO user_club_memberships (user_id, club_id, role, joined_at, is_active, created_at)
  SELECT demo_user_id, demo_club_id, 'admin', NOW() - INTERVAL '60 days', true, NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = demo_user_id AND club_id = demo_club_id AND role = 'admin'
  );

  INSERT INTO user_club_memberships (user_id, club_id, role, joined_at, is_active, created_at)
  SELECT demo_user_id, demo_club_id, 'trainer', NOW() - INTERVAL '30 days', true, NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = demo_user_id AND club_id = demo_club_id AND role = 'trainer'
  );

  INSERT INTO user_club_memberships (user_id, club_id, role, joined_at, is_active, created_at)
  SELECT demo_user_id, demo_club_id, 'member', NOW() - INTERVAL '10 days', true, NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = demo_user_id AND club_id = demo_club_id AND role = 'member'
  );

  RAISE NOTICE 'Seeding complete for user % in club %', demo_user_id, demo_club_id;
END $$;

-- ============================================================
-- Optional: Verify seeded data
-- ============================================================
-- SELECT
--   u.email,
--   c.name AS club_name,
--   m.role,
--   m.joined_at,
--   m.is_active
-- FROM user_club_memberships m
-- JOIN users u ON u.id = m.user_id
-- JOIN clubs c ON c.id = m.club_id
-- WHERE u.email = 'demo@swingz.com'
-- ORDER BY m.role;
