-- Add court_id column to bookings table
-- The column existed in schema design but was missing from production DB

-- Step 1: Add column as nullable first (so we can backfill)
ALTER TABLE bookings
ADD COLUMN court_id uuid REFERENCES courts(id) ON DELETE CASCADE;

-- Step 2: Backfill court_id from sessions table
UPDATE bookings b
SET court_id = s.court_id
FROM sessions s
WHERE b.session_id = s.id
AND b.court_id IS NULL;

-- Step 3: Now make it NOT NULL (all existing bookings should have a session with a court)
ALTER TABLE bookings
ALTER COLUMN court_id SET NOT NULL;