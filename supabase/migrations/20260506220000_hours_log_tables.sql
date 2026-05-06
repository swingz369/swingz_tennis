-- Migration: Add Hours Log & Attendance Tables
-- Date: 2026-05-06
-- Purpose: Create tables for trainer time tracking and session attendance

-- ==============================================================================
-- 1. Hours Logs Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS hours_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE RESTRICT,
    trainer_name VARCHAR(255) NOT NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    date TIMESTAMPTZ NOT NULL,
    start_time VARCHAR(5) NOT NULL CHECK (start_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'),
    end_time VARCHAR(5) NOT NULL CHECK (end_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'),
    duration INTEGER NOT NULL CHECK (duration >= 0 AND duration <= 720), -- max 12 hours
    type VARCHAR(20) NOT NULL CHECK (type IN ('training', 'preparation', 'meeting', 'other')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    approved_by VARCHAR(100),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT hours_logs_time_order CHECK (start_time < end_time)
);

CREATE INDEX hours_logs_trainer_idx ON hours_logs(trainer_id);
CREATE INDEX hours_logs_session_idx ON hours_logs(session_id);
CREATE INDEX hours_logs_date_idx ON hours_logs(date);
CREATE INDEX hours_logs_status_idx ON hours_logs(status);

COMMENT ON TABLE hours_logs IS 'Trainer time tracking (hours worked per session)';
COMMENT ON COLUMN hours_logs.duration IS 'Duration in minutes (calculated: end_time - start_time)';
COMMENT ON COLUMN hours_logs.type IS 'Type: training (teaching), preparation (lesson planning), meeting (staff), other';
COMMENT ON COLUMN hours_logs.status IS 'Status: pending (awaiting approval), approved, rejected';

-- ==============================================================================
-- 2. Attendance Records Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE RESTRICT,
    trainer_name VARCHAR(255) NOT NULL,
    participant_id UUID NOT NULL,
    participant_name VARCHAR(255) NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    check_in_time VARCHAR(5) CHECK (check_in_time IS NULL OR check_in_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'),
    check_out_time VARCHAR(5) CHECK (check_out_time IS NULL OR check_out_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX attendance_records_session_idx ON attendance_records(session_id);
CREATE INDEX attendance_records_trainer_idx ON attendance_records(trainer_id);
CREATE INDEX attendance_records_participant_idx ON attendance_records(participant_id);
CREATE INDEX attendance_records_date_idx ON attendance_records(date);

COMMENT ON TABLE attendance_records IS 'Session attendance tracking (who attended which session)';
COMMENT ON COLUMN attendance_records.status IS 'Status: present, absent, late, excused';

-- ==============================================================================
-- 3. RLS Policies
-- ==============================================================================

-- Enable RLS
ALTER TABLE hours_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Hours Logs: Superadmins see all, trainers see their own
CREATE POLICY "hours_logs_select" ON hours_logs
    FOR SELECT
    USING (
        is_superadmin() OR
        trainer_id = auth.uid()
    );

CREATE POLICY "hours_logs_insert" ON hours_logs
    FOR INSERT
    WITH CHECK (
        is_superadmin() OR
        trainer_id = auth.uid()
    );

CREATE POLICY "hours_logs_update" ON hours_logs
    FOR UPDATE
    USING (
        is_superadmin() OR
        (trainer_id = auth.uid() AND status = 'pending')
    );

CREATE POLICY "hours_logs_delete" ON hours_logs
    FOR DELETE
    USING (
        is_superadmin() OR
        (trainer_id = auth.uid() AND status = 'pending')
    );

-- Attendance Records: Trainers can manage their own sessions, superadmins see all
CREATE POLICY "attendance_records_select" ON attendance_records
    FOR SELECT
    USING (
        is_superadmin() OR
        trainer_id = auth.uid()
    );

CREATE POLICY "attendance_records_insert" ON attendance_records
    FOR INSERT
    WITH CHECK (
        is_superadmin() OR
        trainer_id = auth.uid()
    );

CREATE POLICY "attendance_records_update" ON attendance_records
    FOR UPDATE
    USING (
        is_superadmin() OR
        trainer_id = auth.uid()
    );

CREATE POLICY "attendance_records_delete" ON attendance_records
    FOR DELETE
    USING (
        is_superadmin() OR
        trainer_id = auth.uid()
    );

-- ==============================================================================
-- 4. Updated_at Trigger
-- ==============================================================================

CREATE TRIGGER update_hours_logs_updated_at
    BEFORE UPDATE ON hours_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
