# Production Setup Guide

## Problem: Admin User Missing in Production

The production deployment is missing the admin user `admin@swingz.com`, which causes login failures.

## Solution Steps

### 1. Create Admin User in Supabase Dashboard

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click "Add user" → "Create new user"
3. Enter:
   - **Email**: `admin@swingz.com`
   - **Password**: `Admin123!` (or your preferred secure password)
   - **Email Confirm**: ✅ Check "Auto Confirm User"
4. Click "Create user"
5. **Copy the User UUID** (you'll need this for step 2)

### 2. Run Setup SQL in Supabase SQL Editor

Go to **Supabase Dashboard** → **SQL Editor** → Create new query

```sql
-- Replace YOUR-USER-UUID-HERE with the UUID from step 1
DO $$
DECLARE
  admin_user_id UUID := 'YOUR-USER-UUID-HERE'::UUID;
  demo_club_id UUID;
BEGIN
  -- Create or update user profile
  INSERT INTO public.users (id, email, full_name, created_at, updated_at)
  VALUES (admin_user_id, 'admin@swingz.com', 'System Admin', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      updated_at = NOW();

  -- Get or create a demo club
  INSERT INTO public.clubs (id, name, slug, status, max_members, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Demo Tennis Club',
    'demo-club',
    'active',
    500,
    NOW(),
    NOW()
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO demo_club_id;

  -- If club already exists, get its ID
  IF demo_club_id IS NULL THEN
    SELECT id INTO demo_club_id FROM public.clubs WHERE slug = 'demo-club' LIMIT 1;
  END IF;

  -- Create superadmin membership
  INSERT INTO public.user_club_memberships (
    id,
    user_id,
    club_id,
    role,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    admin_user_id,
    demo_club_id,
    'superadmin',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, club_id) DO UPDATE
  SET role = 'superadmin',
      is_active = true,
      updated_at = NOW();

  RAISE NOTICE 'Admin user setup complete! User ID: %, Club ID: %', admin_user_id, demo_club_id;
END $$;
```

### 3. Verify Setup

Run this query to verify:

```sql
SELECT
  u.id as user_id,
  u.email,
  u.full_name,
  ucm.role,
  ucm.is_active,
  c.name as club_name,
  c.slug as club_slug
FROM users u
JOIN user_club_memberships ucm ON u.id = ucm.user_id
JOIN clubs c ON ucm.club_id = c.id
WHERE u.email = 'admin@swingz.com';
```

You should see:

- ✅ User with email `admin@swingz.com`
- ✅ Role: `superadmin`
- ✅ Active: `true`
- ✅ Club: `Demo Tennis Club`

### 4. Test Login

1. Go to https://swingz.vercel.app/login
2. Enter:
   - Email: `admin@swingz.com`
   - Password: `Admin123!` (or your chosen password)
3. Click "Anmelden"
4. You should be redirected to `/dashboard`

## Alternative: Automated Seed Script

If you prefer to seed the entire database with demo data, run:

```bash
# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run seed script
npm run seed
```

This will create:

- 3 demo clubs
- 10+ users with various roles
- Sample bookings and trainings

## Troubleshooting

### Login still fails with 401

1. Check Supabase logs: Dashboard → Logs → Auth
2. Verify user exists: Dashboard → Authentication → Users
3. Verify RLS policies are enabled but not blocking: Dashboard → Database → Policies

### Redirected to landing page after login

This indicates the auth middleware is not finding valid club memberships. Check:

1. User has a club membership: `SELECT * FROM user_club_memberships WHERE user_id = 'your-uuid'`
2. Club exists and is active: `SELECT * FROM clubs WHERE id = 'club-id'`
3. RLS policies allow reading: Test with service role key

### Dashboard shows "No memberships"

The user needs at least one active club membership. Re-run the SQL from step 2.
