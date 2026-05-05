-- Add session_start_time column to bookings table for accurate cancellation policy
-- This is needed to fix the cancellation policy bug where bookedAt was incorrectly used

-- Step 1: Add column as nullable first
ALTER TABLE bookings 
ADD COLUMN session_start_time TIMESTAMP WITH TIME ZONE;

-- Step 2: Backfill data from sessions table
UPDATE bookings b
SET session_start_time = s.timeslot_start
FROM sessions s
WHERE b.session_id = s.id
AND b.session_start_time IS NULL;

-- Step 3: Make column NOT NULL now that data is populated
ALTER TABLE bookings 
ALTER COLUMN session_start_time SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN bookings.session_start_time IS 'Denormalized session start time for cancellation policy calculation without JOIN';
