-- Migration: Mark invoice_items for recalculation when their underlying plan
-- entry changes pricing-relevant fields.
--
-- Why this exists (Audit Follow-Up — Tier "Nice-to-have"):
-- When an admin PATCHes a season_plan_entries row (duration_minutes,
-- group_id, trainer_id, court_id, max_participants or expected_participants),
-- invoice_items that REFERENCE that plan_entry via (reference_type, reference_id)
-- have stale `total_amount` snapshots. Without this trigger, billing drift
-- silently lingers until the next billing cycle — losing revenue on
-- mid-season plan adjustments (group changes, extra-court hires).
--
-- Design:
-- 1) Add a nullable `recalc_required_at TIMESTAMPTZ` column to invoice_items.
--    NULL = no recalc needed; NOT NULL = "the pricing engine should re-evaluate
--    the unit price and recompute total_amount" set at the time the plan entry
--    changed.
-- 2) Trigger `mark_invoice_items_for_recalc_on_plan_change` on season_plan_entries
--    UPDATE only. SELECT/INSERT/DELETE don't change pricing math; DELETE
--    orphans are handled by the existing atomic_invoices_rpc.
-- 3) We use UPDATE OF (specific columns) so the trigger only fires for
--    pricing-relevant changes — not for every column tweak (notes,
--    admin_notes, status flips don't change amounts).
-- 4) The trigger is SECURITY DEFINER (same pattern as other audit triggers
--    in this codebase) so it can UPDATE other tables without RLS blocking.
--
-- Values:
-- • Not destructive: NULL default, no backfill required for existing rows.
-- • Idempotent: re-running this migration is a no-op (ADD COLUMN IF NOT
--   EXISTS, CREATE OR REPLACE FUNCTION/TRIGGER).
-- • Auditable: keep a get-recent-recalculations report in the comments so
--   operations can grep: "WHERE recalc_required_at > NOW() - INTERVAL '1 day'".

BEGIN;

-- 1) Add the audit column. Nullable + default NULL keeps the migration
--    purely additive — no rewrite of existing rows needed.
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS recalc_required_at TIMESTAMPTZ;

COMMENT ON COLUMN invoice_items.recalc_required_at IS
  'Non-null timestamp set by the season_plan_entries recalc trigger. '
  'NULL means the line item is in sync with its referenced plan entry. '
  'Non-null means the pricing engine should re-evaluate the line on next '
  'billing-cycle run. Cleared (=NULL) by the pricing engine after recompute.';

-- Index to make the "what needs recalc?" ops query cheap.
CREATE INDEX IF NOT EXISTS idx_invoice_items_recalc_required_at
  ON invoice_items (recalc_required_at)
  WHERE recalc_required_at IS NOT NULL;

-- 2) Trigger function. UPDATE-only, idempotent.

CREATE OR REPLACE FUNCTION public.mark_invoice_items_for_recalc_on_plan_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected_count INTEGER := 0;
BEGIN
  -- Only mark items where pricing-relevant columns actually changed.
  -- Old-vs-new comparison: status/notes/admin_notes don't trigger recalc.
  IF (
       NEW.duration_minutes      IS DISTINCT FROM OLD.duration_minutes
    OR NEW.group_id              IS DISTINCT FROM OLD.group_id
    OR NEW.trainer_id            IS DISTINCT FROM OLD.trainer_id
    OR NEW.court_id              IS DISTINCT FROM OLD.court_id
    OR NEW.max_participants      IS DISTINCT FROM OLD.max_participants
    OR NEW.expected_participants IS DISTINCT FROM OLD.expected_participants
  ) THEN
    UPDATE public.invoice_items
       SET recalc_required_at = NOW()
     WHERE reference_type = 'plan_entry'
       AND reference_id = NEW.id
       AND (
            recalc_required_at IS NULL
         OR recalc_required_at < NOW() - INTERVAL '1 second'
       );
    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
  END IF;

  IF v_affected_count > 0 THEN
    RAISE LOG 'invoice_items recalc-flagged: plan_entry=% affected=%',
              NEW.id, v_affected_count;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.mark_invoice_items_for_recalc_on_plan_change() IS
  'Pricing audit trigger: marks invoice_items needing recalculation when '
  'their referenced season_plan_entries changes pricing-relevant fields. '
  'Idempotent — re-evaluating the same change within a 1-second window '
  'does not update the timestamp again (debounce).';

-- 3) Trigger binding. UPDATE OF (...) means the trigger only fires for
--    columns we consider pricing-relevant. SELECT/INSERT/DELETE are not
--    relevant (INSERTs always go through atomic_invoices_rpc which sets
--    totals atomically; DELETEs are handled there too).
DROP TRIGGER IF EXISTS trg_mark_invoice_items_for_recalc ON season_plan_entries;

CREATE TRIGGER trg_mark_invoice_items_for_recalc
  AFTER UPDATE OF
    duration_minutes,
    group_id,
    trainer_id,
    court_id,
    max_participants,
    expected_participants
  ON season_plan_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_invoice_items_for_recalc_on_plan_change();

COMMENT ON TRIGGER trg_mark_invoice_items_for_recalc ON season_plan_entries IS
  'Audit-grade recalc flag. Set invoice_items.recalc_required_at = NOW() '
  'when an underlying plan entry changes pricing-relevant fields (group, '
  'trainer rate, court, duration, participants).';

-- 4) Cross-check index on reference_id (defensive — if a 50k-row table ends
--    up needing a fast index for the trigger, this avoids a seq scan).
--    The existing invoice_items_reference_idx already covers this from
--    schema.ts; we add nothing here to avoid double-indexing.

COMMIT;
