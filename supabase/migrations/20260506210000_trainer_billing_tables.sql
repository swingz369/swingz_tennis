-- Migration: Add Trainer Billing Tables
-- Date: 2026-05-06
-- Purpose: Create tables for trainer billing periods, billings, and line items

-- ==============================================================================
-- 1. Billing Periods Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS billing_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'processing', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT billing_periods_date_range CHECK (end_date > start_date)
);

CREATE INDEX billing_periods_date_idx ON billing_periods(start_date, end_date);
CREATE INDEX billing_periods_status_idx ON billing_periods(status);

COMMENT ON TABLE billing_periods IS 'Billing periods for trainer compensation (typically monthly)';
COMMENT ON COLUMN billing_periods.status IS 'Status: open (can add billings), processing (generating invoices), closed (finalized)';

-- ==============================================================================
-- 2. Trainer Billings Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS trainer_billings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_period_id UUID NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE RESTRICT,
    trainer_name VARCHAR(255) NOT NULL,
    total_hours NUMERIC(10, 2) NOT NULL CHECK (total_hours >= 0),
    hourly_rate NUMERIC(10, 2) NOT NULL CHECK (hourly_rate >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid', 'overdue')),
    invoice_id UUID,
    invoice_number VARCHAR(50),
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX trainer_billings_period_idx ON trainer_billings(billing_period_id);
CREATE INDEX trainer_billings_trainer_idx ON trainer_billings(trainer_id);
CREATE INDEX trainer_billings_status_idx ON trainer_billings(status);
CREATE UNIQUE INDEX trainer_billings_invoice_number_unique ON trainer_billings(invoice_number) WHERE invoice_number IS NOT NULL;

COMMENT ON TABLE trainer_billings IS 'Trainer compensation records per billing period';
COMMENT ON COLUMN trainer_billings.status IS 'Status: pending (awaiting approval), processed (invoice generated), paid (payment completed), overdue (payment late)';
COMMENT ON COLUMN trainer_billings.invoice_number IS 'Generated invoice number (e.g., INV-202605-0001)';

-- ==============================================================================
-- 3. Billing Line Items Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS billing_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_billing_id UUID NOT NULL REFERENCES trainer_billings(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    hours NUMERIC(10, 2) NOT NULL CHECK (hours >= 0),
    rate NUMERIC(10, 2) NOT NULL CHECK (rate >= 0),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    type VARCHAR(20) NOT NULL CHECK (type IN ('training', 'preparation', 'meeting', 'other')),
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX billing_line_items_billing_idx ON billing_line_items(trainer_billing_id);
CREATE INDEX billing_line_items_session_idx ON billing_line_items(session_id);
CREATE INDEX billing_line_items_date_idx ON billing_line_items(date);

COMMENT ON TABLE billing_line_items IS 'Detailed breakdown of trainer hours per billing period';
COMMENT ON COLUMN billing_line_items.type IS 'Type: training (teaching session), preparation (lesson planning), meeting (staff meetings), other';

-- ==============================================================================
-- 4. RLS Policies (using helper functions from 20260506190000)
-- ==============================================================================

-- Enable RLS
ALTER TABLE billing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_line_items ENABLE ROW LEVEL SECURITY;

-- Billing Periods: Only superadmins and admins can manage
CREATE POLICY "billing_periods_select" ON billing_periods
    FOR SELECT
    USING (is_superadmin());

CREATE POLICY "billing_periods_insert" ON billing_periods
    FOR INSERT
    WITH CHECK (is_superadmin());

CREATE POLICY "billing_periods_update" ON billing_periods
    FOR UPDATE
    USING (is_superadmin());

CREATE POLICY "billing_periods_delete" ON billing_periods
    FOR DELETE
    USING (is_superadmin());

-- Trainer Billings: Superadmins see all, trainers see their own
CREATE POLICY "trainer_billings_select" ON trainer_billings
    FOR SELECT
    USING (
        is_superadmin() OR
        trainer_id = auth.uid()
    );

CREATE POLICY "trainer_billings_insert" ON trainer_billings
    FOR INSERT
    WITH CHECK (is_superadmin());

CREATE POLICY "trainer_billings_update" ON trainer_billings
    FOR UPDATE
    USING (is_superadmin());

CREATE POLICY "trainer_billings_delete" ON trainer_billings
    FOR DELETE
    USING (is_superadmin());

-- Billing Line Items: Same as trainer billings
CREATE POLICY "billing_line_items_select" ON billing_line_items
    FOR SELECT
    USING (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM trainer_billings
            WHERE trainer_billings.id = billing_line_items.trainer_billing_id
            AND trainer_billings.trainer_id = auth.uid()
        )
    );

CREATE POLICY "billing_line_items_insert" ON billing_line_items
    FOR INSERT
    WITH CHECK (is_superadmin());

CREATE POLICY "billing_line_items_update" ON billing_line_items
    FOR UPDATE
    USING (is_superadmin());

CREATE POLICY "billing_line_items_delete" ON billing_line_items
    FOR DELETE
    USING (is_superadmin());

-- ==============================================================================
-- 5. Updated_at Trigger
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_billing_periods_updated_at
    BEFORE UPDATE ON billing_periods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trainer_billings_updated_at
    BEFORE UPDATE ON trainer_billings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
