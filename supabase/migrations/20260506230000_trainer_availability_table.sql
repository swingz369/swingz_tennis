-- Migration: Add Trainer Availability Table
-- Date: 2026-05-06
-- Purpose: Create table for trainer time slot availability management

-- ==============================================================================
-- 1. Trainer Availabilities Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS trainer_availabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL,
    start_time VARCHAR(5) NOT NULL CHECK (start_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'),
    end_time VARCHAR(5) NOT NULL CHECK (end_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'),
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'unavailable', 'booked', 'blocked')),
    notes TEXT,
    recurring_pattern JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT trainer_availabilities_time_order CHECK (start_time < end_time)
);

CREATE INDEX trainer_availabilities_trainer_idx ON trainer_availabilities(trainer_id);
CREATE INDEX trainer_availabilities_date_idx ON trainer_availabilities(date);
CREATE INDEX trainer_availabilities_trainer_date_idx ON trainer_availabilities(trainer_id, date);
CREATE INDEX trainer_availabilities_status_idx ON trainer_availabilities(status);

COMMENT ON TABLE trainer_availabilities IS 'Trainer availability slots (when trainers can work)';
COMMENT ON COLUMN trainer_availabilities.status IS 'Status: available (free), unavailable (off), booked (assigned), blocked (admin hold)';
COMMENT ON COLUMN trainer_availabilities.recurring_pattern IS 'Optional: JSON pattern for recurring availability (e.g., every Monday 10:00-18:00)';

-- ==============================================================================
-- 2. RLS Policies
-- ==============================================================================

-- Enable RLS
ALTER TABLE trainer_availabilities ENABLE ROW LEVEL SECURITY;

-- Trainers can view all availabilities (to avoid conflicts)
CREATE POLICY "trainer_availabilities_select" ON trainer_availabilities
    FOR SELECT
    USING (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM trainers
            WHERE trainers.id = auth.uid()
        )
    );

-- Trainers can create their own availabilities
CREATE POLICY "trainer_availabilities_insert" ON trainer_availabilities
    FOR INSERT
    WITH CHECK (
        is_superadmin() OR
        trainer_id = auth.uid()
    );

-- Trainers can update their own availabilities (not booked ones)
CREATE POLICY "trainer_availabilities_update" ON trainer_availabilities
    FOR UPDATE
    USING (
        is_superadmin() OR
        (trainer_id = auth.uid() AND status != 'booked')
    );

-- Trainers can delete their own availabilities (not booked ones)
CREATE POLICY "trainer_availabilities_delete" ON trainer_availabilities
    FOR DELETE
    USING (
        is_superadmin() OR
        (trainer_id = auth.uid() AND status != 'booked')
    );

-- ==============================================================================
-- 3. Functions for Conflict Detection
-- ==============================================================================

/**
 * Check for time slot overlaps (for conflict detection)
 */
CREATE OR REPLACE FUNCTION check_availability_overlap(
    p_trainer_id UUID,
    p_date TIMESTAMPTZ,
    p_start_time VARCHAR(5),
    p_end_time VARCHAR(5),
    p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    start_time VARCHAR(5),
    end_time VARCHAR(5),
    status VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ta.id,
        ta.start_time,
        ta.end_time,
        ta.status
    FROM trainer_availabilities ta
    WHERE ta.trainer_id = p_trainer_id
      AND ta.date = p_date
      AND (p_exclude_id IS NULL OR ta.id != p_exclude_id)
      AND (
        -- Overlap detection: new slot overlaps with existing
        (p_start_time >= ta.start_time AND p_start_time < ta.end_time) OR
        (p_end_time > ta.start_time AND p_end_time <= ta.end_time) OR
        (p_start_time <= ta.start_time AND p_end_time >= ta.end_time)
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_availability_overlap IS 'Detect time slot conflicts for a trainer on a specific date';

-- ==============================================================================
-- 4. Updated_at Trigger
-- ==============================================================================

CREATE TRIGGER update_trainer_availabilities_updated_at
    BEFORE UPDATE ON trainer_availabilities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
