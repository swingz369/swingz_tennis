-- ============================================================
-- Migration: Deploy billing triggers
-- ============================================================
-- update_invoice_status() — auto-updates paid_amount and status
-- calculate_dunning_level() — determines dunning level by days overdue
--
-- Adapted from 20260502_billing_system.sql:
--   - total_amount → amount (production column name)
--   - invoice_date now exists (added 20260608_add_missing_billing_columns)
-- ============================================================

-- ─────────────────────────────────────────────
-- update_invoice_status()
-- ─────────────────────────────────────────────
-- Fires AFTER INSERT OR UPDATE on payments.
-- When a payment becomes 'completed', recalculates
-- the paid_amount on the linked invoice and sets
-- status to 'paid' if fully paid.

CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid numeric(10, 2);
  v_invoice_amount numeric(10, 2);
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Sum all completed payments for this invoice
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM payments
    WHERE invoice_id = NEW.invoice_id
      AND status = 'completed';

    -- Get invoice total (amount column = subtotal + tax)
    SELECT amount INTO v_invoice_amount
    FROM invoices
    WHERE id = NEW.invoice_id;

    IF v_total_paid >= v_invoice_amount THEN
      UPDATE invoices
      SET status = 'paid',
          paid_amount = v_total_paid,
          paid_at = COALESCE(paid_at, NOW())
      WHERE id = NEW.invoice_id;
    ELSE
      UPDATE invoices
      SET paid_amount = v_total_paid
      WHERE id = NEW.invoice_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger (idempotent)
DROP TRIGGER IF EXISTS update_invoice_status_after_payment ON payments;
CREATE TRIGGER update_invoice_status_after_payment
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_invoice_status();

-- ─────────────────────────────────────────────
-- calculate_dunning_level()
-- ─────────────────────────────────────────────
-- Utility function: returns the recommended dunning
-- level (0-3) based on how many days the invoice is overdue.
--   Level 0 = not overdue enough (< 14 days)
--   Level 1 = 14+ days overdue
--   Level 2 = 28+ days overdue
--   Level 3 = 42+ days overdue (final notice)

CREATE OR REPLACE FUNCTION calculate_dunning_level(p_invoice_id uuid)
RETURNS integer AS $$
DECLARE
  v_due_date date;
  v_days_overdue integer;
BEGIN
  SELECT due_date INTO v_due_date
  FROM invoices
  WHERE id = p_invoice_id;

  IF v_due_date IS NULL THEN
    RETURN 0;
  END IF;

  v_days_overdue := CURRENT_DATE - v_due_date;

  IF v_days_overdue >= 42 THEN
    RETURN 3;
  ELSIF v_days_overdue >= 28 THEN
    RETURN 2;
  ELSIF v_days_overdue >= 14 THEN
    RETURN 1;
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_invoice_status() IS
  'Auto-updates invoices.paid_amount and status after payment INSERT/UPDATE. '
  'Sets status=paid when paid_amount >= amount.';

COMMENT ON FUNCTION calculate_dunning_level(uuid) IS
  'Returns recommended dunning level (0-3) based on days overdue. '
  'Level 1=14d, 2=28d, 3=42d.';
