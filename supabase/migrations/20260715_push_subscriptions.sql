-- Push Subscriptions: stores Web Push subscription endpoints for each user
-- Used by the notification service to send push notifications via web-push protocol

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_club ON push_subscriptions(club_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(club_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read/manage their own subscriptions
CREATE POLICY push_subs_select_own ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY push_subs_insert_own ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_subs_update_own ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY push_subs_delete_own ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can read all subscriptions (for sending push notifications)
CREATE POLICY push_subs_service_all ON push_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscriptions_updated_at();
