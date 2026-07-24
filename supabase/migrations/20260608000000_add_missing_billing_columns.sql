-- ============================================================
-- Migration: Add missing billing columns
-- ============================================================
-- invoices: subtotal, invoice_date, paid_amount
-- dunning_records: original_amount, total_amount, escalated_at, cancelled_at
--
-- These columns were defined in the original billing migration
-- (20260502_billing_system.sql) and Drizzle schema but never
-- applied to the production DB.
-- ============================================================

-- ─────────────────────────────────────────────
-- Step 1: invoices — add missing columns
-- ─────────────────────────────────────────────

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS subtotal numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(10, 2) NOT NULL DEFAULT 0;

-- Index for invoice_date (used in queries/sorting)
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);

-- ─────────────────────────────────────────────
-- Step 2: Backfill invoices from existing data
-- ─────────────────────────────────────────────

-- subtotal = amount - tax_amount (net amount before tax)
UPDATE invoices
SET subtotal = GREATEST(amount - COALESCE(tax_amount, 0), 0)
WHERE subtotal = 0;

-- invoice_date = created_at (best available approximation)
UPDATE invoices
SET invoice_date = created_at::date
WHERE invoice_date = CURRENT_DATE AND created_at IS NOT NULL;

-- paid_amount = sum of completed payments
UPDATE invoices i
SET paid_amount = COALESCE(paid.total, 0)
FROM (
  SELECT p.invoice_id, SUM(p.amount) AS total
  FROM payments p
  WHERE p.status = 'completed'
  GROUP BY p.invoice_id
) paid
WHERE i.id = paid.invoice_id;

-- ─────────────────────────────────────────────
-- Step 3: dunning_records — add missing columns
-- ─────────────────────────────────────────────

ALTER TABLE dunning_records
  ADD COLUMN IF NOT EXISTS original_amount numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- ─────────────────────────────────────────────
-- Step 4: Backfill dunning_records from invoices
-- ─────────────────────────────────────────────

-- original_amount = invoice.amount at time of dunning
UPDATE dunning_records dr
SET original_amount = i.amount
FROM invoices i
WHERE dr.invoice_id = i.id
  AND dr.original_amount = 0;

-- total_amount = original_amount + fee_amount
UPDATE dunning_records
SET total_amount = original_amount + COALESCE(fee_amount, 0)
WHERE total_amount = 0;

-- ─────────────────────────────────────────────
-- Step 5: Update GoBD trigger to protect new columns
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_invoice_content_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN (
    'open','sent','partially_paid','paid',
    'overdue','dunning','reminder_sent','void','uncollectible','refunded'
  ) THEN
    IF (NEW.amount IS DISTINCT FROM OLD.amount OR
        NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
        NEW.tax_amount IS DISTINCT FROM OLD.tax_amount OR
        NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
        NEW.invoice_date IS DISTINCT FROM OLD.invoice_date OR
        NEW.due_date IS DISTINCT FROM OLD.due_date OR
        NEW.invoice_type IS DISTINCT FROM OLD.invoice_type) THEN
      RAISE EXCEPTION 'GoBD: Cannot modify content of finalized invoice %', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- Step 6: Report
-- ─────────────────────────────────────────────

DO $$
DECLARE
  inv_subtotal_count integer;
  inv_paid_count integer;
  dr_orig_count integer;
BEGIN
  SELECT count(*) INTO inv_subtotal_count FROM invoices WHERE subtotal > 0;
  SELECT count(*) INTO inv_paid_count FROM invoices WHERE paid_amount > 0;
  SELECT count(*) INTO dr_orig_count FROM dunning_records WHERE original_amount > 0;

  RAISE NOTICE 'Backfill complete:';
  RAISE NOTICE '  invoices.subtotal > 0: %', inv_subtotal_count;
  RAISE NOTICE '  invoices.paid_amount > 0: %', inv_paid_count;
  RAISE NOTICE '  dunning_records.original_amount > 0: %', dr_orig_count;
END $$;
