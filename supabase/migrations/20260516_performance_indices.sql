-- Migration: Performance Indices for Frequently Queried Columns
-- Adds missing indices on club_id, user_id, created_at, and is_active
-- for tables that don't already have them.

-- ============================================================
-- Users table: index on created_at for sorting/filtering
-- ============================================================
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at);
CREATE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

-- ============================================================
-- Courts table: index on club_id (FK) for multi-tenant queries
-- ============================================================
CREATE INDEX IF NOT EXISTS courts_club_id_idx ON courts (club_id);
CREATE INDEX IF NOT EXISTS courts_is_active_idx ON courts (is_active);
CREATE INDEX IF NOT EXISTS courts_club_active_idx ON courts (club_id, is_active);

-- ============================================================
-- Schedules table: index on club_id (FK) for multi-tenant queries
-- ============================================================
CREATE INDEX IF NOT EXISTS schedules_club_id_idx ON schedules (club_id);
CREATE INDEX IF NOT EXISTS schedules_is_active_idx ON schedules (is_active);
CREATE INDEX IF NOT EXISTS schedules_club_active_idx ON schedules (club_id, is_active);

-- ============================================================
-- Training Groups: index on schedule_id (FK)
-- ============================================================
CREATE INDEX IF NOT EXISTS training_groups_schedule_id_idx ON training_groups (schedule_id);
CREATE INDEX IF NOT EXISTS training_groups_is_active_idx ON training_groups (is_active);

-- ============================================================
-- Trainers table: index on is_active for filtering
-- ============================================================
CREATE INDEX IF NOT EXISTS trainers_is_active_idx ON trainers (is_active);
CREATE INDEX IF NOT EXISTS trainers_name_idx ON trainers (name);

-- ============================================================
-- User Club Memberships: index on created_at for recent joins
-- ============================================================
CREATE INDEX IF NOT EXISTS user_club_memberships_created_at_idx ON user_club_memberships (created_at);
CREATE INDEX IF NOT EXISTS user_club_memberships_is_active_idx ON user_club_memberships (is_active);

-- ============================================================
-- Audit Logs: composite index for filtered queries
-- ============================================================
CREATE INDEX IF NOT EXISTS audit_logs_resource_type_idx ON audit_logs (resource_type);
CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx ON audit_logs (actor_id, created_at DESC);

-- ============================================================
-- Season Plan Entries: index on created_at
-- ============================================================
CREATE INDEX IF NOT EXISTS season_plan_entries_created_at_idx ON season_plan_entries (created_at);

-- ============================================================
-- User Training Preferences: index on created_at
-- ============================================================
CREATE INDEX IF NOT EXISTS user_training_preferences_created_at_idx ON user_training_preferences (created_at);

-- ============================================================
-- Trial Trainings: index on created_at
-- ============================================================
CREATE INDEX IF NOT EXISTS trial_trainings_created_at_idx ON trial_trainings (created_at);
