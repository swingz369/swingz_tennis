-- Migration: Professional Attendance Confirmation System (Stundenbestätigung)
-- Date: 2026-06-12
-- Purpose: Add trainer confirmation + member dispute flow to attendance_records
--
-- Flow: Trainer confirms attendance → Member can confirm or dispute
-- Status model:
--   trainer_confirmed: boolean (trainer has reviewed and confirmed)
--   member_status: 'pending' | 'confirmed' | 'disputed' (member's response)
--   Dispute requires a reason; admin can resolve disputes

-- =============================================================================
-- 1. Add confirmation columns to attendance_records
-- ==============================================================================

-- Trainer confirmation
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS trainer_confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trainer_confirmed_at TIMESTAMPTZ;

-- Member confirmation/dispute
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS member_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (member_status IN ('pending', 'confirmed', 'disputed')),
  ADD COLUMN IF NOT EXISTS member_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_resolved_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Session duration (for hours tracking)
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER CHECK (duration_minutes >= 0 AND duration_minutes <= 480);

COMMENT ON COLUMN attendance_records.trainer_confirmed IS 'Whether the trainer has confirmed this attendance record';
COMMENT ON COLUMN attendance_records.trainer_confirmed_at IS 'When the trainer confirmed the record';
COMMENT ON COLUMN attendance_records.member_status IS 'Member confirmation status: pending (awaiting), confirmed (accepted), disputed (member disagrees)';
COMMENT ON COLUMN attendance_records.member_confirmed_at IS 'When the member confirmed or disputed';
COMMENT ON COLUMN attendance_records.dispute_reason IS 'Reason provided by member when disputing attendance';
COMMENT ON COLUMN attendance_records.dispute_resolved_at IS 'When admin resolved the dispute';
COMMENT ON COLUMN attendance_records.duration_minutes IS 'Session duration in minutes (for hours calculation)';

-- Indexes for confirmation queries
CREATE INDEX IF NOT EXISTS attendance_records_trainer_confirmed_idx
  ON attendance_records(trainer_confirmed);

CREATE INDEX IF NOT EXISTS attendance_records_member_status_idx
  ON attendance_records(member_status);

CREATE INDEX IF NOT EXISTS attendance_records_participant_member_status_idx
  ON attendance_records(participant_id, member_status);

-- =============================================================================
-- 2. RLS: Members can view and update their own attendance records
-- ==============================================================================

-- Members can view their own attendance records
DROP POLICY IF EXISTS "attendance_records_member_select" ON attendance_records;
CREATE POLICY "attendance_records_member_select" ON attendance_records
  FOR SELECT
  USING (
    is_superadmin() OR
    trainer_id = auth.uid() OR
    participant_id = auth.uid()
  );

-- Members can update their own records (confirm or dispute only)
DROP POLICY IF EXISTS "attendance_records_member_update" ON attendance_records;
CREATE POLICY "attendance_records_member_update" ON attendance_records
  FOR UPDATE
  USING (
    is_superadmin() OR
    trainer_id = auth.uid() OR
    (participant_id = auth.uid() AND member_status = 'pending')
  );

-- =============================================================================
-- 3. Hours Summary View (for member/trainer hours overview)
-- ==============================================================================

CREATE OR REPLACE VIEW attendance_hours_summary AS
SELECT
  ar.participant_id AS member_id,
  u.full_name AS member_name,
  ar.trainer_id,
  t.name AS trainer_name,
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE ar.status = 'present') AS attended_sessions,
  COUNT(*) FILTER (WHERE ar.status = 'absent') AS missed_sessions,
  COUNT(*) FILTER (WHERE ar.status = 'excused') AS excused_sessions,
  COUNT(*) FILTER (WHERE ar.status = 'late') AS late_sessions,
  COUNT(*) FILTER (WHERE ar.trainer_confirmed = true) AS trainer_confirmed_count,
  COUNT(*) FILTER (WHERE ar.member_status = 'confirmed') AS member_confirmed_count,
  COUNT(*) FILTER (WHERE ar.member_status = 'disputed') AS disputed_count,
  COUNT(*) FILTER (WHERE ar.member_status = 'pending') AS pending_confirmation_count,
  COALESCE(SUM(ar.duration_minutes) FILTER (WHERE ar.status IN ('present', 'late')), 0) AS total_attended_minutes,
  COALESCE(SUM(ar.duration_minutes), 0) AS total_scheduled_minutes,
  CASE
    WHEN COUNT(*) > 0
    THEN ROUND(COUNT(*) FILTER (WHERE ar.status IN ('present', 'late')) * 100.0 / COUNT(*), 1)
    ELSE 0
  END AS attendance_rate
FROM attendance_records ar
LEFT JOIN users u ON u.id = ar.participant_id
LEFT JOIN trainers t ON t.id = ar.trainer_id
GROUP BY ar.participant_id, u.full_name, ar.trainer_id, t.name;

COMMENT ON VIEW attendance_hours_summary IS 'Aggregated attendance and hours summary per member per trainer';
