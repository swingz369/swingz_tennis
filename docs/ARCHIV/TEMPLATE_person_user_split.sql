-- ============================================================
-- Person/User Split Migration (TEMPLATE - NOT APPLIED)
-- Pattern from INTEGRATION_ROADMAP.md Phase 5 (Week 17)
-- ============================================================
--
-- This migration is a TEMPLATE for implementing the Person/User split
-- pattern from TSOWAPP. It supports:
-- - Offline members (minors, non-digital users)
-- - Persons without accounts
-- - Family relationships
--
-- ⚠️ WARNING: This is a breaking change that requires:
--   1. Data migration from users → persons
--   2. Update all repositories to join persons table
--   3. Update all UI to handle persons without users
--
-- Only apply this migration if offline member management is required.
--
-- ============================================================

-- ============================================================
-- Step 1: Create Persons Table
-- ============================================================

CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  
  -- Contact
  email TEXT, -- Optional (offline members may not have email)
  phone TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'DE',
  
  -- Relationships
  user_id UUID REFERENCES auth.users(id), -- NULL for offline members
  parent_id UUID REFERENCES persons(id), -- For minors
  
  -- Membership
  member_number TEXT UNIQUE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_minor BOOLEAN GENERATED ALWAYS AS (date_of_birth > CURRENT_DATE - INTERVAL '18 years') STORED,
  
  -- Medical info (optional)
  medical_notes TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_persons_user_id ON persons(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_persons_parent_id ON persons(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_persons_email ON persons(email) WHERE email IS NOT NULL;
CREATE INDEX idx_persons_member_number ON persons(member_number) WHERE member_number IS NOT NULL;
CREATE INDEX idx_persons_is_active ON persons(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_persons_full_name ON persons(full_name);

-- ============================================================
-- Step 2: Migrate Existing Users → Persons
-- ============================================================

-- Migrate existing users to persons table
INSERT INTO persons (
  id,
  first_name,
  last_name,
  email,
  user_id,
  created_at,
  updated_at
)
SELECT 
  u.id,
  COALESCE(SPLIT_PART(u.full_name, ' ', 1), u.email), -- Extract first name
  COALESCE(SPLIT_PART(u.full_name, ' ', 2), ''), -- Extract last name
  u.email,
  u.id, -- Link person to user
  u.created_at,
  u.updated_at
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Step 3: Update user_club_memberships to reference persons
-- ============================================================

-- Add person_id column
ALTER TABLE user_club_memberships
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id);

-- Populate person_id from user_id
UPDATE user_club_memberships
SET person_id = user_id
WHERE person_id IS NULL;

-- Make person_id NOT NULL after migration
-- (Commented out - only run after verifying migration)
-- ALTER TABLE user_club_memberships
--   ALTER COLUMN person_id SET NOT NULL;

-- Add index
CREATE INDEX idx_user_club_memberships_person_id ON user_club_memberships(person_id);

-- ============================================================
-- Step 4: RLS Policies for Persons
-- ============================================================

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;

-- Superadmin can see all persons
CREATE POLICY "persons_superadmin_all" ON persons
  FOR ALL
  USING (is_superadmin());

-- Users can see their own person record
CREATE POLICY "persons_own_record" ON persons
  FOR SELECT
  USING (user_id = auth.uid());

-- Parents can see their children
CREATE POLICY "persons_parent_children" ON persons
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    parent_id IN (
      SELECT id FROM persons WHERE user_id = auth.uid()
    )
  );

-- Admins can see persons in their clubs
CREATE POLICY "persons_admin_club" ON persons
  FOR SELECT
  USING (
    is_superadmin() OR
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.person_id = persons.id
        AND ucm.club_id = ANY(get_user_club_ids())
    )
  );

-- ============================================================
-- Step 5: Helper Functions
-- ============================================================

-- Function to create offline member
CREATE OR REPLACE FUNCTION create_offline_member(
  p_first_name TEXT,
  p_last_name TEXT,
  p_date_of_birth DATE,
  p_parent_id UUID DEFAULT NULL,
  p_club_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_person_id UUID;
BEGIN
  -- Create person (without user account)
  INSERT INTO persons (
    first_name,
    last_name,
    date_of_birth,
    parent_id,
    email,
    phone,
    user_id -- NULL for offline members
  ) VALUES (
    p_first_name,
    p_last_name,
    p_date_of_birth,
    p_parent_id,
    p_email,
    p_phone,
    NULL
  )
  RETURNING id INTO v_person_id;
  
  -- Add club membership if provided
  IF p_club_id IS NOT NULL THEN
    INSERT INTO user_club_memberships (
      person_id,
      club_id,
      role,
      is_active
    ) VALUES (
      v_person_id,
      p_club_id,
      'member',
      TRUE
    );
  END IF;
  
  RETURN v_person_id;
END;
$$;

-- Function to link person to user account
CREATE OR REPLACE FUNCTION link_person_to_user(
  p_person_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE persons
  SET 
    user_id = p_user_id,
    updated_at = NOW()
  WHERE id = p_person_id
    AND user_id IS NULL; -- Only link if not already linked
  
  RETURN FOUND;
END;
$$;

-- ============================================================
-- Step 6: Repository Updates (TypeScript Example)
-- ============================================================

/*
Example TypeScript repository update:

// Before (users only)
const { data: members } = await supabase
  .from('users')
  .select('*')
  .eq('club_id', clubId);

// After (persons with optional users)
const { data: members } = await supabase
  .from('persons')
  .select(`
    *,
    user:auth.users(id, email),
    parent:persons!parent_id(first_name, last_name),
    memberships:user_club_memberships(*)
  `)
  .eq('memberships.club_id', clubId)
  .eq('is_active', true);
*/

-- ============================================================
-- Step 7: Cleanup (Optional - Only after migration verified)
-- ============================================================

-- After verifying migration works:
-- 1. Remove user_id from user_club_memberships (replaced by person_id)
-- 2. Update all foreign keys to reference persons instead of users
-- 3. Add NOT NULL constraint to person_id where appropriate

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE persons IS 'Person records supporting both online (with user_id) and offline (without user_id) members';
COMMENT ON COLUMN persons.user_id IS 'Link to auth.users for online members (NULL for offline members like minors)';
COMMENT ON COLUMN persons.parent_id IS 'Link to parent person for minors';
COMMENT ON COLUMN persons.is_minor IS 'Auto-calculated: TRUE if date_of_birth < 18 years ago';
COMMENT ON FUNCTION create_offline_member IS 'Create person record for offline member (no user account needed)';
COMMENT ON FUNCTION link_person_to_user IS 'Link existing person to newly created user account';

-- ============================================================
-- Migration Checklist
-- ============================================================

/*
Before applying this migration:

1. ✅ Backup production database
2. ✅ Test migration in dev environment
3. ✅ Update all repositories to use persons table
4. ✅ Update all UI to handle persons without users
5. ✅ Update all API routes to handle offline members
6. ✅ Test with real data
7. ✅ Verify parent/child relationships work
8. ✅ Verify RLS policies prevent data leakage
9. ✅ Document offline member management workflow
10. ✅ Train team on new person/user pattern

After migration:
1. ✅ Verify all existing users migrated to persons
2. ✅ Verify memberships updated with person_id
3. ✅ Test creating offline members
4. ✅ Test linking persons to user accounts
5. ✅ Monitor for errors in production logs
*/
