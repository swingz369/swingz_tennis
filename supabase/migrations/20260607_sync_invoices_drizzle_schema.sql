-- Migration: Sync DB with Drizzle schema
-- Adds columns present in Drizzle schema.ts but missing from production DB
-- Also adds datev_account_number which exists in DB but not yet in Drizzle (handled separately)

-- ============================================
-- invoices: add sent_at, cancelled_at, cancellation_reason
-- ============================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason varchar(50);

-- ============================================
-- invoice_items: add item_type, tax_rate, reference_id, reference_type, updated_at
-- ============================================

-- item_type: NOT NULL in Drizzle → add as nullable first, backfill, then add NOT NULL
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS item_type varchar(20);

-- Backfill existing rows with 'membership_fee' for items linked to membership invoices
UPDATE invoice_items ii
SET item_type = 'membership_fee'
FROM invoices i
WHERE ii.invoice_id = i.id
  AND i.invoice_type = 'membership'
  AND ii.item_type IS NULL;

-- Backfill remaining rows with 'other'
UPDATE invoice_items SET item_type = 'other' WHERE item_type IS NULL;

ALTER TABLE invoice_items ALTER COLUMN item_type SET NOT NULL;

-- tax_rate: NOT NULL in Drizzle, default 19
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) NOT NULL DEFAULT 19.00;

-- reference_id / reference_type: nullable UUID/varchar
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS reference_type varchar(50);

-- updated_at: NOT NULL in Drizzle, default now()
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
