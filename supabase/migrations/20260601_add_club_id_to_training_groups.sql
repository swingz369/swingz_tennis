-- =============================================================================
-- MIGRATION: Add club_id to training_groups for direct multi-club scoping
-- =============================================================================
-- Previously, club scoping for training_groups was done indirectly by joining
-- through schedules (training_groups.schedule_id → schedules.club_id).
-- This migration adds a direct club_id column, enabling simpler, faster queries
-- and proper multi-tenant isolation.
--
-- Run with: psql "$DATABASE_URL" -f supabase/migrations/20260601_add_club_id_to_training_groups.sql
-- =============================================================================

BEGIN;

-- Step 1: Add nullable club_id column (nullable first to allow safe backfill)
ALTER TABLE training_groups
    ADD COLUMN IF NOT EXISTS club_id UUID;

-- Step 2: Backfill club_id from schedules for all existing rows
--         training_groups.schedule_id → schedules.id → schedules.club_id
UPDATE training_groups tg
SET club_id = s.club_id
FROM schedules s
WHERE tg.schedule_id = s.id
  AND tg.club_id IS NULL;

-- Step 3: Verify no rows are left without club_id
--         (fails if any training_group references a non-existent schedule)
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM training_groups WHERE club_id IS NULL;
    IF null_count > 0 THEN
        RAISE EXCEPTION 'Backfill failed: % training_groups still have NULL club_id after backfill', null_count;
    END IF;
END $$;

-- Step 4: Make club_id NOT NULL now that all rows have values
ALTER TABLE training_groups
    ALTER COLUMN club_id SET NOT NULL;

-- Step 5: Add foreign key constraint to clubs (idempotent, following Drizzle pattern)
DO $$
BEGIN
    ALTER TABLE training_groups
        ADD CONSTRAINT training_groups_club_id_clubs_id_fk
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN RAISE NOTICE 'FK constraint already exists, skipping.';
END $$;

-- Step 6: Add indexes for efficient club-scoped queries
CREATE INDEX IF NOT EXISTS training_groups_club_idx ON training_groups (club_id);
CREATE INDEX IF NOT EXISTS training_groups_club_active_idx ON training_groups (club_id, is_active);

-- Step 7: Update the RLS policy to use direct club_id (much faster than JOIN through schedules)
--         Drop the old policy first, then create the new one.
DROP POLICY IF EXISTS "training_groups_access" ON training_groups;

CREATE POLICY "training_groups_access" ON training_groups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_club_memberships ucm
            WHERE ucm.club_id = training_groups.club_id
            AND ucm.user_id = auth.uid()
            AND ucm.is_active = true
        )
    );

-- Also update the enhanced RLS policies from 004_enhanced_rls_policies.sql
DROP POLICY IF EXISTS "training_groups_select_admin" ON training_groups;
DROP POLICY IF EXISTS "training_groups_manage_admin" ON training_groups;

CREATE POLICY "training_groups_select_admin" ON training_groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_club_memberships ucm
            WHERE ucm.club_id = training_groups.club_id
            AND ucm.user_id = auth.uid()
            AND ucm.role IN ('admin', 'superadmin')
            AND ucm.is_active = true
        )
    );

CREATE POLICY "training_groups_manage_admin" ON training_groups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_club_memberships ucm
            WHERE ucm.club_id = training_groups.club_id
            AND ucm.user_id = auth.uid()
            AND ucm.role IN ('admin', 'superadmin')
            AND ucm.is_active = true
        )
    );

COMMIT;
