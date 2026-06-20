-- Migration: Absence Tracking Index
-- Adds a composite index on bookings to speed up no_show queries per member.

CREATE INDEX IF NOT EXISTS idx_bookings_status_member
  ON bookings(member_id, status, created_at);
