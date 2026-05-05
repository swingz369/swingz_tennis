-- Add default_hourly_rate to clubs table
-- Created: 2026-05-05
-- Purpose: Allow clubs to configure their own hourly rate for billing

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS default_hourly_rate numeric(10,2) DEFAULT 15.00;

-- Add comment
COMMENT ON COLUMN clubs.default_hourly_rate IS 'Default hourly rate for court bookings in this club (in euros)';
