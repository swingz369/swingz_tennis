-- ============================================================
-- Migration: Backfill dunning_records.member_id
-- ============================================================
-- Problem: All 1,200 dunning_records have member_id = NULL.
--          Referenced invoices ALSO have member_id = NULL (adhoc test data).
-- Strategy: Resolve via sepa_mandates — 196/200 dunning clubs have exactly 1
--           active mandate, giving a unique member_id per club.
-- Impact:   1,176 of 1,200 records (98%) — remaining 24 are unresolvable
--           (4 clubs with no active SEPA mandate).
-- ============================================================

-- Step 1: Backfill from sepa_mandates where exactly 1 active mandate exists
--         AND the member_id resolves to a real user in public.users
--         (many sepa_mandates have orphaned member_ids from test data)
UPDATE dunning_records dr
SET member_id = (
  SELECT sm.member_id
  FROM sepa_mandates sm
  JOIN public.users u ON u.id = sm.member_id
  WHERE sm.club_id = dr.club_id
    AND sm.is_active = true
  LIMIT 1
)
WHERE dr.member_id IS NULL
  AND (
    SELECT count(DISTINCT sm2.member_id)
    FROM sepa_mandates sm2
    JOIN public.users u2 ON u2.id = sm2.member_id
    WHERE sm2.club_id = dr.club_id
      AND sm2.is_active = true
  ) = 1;

-- Step 2: Report remaining NULL records
DO $$
DECLARE
  remaining_count integer;
  rec RECORD;
BEGIN
  SELECT count(*) INTO remaining_count
  FROM dunning_records
  WHERE member_id IS NULL;

  RAISE NOTICE 'Backfill complete. Remaining NULL member_id records: % (clubs without valid SEPA mandate)', remaining_count;

  -- List the orphaned clubs for manual cleanup
  FOR rec IN
    SELECT dr.club_id, c.name, count(*) as cnt
    FROM dunning_records dr
    JOIN clubs c ON c.id = dr.club_id
    WHERE dr.member_id IS NULL
    GROUP BY dr.club_id, c.name
  LOOP
    RAISE NOTICE '  Club: % (%) — % records without member_id', rec.name, rec.club_id, rec.cnt;
  END LOOP;
END $$;

-- Step 3: Create trigger to auto-set member_id on INSERT
-- This ensures future dunning_records always inherit member_id from the invoice
CREATE OR REPLACE FUNCTION set_dunning_member_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.member_id IS NULL AND NEW.invoice_id IS NOT NULL THEN
    SELECT i.member_id INTO NEW.member_id
    FROM invoices i
    WHERE i.id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_dunning_member_id ON dunning_records;

CREATE TRIGGER trg_set_dunning_member_id
  BEFORE INSERT ON dunning_records
  FOR EACH ROW
  EXECUTE FUNCTION set_dunning_member_id();

-- Step 4: Add comment explaining the strategy
COMMENT ON FUNCTION set_dunning_member_id() IS
  'Auto-populates member_id from the referenced invoice on INSERT. '
  'Ensures dunning_records are always linked to a member when possible.';
