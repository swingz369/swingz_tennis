-- Add rejection_reason column to hours_logs table
ALTER TABLE hours_logs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
