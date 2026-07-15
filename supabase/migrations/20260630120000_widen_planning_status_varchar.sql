-- Fix: widen planning_status column from varchar(20) to varchar(30)
-- 'collecting_preferences' (23 chars) exceeds the old varchar(20) limit.
ALTER TABLE seasons ALTER COLUMN planning_status TYPE varchar(30);
