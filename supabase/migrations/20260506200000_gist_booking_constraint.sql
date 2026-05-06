-- Migration: Add GIST Exclusion Constraint for Court Bookings
-- Prevents double-booking race conditions at database level
-- Pattern from INTEGRATION_ROADMAP.md Phase 2.3

-- ============================================
-- 1. Install btree_gist Extension (if not already installed)
-- ============================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================
-- 2. Clean Existing Duplicate Bookings (if any)
-- ============================================

-- First, find any existing overlapping bookings
-- This query identifies duplicates that would violate the constraint
WITH overlapping_bookings AS (
  SELECT 
    b1.id AS booking1_id,
    b2.id AS booking2_id,
    b1.court_id,
    b1.start_time AS b1_start,
    b1.end_time AS b1_end,
    b2.start_time AS b2_start,
    b2.end_time AS b2_end
  FROM bookings b1
  INNER JOIN bookings b2 
    ON b1.court_id = b2.court_id
    AND b1.id < b2.id  -- Avoid duplicate pairs
    AND tstzrange(b1.start_time, b1.end_time) && tstzrange(b2.start_time, b2.end_time)
  WHERE 
    b1.status NOT IN ('cancelled', 'rejected')
    AND b2.status NOT IN ('cancelled', 'rejected')
)
SELECT * FROM overlapping_bookings;

-- If duplicates exist, you need to manually resolve them before applying the constraint
-- Option 1: Cancel one of the overlapping bookings
-- UPDATE bookings SET status = 'cancelled', cancellation_reason = 'duplicate' 
-- WHERE id IN (SELECT booking2_id FROM overlapping_bookings);

-- Option 2: Adjust times to not overlap
-- UPDATE bookings SET end_time = ... WHERE id = ...;

-- ============================================
-- 3. Add GIST Exclusion Constraint
-- ============================================

-- This constraint ensures no two active bookings can overlap for the same court
ALTER TABLE bookings
ADD CONSTRAINT bookings_no_court_overlap
EXCLUDE USING GIST (
  court_id WITH =,
  tstzrange(start_time, end_time) WITH &&
)
WHERE (status NOT IN ('cancelled', 'rejected'));

-- Explanation:
-- - GIST (Generalized Search Tree) index allows range operations
-- - court_id WITH = : Same court must match
-- - tstzrange(start_time, end_time) WITH && : Time ranges must not overlap
-- - WHERE clause: Only applies to active bookings (cancelled ones can overlap)

-- ============================================
-- 4. Add Comments for Documentation
-- ============================================

COMMENT ON CONSTRAINT bookings_no_court_overlap ON bookings IS
'Prevents double-booking of courts by ensuring no two active bookings overlap in time for the same court. Uses GIST exclusion constraint for atomic enforcement at database level.';

-- ============================================
-- 5. Add Index for Query Performance
-- ============================================

-- Optimizes queries for finding available time slots
CREATE INDEX IF NOT EXISTS idx_bookings_court_time_active 
ON bookings USING GIST (
  court_id,
  tstzrange(start_time, end_time)
)
WHERE status NOT IN ('cancelled', 'rejected');

COMMENT ON INDEX idx_bookings_court_time_active IS
'Speeds up queries for finding available court time slots by indexing active bookings by court and time range.';

-- ============================================
-- 6. Test the Constraint
-- ============================================

-- This query should now FAIL with an exclusion constraint violation:
-- INSERT INTO bookings (court_id, start_time, end_time, status, ...)
-- VALUES ('court-1', '2026-05-06 10:00:00', '2026-05-06 11:00:00', 'confirmed', ...);
-- INSERT INTO bookings (court_id, start_time, end_time, status, ...)
-- VALUES ('court-1', '2026-05-06 10:30:00', '2026-05-06 11:30:00', 'confirmed', ...);
-- ^ Second insert will fail: overlaps with first booking

-- This query should SUCCEED (different court):
-- INSERT INTO bookings (court_id, start_time, end_time, status, ...)
-- VALUES ('court-2', '2026-05-06 10:30:00', '2026-05-06 11:30:00', 'confirmed', ...);

-- This query should SUCCEED (cancelled bookings can overlap):
-- INSERT INTO bookings (court_id, start_time, end_time, status, ...)
-- VALUES ('court-1', '2026-05-06 10:00:00', '2026-05-06 11:00:00', 'cancelled', ...);

-- ============================================
-- 7. Application-Level Handling
-- ============================================

-- In your application code, catch the constraint violation:
-- 
-- try {
--   await db.insert(bookings).values({
--     court_id: courtId,
--     start_time: startTime,
--     end_time: endTime,
--     status: 'confirmed',
--     ...
--   });
-- } catch (error) {
--   if (error.code === '23P01') {  // Exclusion constraint violation
--     throw new BookingConflictError(
--       'Court is already booked for this time slot',
--       { courtId, startTime, endTime }
--     );
--   }
--   throw error;
-- }
