-- SWINGZ DB Seeding: Demo-Rollen (superadmin, admin, trainer, member)
-- directly executable in Supabase SQL Editor
-- Uses WHERE NOT EXISTS patterns (no unique constraints required)

-- 1. Insert Demo Club (idempotent, no ON CONFLICT needed)
INSERT INTO clubs (name, max_members, opening_hours, status, created_at, updated_at)
SELECT 
  'Demo Tennis Club',
  500,
  '{"monday":{"open":"08:00","close":"22:00"},"tuesday":{"open":"08:00","close":"22:00"},"wednesday":{"open":"08:00","close":"22:00"},"thursday":{"open":"08:00","close":"22:00"},"friday":{"open":"08:00","close":"22:00"},"saturday":{"open":"08:00","close":"20:00"},"sunday":{"open":"10:00","close":"18:00"}}'::jsonb,
  'active',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM clubs WHERE name = 'Demo Tennis Club');

-- 2. Insert Demo User (idempotent, email has UNIQUE constraint but we use WHERE NOT EXISTS for clarity)
INSERT INTO users (email, full_name, created_at, updated_at)
SELECT 'demo@swingz.com', 'Demo User', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo@swingz.com');

-- 3. Insert Memberships for all 4 roles (idempotent)
INSERT INTO user_club_memberships (user_id, club_id, role, joined_at, is_active, created_at)
SELECT 
  u.id,
  c.id,
  'superadmin',
  NOW() - INTERVAL '90 days',
  true,
  NOW()
FROM users u, clubs c
WHERE u.email = 'demo@swingz.com' AND c.name = 'Demo Tennis Club'
  AND NOT EXISTS (
    SELECT 1 FROM user_club_memberships m
    WHERE m.user_id = u.id AND m.club_id = c.id AND m.role = 'superadmin'
  );

INSERT INTO user_club_memberships (user_id, club_id, role, joined_at, is_active, created_at)
SELECT 
  u.id,
  c.id,
  'admin',
  NOW() - INTERVAL '60 days',
  true,
  NOW()
FROM users u, clubs c
WHERE u.email = 'demo@swingz.com' AND c.name = 'Demo Tennis Club'
  AND NOT EXISTS (
    SELECT 1 FROM user_club_memberships m
    WHERE m.user_id = u.id AND m.club_id = c.id AND m.role = 'admin'
  );

INSERT INTO user_club_memberships (user_id, club_id, role, joined_at, is_active, created_at)
SELECT 
  u.id,
  c.id,
  'trainer',
  NOW() - INTERVAL '30 days',
  true,
  NOW()
FROM users u, clubs c
WHERE u.email = 'demo@swingz.com' AND c.name = 'Demo Tennis Club'
  AND NOT EXISTS (
    SELECT 1 FROM user_club_memberships m
    WHERE m.user_id = u.id AND m.club_id = c.id AND m.role = 'trainer'
  );

INSERT INTO user_club_memberships (user_id, club_id, role, joined_at, is_active, created_at)
SELECT 
  u.id,
  c.id,
  'member',
  NOW() - INTERVAL '10 days',
  true,
  NOW()
FROM users u, clubs c
WHERE u.email = 'demo@swingz.com' AND c.name = 'Demo Tennis Club'
  AND NOT EXISTS (
    SELECT 1 FROM user_club_memberships m
    WHERE m.user_id = u.id AND m.club_id = c.id AND m.role = 'member'
  );

-- 4. Verification: shows all created memberships for the demo user
SELECT
  u.email,
  c.name AS club_name,
  m.role,
  m.joined_at,
  m.is_active
FROM user_club_memberships m
JOIN users u ON u.id = m.user_id
JOIN clubs c ON c.id = m.club_id
WHERE u.email = 'demo@swingz.com'
ORDER BY m.role;
