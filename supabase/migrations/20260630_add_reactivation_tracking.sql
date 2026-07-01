-- 20260630_add_reactivation_tracking.sql
-- Sprint 4 Q2 — Ticket 2.5.2 (Inaktivitäts-Reaktivierung)
--
-- Adds idempotency + analytics tracking for the daily reactivation push cron.
-- Without last_reactivation_sent_at, the cron would re-send every run (24h cadence)
-- and create push-notification spam. reactivation_count is for marketing analytics.

ALTER TABLE user_club_memberships
  ADD COLUMN IF NOT EXISTS last_reactivation_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS reactivation_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN user_club_memberships.last_reactivation_sent_at IS
  'Timestamp of the most recent reactivation push notification sent. Idempotency guard for the 14-day reactivation cron (ticket 2.5.2).';
COMMENT ON COLUMN user_club_memberships.reactivation_count IS
  'Total number of reactivation notifications sent to this member. Marketing analytics — how many push nudges did it take to re-engage?';

-- Partial index: only the cold memberships (never reactivated OR cooldown elapsed) are
-- interesting for the cron. Keeps the index small and the cron query fast even at
-- 100k+ memberships scale.
CREATE INDEX IF NOT EXISTS user_club_memberships_reactivation_idx
  ON user_club_memberships (club_id, is_active)
  WHERE last_reactivation_sent_at IS NULL;
