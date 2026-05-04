-- Seed: 3 Vereine mit je 20 Mitgliedern und 3 Trainern
-- Ausführung in Supabase SQL Editor
-- Dieses Skript verwendet Service-Role und umgeht RLS

-- Vereine anlegen
INSERT INTO clubs (id, name, location, max_members, status, opening_hours, created_at, updated_at)
VALUES
  ('club-1', 'Tennis Club Berlin', 'Berlin', 100, 'active', 
   '{"monday":{"open":"09:00","close":"22:00"},"tuesday":{"open":"09:00","close":"22:00"},"wednesday":{"open":"09:00","close":"22:00"},"thursday":{"open":"09:00","close":"22:00"},"friday":{"open":"09:00","close":"22:00"},"saturday":{"open":"09:00","close":"22:00"},"sunday":{"open":"09:00","close":"22:00"}}',
   NOW(), NOW()),
  ('club-2', 'Squash Club Munich', 'Munich', 80, 'active',
   '{"monday":{"open":"09:00","close":"22:00"},"tuesday":{"open":"09:00","close":"22:00"},"wednesday":{"open":"09:00","close":"22:00"},"thursday":{"open":"09:00","close":"22:00"},"friday":{"open":"09:00","close":"22:00"},"saturday":{"open":"09:00","close":"22:00"},"sunday":{"open":"09:00","close":"22:00"}}',
   NOW(), NOW()),
  ('club-3', 'Badminton Club Hamburg', 'Hamburg', 60, 'active',
   '{"monday":{"open":"09:00","close":"22:00"},"tuesday":{"open":"09:00","close":"22:00"},"wednesday":{"open":"09:00","close":"22:00"},"thursday":{"open":"09:00","close":"22:00"},"friday":{"open":"09:00","close":"22:00"},"saturday":{"open":"09:00","close":"22:00"},"sunday":{"open":"09:00","close":"22:00"}}',
   NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Benutzer und Mitgliedschaften für Club 1 (20 Mitglieder, 3 Trainer, 1 Admin)
DO $$ 
DECLARE 
  i INTEGER;
BEGIN
  -- Mitglieder für Club 1
  FOR i IN 1..20 LOOP
    INSERT INTO users (id, email, full_name, first_name, last_name, created_at)
    VALUES (
      'club1-member-' || i,
      'member' || i || '@club1.test',
      'Member ' || i || ' (Berlin)',
      'Member' || i,
      'Test',
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO user_club_memberships (user_id, club_id, role, is_active, membership_start)
    VALUES (
      'club1-member-' || i,
      'club-1',
      'member',
      true,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Trainer für Club 1
  FOR i IN 1..3 LOOP
    INSERT INTO users (id, email, full_name, first_name, last_name, created_at)
    VALUES (
      'club1-trainer-' || i,
      'trainer' || i || '@club1.test',
      'Trainer ' || i || ' (Berlin)',
      'Trainer' || i,
      'Test',
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO user_club_memberships (user_id, club_id, role, is_active, membership_start)
    VALUES (
      'club1-trainer-' || i,
      'club-1',
      'trainer',
      true,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Admin für Club 1
  INSERT INTO users (id, email, full_name, first_name, last_name, created_at)
  VALUES (
    'club1-admin-1',
    'admin@club1.test',
    'Tennis Club Berlin Admin',
    'Admin',
    'Club1',
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_club_memberships (user_id, club_id, role, is_active, membership_start)
  VALUES (
    'club1-admin-1',
    'club-1',
    'admin',
    true,
    NOW()
  ) ON CONFLICT DO NOTHING;
END $$;

-- Benutzer und Mitgliedschaften für Club 2
DO $$ 
DECLARE 
  i INTEGER;
BEGIN
  -- Mitglieder für Club 2
  FOR i IN 1..20 LOOP
    INSERT INTO users (id, email, full_name, first_name, last_name, created_at)
    VALUES (
      'club2-member-' || i,
      'member' || i || '@club2.test',
      'Member ' || i || ' (Munich)',
      'Member' || i,
      'Test',
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO user_club_memberships (user_id, club_id, role, is_active, membership_start)
    VALUES (
      'club2-member-' || i,
      'club-2',
      'member',
      true,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Trainer für Club 2
  FOR i IN 1..3 LOOP
    INSERT INTO users (id, email, full_name, first_name, last_name, created_at)
    VALUES (
      'club2-trainer-' || i,
      'trainer' || i || '@club2.test',
      'Trainer ' || i || ' (Munich)',
      'Trainer' || i,
      'Test',
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO user_club_memberships (user_id, club_id, role, is_active, membership_start)
    VALUES (
      'club2-trainer-' || i,
      'club-2',
      'trainer',
      true,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Admin für Club 2
  INSERT INTO users (id, email, full_name, first_name, last_name, created_at)
  VALUES (
    'club2-admin-1',
    'admin@club2.test',
    'Squash Club Munich Admin',
    'Admin',
    'Club2',
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_club_memberships (user_id, club_id, role, is_active, membership_start)
  VALUES (
    'club2-admin-1',
    'club-2',
    'admin',
    true,
    NOW()
  ) ON CONFLICT DO NOTHING;
END $$;

-- Benutzer und Mitgliedschaften für Club 3
DO $$ 
DECLARE 
  i INTEGER;
BEGIN
  -- Mitglieder für Club 3
  FOR i IN 1..20 LOOP
    INSERT INTO users (id, email, full_name, first_name, last_name, created_at)
    VALUES (
      'club3-member-' || i,
      'member' || i || '@club3.test',
      'Member ' || i || ' (Hamburg)',
      'Member' || i,
      'Test',
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO user_club_memberships (user_id, club_id, role, is_active, membership_start)
    VALUES (
      'club3-member-' || i,
      'club-3',
      'member',
      true,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Trainer für Club 3
  FOR i IN 1..3 LOOP
    INSERT INTO users (id, email, full_name, first_name, last_name, created_at)
    VALUES (
      'club3-trainer-' || i,
      'trainer' || i || '@club3.test',
      'Trainer ' || i || ' (Hamburg)',
      'Trainer' || i,
      'Test',
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO user_club_memberships (user_id, club_id, role, is_active, membership_start)
    VALUES (
      'club3-trainer-' || i,
      'club-3',
      'trainer',
      true,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Admin für Club 3
  INSERT INTO users (id, email, full_name, first_name, last_name, created_at)
  VALUES (
    'club3-admin-1',
    'admin@club3.test',
    'Badminton Club Hamburg Admin',
    'Admin',
    'Club3',
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_club_memberships (user_id, club_id, role, is_active, membership_start)
  VALUES (
    'club3-admin-1',
    'club-3',
    'admin',
    true,
    NOW()
  ) ON CONFLICT DO NOTHING;
END $$;

-- Optional: Superadmin anlegen (falls noch nicht vorhanden)
INSERT INTO users (id, email, full_name, first_name, last_name, created_at)
VALUES (
  'superadmin-1',
  'superadmin@swingz.test',
  'Platform Superadmin',
  'Superadmin',
  'User',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Superadmin bekommt Mitgliedschaft in allen 3 Clubs als superadmin
INSERT INTO user_club_memberships (user_id, club_id, role, is_active, membership_start)
VALUES
  ('superadmin-1', 'club-1', 'superadmin', true, NOW()),
  ('superadmin-1', 'club-2', 'superadmin', true, NOW()),
  ('superadmin-1', 'club-3', 'superadmin', true, NOW())
ON CONFLICT DO NOTHING;
