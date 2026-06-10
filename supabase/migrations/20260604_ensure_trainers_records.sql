-- Migration: Ensure trainers records exist for all trainer-role users
-- Fixes: trainer_availabilities.trainer_id → trainers.id FK mismatch
-- The app expects trainers.id === users.id for all trainer users.
-- This migration creates missing trainers records and aligns existing ones.
--
-- Run: psql "$DATABASE_URL" -f supabase/migrations/20260604_ensure_trainers_records.sql
-- Or: execute in Supabase SQL Editor

BEGIN;

-- 1. Create missing trainers records for trainer-role users
--    Sets trainers.id = users.id to match the FK expectation
INSERT INTO trainers (id, email, name, specialties, max_hours_per_week, is_active, created_at, updated_at)
SELECT
    ucm.user_id AS id,
    COALESCE(u.email, ucm.user_id || '@trainer.swingz.local') AS email,
    COALESCE(u.full_name, 'Trainer') AS name,
    '[]'::jsonb AS specialties,
    30 AS max_hours_per_week,
    true AS is_active,
    COALESCE(ucm.created_at, now()) AS created_at,
    now() AS updated_at
FROM user_club_memberships ucm
LEFT JOIN users u ON u.id = ucm.user_id
WHERE ucm.role = 'trainer'
  AND ucm.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM trainers t WHERE t.id = ucm.user_id
  )
ON CONFLICT (id) DO UPDATE
SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    is_active = true,
    updated_at = now();

-- 2. Report any trainers records that have IDs NOT matching any user (orphaned/seed records)
--    These records are kept but logged for review
DO $$
DECLARE
    orphan_count integer;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM trainers t
    WHERE NOT EXISTS (
        SELECT 1 FROM user_club_memberships ucm
        WHERE ucm.user_id = t.id AND ucm.role = 'trainer'
    );

    IF orphan_count > 0 THEN
        RAISE NOTICE '[ensure_trainers_records] Found % orphaned trainers records (no matching user_club_memberships). These will be kept but may need manual cleanup.', orphan_count;
    END IF;
END $$;

COMMIT;
