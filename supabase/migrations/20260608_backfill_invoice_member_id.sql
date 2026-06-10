-- ============================================================
-- Migration: Backfill invoices.member_id
-- ============================================================
-- Problem: 6,453 adhoc invoices have member_id = NULL.
-- Strategy: Resolve via sepa_mandates — 173 clubs have exactly
--           1 active mandate with a valid user in public.users.
-- Impact:   5,521 of 6,453 invoices (85.6%). Remaining 932
--           are from clubs without a valid SEPA mandate.
--
-- Note: dunning_records.member_id (backfilled earlier) overlaps
--       completely with sepa_mandates, so no additional value.
-- ============================================================

-- Step 1: Backfill from sepa_mandates where exactly 1 active mandate exists
--         AND the member_id resolves to a real user in public.users
UPDATE invoices i
SET member_id = (
  SELECT sm.member_id
  FROM sepa_mandates sm
  JOIN public.users u ON u.id = sm.member_id
  WHERE sm.club_id = i.club_id
    AND sm.is_active = true
  LIMIT 1
)
WHERE i.member_id IS NULL
  AND i.invoice_type = 'adhoc'
  AND (
    SELECT count(DISTINCT sm2.member_id)
    FROM sepa_mandates sm2
    JOIN public.users u2 ON u2.id = sm2.member_id
    WHERE sm2.club_id = i.club_id
      AND sm2.is_active = true
  ) = 1;

-- Step 2: Report results
DO $$
DECLARE
  total_null integer;
  remaining_null integer;
  resolved integer;
  rec RECORD;
BEGIN
  SELECT count(*) INTO total_null FROM invoices WHERE invoice_type = 'adhoc';
  SELECT count(*) INTO remaining_null FROM invoices WHERE member_id IS NULL AND invoice_type = 'adhoc';
  resolved := total_null - remaining_null;

  RAISE NOTICE 'Backfill complete:';
  RAISE NOTICE '  Total adhoc invoices: %', total_null;
  RAISE NOTICE '  Resolved (member_id set): %', resolved;
  RAISE NOTICE '  Remaining NULL: %', remaining_null;

  -- List the unresolvable clubs for manual cleanup
  IF remaining_null > 0 THEN
    RAISE NOTICE 'Unresolvable clubs (no valid SEPA mandate):';
    FOR rec IN
      SELECT i.club_id, c.name, count(*) as cnt
      FROM invoices i
      JOIN clubs c ON c.id = i.club_id
      WHERE i.member_id IS NULL AND i.invoice_type = 'adhoc'
      GROUP BY i.club_id, c.name
      ORDER BY cnt DESC
      LIMIT 10
    LOOP
      RAISE NOTICE '  Club: % (%) — % invoices', rec.name, rec.club_id, rec.cnt;
    END LOOP;
  END IF;
END $$;
