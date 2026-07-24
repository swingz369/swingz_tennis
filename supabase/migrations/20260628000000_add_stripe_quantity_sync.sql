-- 20260628_add_stripe_quantity_sync.sql
-- Sprint 3 / Ticket 3.6.1 — Pay-per-Active-Member-Pricing
-- Adds idempotency cache columns to users table for Stripe subscription-quantity sync.
-- Avoids hitting Stripe API on every reconciliation: if synced quantity already matches
-- target active-member-count, no API call is made.
--
-- Behavior:
--   stripe_subscription_quantity_synced INTEGER  — Last quantity pushed to Stripe
--   stripe_subscription_quantity_synced_at TIMESTAMPTZ — Audit timestamp for last push
-- Both columns are nullable (NULL = never synced, which forces first sync).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_subscription_quantity_synced INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_subscription_quantity_synced_at TIMESTAMPTZ;

-- Defensive CHECK constraint (belt-and-braces):
-- `shouldSyncQuantity` in `lib/services/stripe-subscription-quantity-sync.service.ts`
-- rejects negative targets in JS, but the DB constraint guarantees integrity
-- even if a future regression ships that bypasses the JS threshold.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_stripe_quantity_synced_nonneg_chk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_stripe_quantity_synced_nonneg_chk
      CHECK (stripe_subscription_quantity_synced IS NULL OR stripe_subscription_quantity_synced >= 0);
  END IF;
END $$;

-- Idempotency: when active-member-count changed but no push happened yet,
-- NULL means "no prior sync known" — the service will sync unconditionally
-- for sticker-shock prevention (first-sync canonicalize).
COMMENT ON COLUMN users.stripe_subscription_quantity_synced IS
  'Last Stripe subscription item quantity pushed for active-member pricing. NULL = never synced. Idempotency-cache for ticket 3.6.1.';

COMMENT ON COLUMN users.stripe_subscription_quantity_synced_at IS
  'Timestamp of last Stripe subscription-quantity push. Audit-only. Idempotency-cache for ticket 3.6.1.';
