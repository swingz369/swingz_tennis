-- Trainer Absences Table Migration
-- This migration creates the table for managing trainer absences with approval workflow
-- Features: date range validation, conflict detection, approval tracking, multi-tenant isolation

-- ============================================================================
-- TABLE: trainer_absences
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainer_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  trainer_name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('sick', 'vacation', 'personal', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  notes TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_date_range CHECK (start_date <= end_date),
  CONSTRAINT valid_approval CHECK (
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
    (status = 'rejected' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
    (status = 'pending' AND approved_by IS NULL AND approved_at IS NULL)
  )
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

-- Query by trainer
CREATE INDEX idx_trainer_absences_trainer_id ON trainer_absences(trainer_id);

-- Query by club (tenant isolation)
CREATE INDEX idx_trainer_absences_club_id ON trainer_absences(club_id);

-- Query by status (pending approvals)
CREATE INDEX idx_trainer_absences_status ON trainer_absences(status);

-- Query by type (vacation, sick, etc.)
CREATE INDEX idx_trainer_absences_type ON trainer_absences(type);

-- Query by date range (conflict detection, active absences)
CREATE INDEX idx_trainer_absences_date_range ON trainer_absences(start_date, end_date);

-- Composite index for trainer + date range queries (most common)
CREATE INDEX idx_trainer_absences_trainer_dates ON trainer_absences(trainer_id, start_date, end_date);

-- Composite index for club + date range queries (tenant + temporal)
CREATE INDEX idx_trainer_absences_club_dates ON trainer_absences(club_id, start_date, end_date);

-- Query pending approvals by club
CREATE INDEX idx_trainer_absences_club_status ON trainer_absences(club_id, status) 
  WHERE status = 'pending';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE trainer_absences ENABLE ROW LEVEL SECURITY;

-- Policy 1: Superadmins have full access (cross-tenant)
CREATE POLICY "Superadmins have full access to all absences"
  ON trainer_absences
  FOR ALL
  USING (is_superadmin());

-- Policy 2: Club admins can view all absences in their clubs
CREATE POLICY "Club admins can view absences in their clubs"
  ON trainer_absences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trainer_absences.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 3: Club admins can create absences for trainers in their clubs
CREATE POLICY "Club admins can create absences in their clubs"
  ON trainer_absences
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trainer_absences.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 4: Club admins can update/approve/reject absences in their clubs
CREATE POLICY "Club admins can update absences in their clubs"
  ON trainer_absences
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trainer_absences.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 5: Club admins can delete absences in their clubs
CREATE POLICY "Club admins can delete absences in their clubs"
  ON trainer_absences
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trainer_absences.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.is_active = true
    )
  );

-- Policy 6: Trainers can view their own absences
CREATE POLICY "Trainers can view their own absences"
  ON trainer_absences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trainer_absences.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'trainer'
        AND cm.is_active = true
        AND EXISTS (
          SELECT 1 FROM trainer_club tc
          INNER JOIN trainers t ON t.id = tc.trainer_id
          WHERE tc.trainer_id = trainer_absences.trainer_id
            AND tc.club_id = trainer_absences.club_id
            AND t.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
  );

-- Policy 7: Trainers can create absences for themselves
CREATE POLICY "Trainers can create their own absences"
  ON trainer_absences
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trainer_absences.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'trainer'
        AND cm.is_active = true
        AND EXISTS (
          SELECT 1 FROM trainer_club tc
          INNER JOIN trainers t ON t.id = tc.trainer_id
          WHERE tc.trainer_id = trainer_absences.trainer_id
            AND tc.club_id = trainer_absences.club_id
            AND t.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
  );

-- Policy 8: Trainers can update their own pending absences (not approved/rejected)
CREATE POLICY "Trainers can update their own pending absences"
  ON trainer_absences
  FOR UPDATE
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trainer_absences.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'trainer'
        AND cm.is_active = true
        AND EXISTS (
          SELECT 1 FROM trainer_club tc
          INNER JOIN trainers t ON t.id = tc.trainer_id
          WHERE tc.trainer_id = trainer_absences.trainer_id
            AND tc.club_id = trainer_absences.club_id
            AND t.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
  );

-- Policy 9: Trainers can delete their own pending absences
CREATE POLICY "Trainers can delete their own pending absences"
  ON trainer_absences
  FOR DELETE
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = trainer_absences.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'trainer'
        AND cm.is_active = true
        AND EXISTS (
          SELECT 1 FROM trainer_club tc
          INNER JOIN trainers t ON t.id = tc.trainer_id
          WHERE tc.trainer_id = trainer_absences.trainer_id
            AND tc.club_id = trainer_absences.club_id
            AND t.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
  );

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_trainer_absences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trainer_absences_updated_at
  BEFORE UPDATE ON trainer_absences
  FOR EACH ROW
  EXECUTE FUNCTION update_trainer_absences_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE trainer_absences IS 'Trainer absence management with approval workflow and conflict detection';
COMMENT ON COLUMN trainer_absences.type IS 'Absence type: sick, vacation, personal, or other';
COMMENT ON COLUMN trainer_absences.status IS 'Approval status: pending, approved, or rejected';
COMMENT ON COLUMN trainer_absences.approved_by IS 'User ID of admin who approved/rejected the absence';
COMMENT ON COLUMN trainer_absences.approved_at IS 'Timestamp when absence was approved/rejected';
