-- audit_logs had no club_id column at all, so the admin "Audit-Logs" tab
-- (GET /api/admin/audit-logs, filters .eq('club_id', clubId)) silently
-- returned an empty list for every club, regardless of how many actions
-- had actually been logged. Adds the column + index so club-scoped reads work.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES clubs(id);
CREATE INDEX IF NOT EXISTS audit_logs_club_id_idx ON audit_logs (club_id, created_at DESC);
