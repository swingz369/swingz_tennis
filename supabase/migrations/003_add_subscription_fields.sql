-- Add subscription billing fields to users table
-- These fields support Stripe integration and subscription management

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'unpaid', 'incomplete')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- Index for faster subscription lookups
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Update RLS policy for users table to allow superadmin (service role) to read all
-- The existing "users_access" policy already restricts to own record:
--   users.id = auth.uid()
-- Superadmin access will be via service role (API routes using service_role key)

-- Comments
COMMENT ON COLUMN users.subscription_tier IS 'Current subscription plan tier: free, pro, enterprise';
COMMENT ON COLUMN users.subscription_status IS 'Subscription status from Stripe';
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN users.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN users.current_period_end IS 'Current subscription period end date';
COMMENT ON COLUMN users.billing_email IS 'Email address for billing (may differ from login email)';
