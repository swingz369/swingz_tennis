-- Fix: prevent_invoice_content_update referenced NEW.total_amount which
-- doesn't exist on the invoices table (the column is called 'amount').
-- This caused "record "new" has no field "total_amount"" errors when
-- the update_invoice_status() trigger tried to UPDATE invoices (e.g.
-- marking an invoice as 'paid' after a completed payment).
CREATE OR REPLACE FUNCTION public.prevent_invoice_content_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.status IN (
    'open','sent','partially_paid','paid',
    'overdue','dunning','reminder_sent','void','uncollectible','refunded'
  ) THEN
    IF (NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
        NEW.amount IS DISTINCT FROM OLD.amount OR
        NEW.invoice_date IS DISTINCT FROM OLD.invoice_date OR
        NEW.invoice_type IS DISTINCT FROM OLD.invoice_type) THEN
      RAISE EXCEPTION 'GoBD: Cannot modify content of finalized invoice %', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
