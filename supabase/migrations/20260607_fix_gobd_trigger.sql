-- ═══════════════════════════════════════════════════════════════
-- Migration: Fix GoBD immutability trigger on invoices
-- The function referenced subtotal, total_amount, invoice_date
-- which don't exist in the actual DB. Map to existing columns.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_invoice_content_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN (
    'open','sent','partially_paid','paid',
    'overdue','dunning','reminder_sent','void','uncollectible','refunded'
  ) THEN
    IF (NEW.amount IS DISTINCT FROM OLD.amount OR
        NEW.tax_amount IS DISTINCT FROM OLD.tax_amount OR
        NEW.due_date IS DISTINCT FROM OLD.due_date OR
        NEW.invoice_type IS DISTINCT FROM OLD.invoice_type) THEN
      RAISE EXCEPTION 'GoBD: Cannot modify content of finalized invoice %', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
