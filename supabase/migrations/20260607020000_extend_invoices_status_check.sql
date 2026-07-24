-- Migration: 20260607_extend_invoices_status_check
-- Erweitert den CHECK-Constraint für invoices.status um
-- 'open', 'void', 'uncollectible', 'refunded'
-- und aktualisiert den GoBD-Immutability-Trigger

-- ============================================
-- 1. Validate existing data
-- ============================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM invoices
    WHERE status NOT IN (
      'draft','open','sent','partially_paid','paid',
      'overdue','dunning','reminder_sent','cancelled',
      'void','uncollectible','refunded'
    )
  ) THEN
    RAISE EXCEPTION 'invoices contains status values outside the new enum — cannot add constraint';
  END IF;
END $$;

-- ============================================
-- 2. Extend invoices_status_check constraint
-- ============================================
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN (
    'draft',
    'open',
    'sent',
    'partially_paid',
    'paid',
    'overdue',
    'dunning',
    'reminder_sent',
    'cancelled',
    'void',
    'uncollectible',
    'refunded'
  ));

-- ============================================
-- 3. Update GoBD immutability trigger
-- ============================================
CREATE OR REPLACE FUNCTION prevent_invoice_content_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN (
    'open','sent','partially_paid','paid',
    'overdue','dunning','reminder_sent','void','uncollectible','refunded'
  ) THEN
    IF (NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
        NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
        NEW.invoice_date IS DISTINCT FROM OLD.invoice_date OR
        NEW.invoice_type IS DISTINCT FROM OLD.invoice_type) THEN
      RAISE EXCEPTION 'GoBD: Cannot modify content of finalized invoice %', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gobd_invoice_immutability ON invoices;
CREATE TRIGGER gobd_invoice_immutability
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION prevent_invoice_content_update();
