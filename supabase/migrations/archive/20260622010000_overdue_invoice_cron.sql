-- ============================================================
-- Overdue Invoice Cron Job
-- Runs daily at 3 AM to mark past-due invoices as 'overdue'
-- and trigger automatic dunning for affected clubs.
-- ============================================================

-- 1. Function: Mark overdue invoices and return affected club IDs
--    Statuses considered: 'sent' (issued, awaiting payment) and
--    'partially_paid' (partial payment received, remainder overdue).
--    'draft' invoices are NOT marked overdue — they haven't been sent yet.
--    'dunning', 'reminder_sent', 'paid', 'cancelled' are left untouched.
CREATE OR REPLACE FUNCTION mark_overdue_invoices()
RETURNS TABLE (club_id UUID, invoice_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH updated AS (
    UPDATE invoices
    SET status = 'overdue'
    WHERE status IN ('sent', 'partially_paid')
      AND due_date < NOW()
    RETURNING invoices.club_id
  )
  SELECT updated.club_id, COUNT(*) AS invoice_count
  FROM updated
  WHERE updated.club_id IS NOT NULL
  GROUP BY updated.club_id;
END;
$$;

COMMENT ON FUNCTION mark_overdue_invoices IS
  'Marks invoices past due_date as overdue. Returns affected club_ids with counts.
   Designed for pg_cron daily execution (3 AM). Manual invocation via
   SELECT * FROM mark_overdue_invoices() for testing.';

-- 2. Idempotent schedule: remove existing job if present, then (re-)schedule
DO $$
BEGIN
  PERFORM cron.unschedule('mark-overdue-invoices');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist yet — that's fine
  NULL;
END $$;

SELECT cron.schedule(
  'mark-overdue-invoices',
  '0 3 * * *',  -- Every day at 3 AM UTC
  $$ SELECT mark_overdue_invoices(); $$
);

-- 3. Note: Dunning (reminders, escalation) is handled by the companion
--    Next.js endpoint at /api/cron/billing-overdue which reads the
--    newly-overdue invoices and calls dunningService.processAutomaticDunning().
--    Configure Vercel Cron to hit that endpoint after this pg_cron job runs
--    (e.g. at 3:15 AM) to process dunning for the affected clubs.

-- 4. Grant execute to service role (for manual invocation / testing)
GRANT EXECUTE ON FUNCTION mark_overdue_invoices() TO service_role;
