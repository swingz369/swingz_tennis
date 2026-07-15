-- Migration: Create stripe_events table + RPC functions for webhook idempotency
-- Ensures each Stripe event is processed exactly once (race-condition safe).

-- ── 1. Table ──
CREATE TABLE IF NOT EXISTS stripe_events (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text NOT NULL UNIQUE,
  event_type      text NOT NULL,
  processed_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE stripe_events IS 'Webhook idempotency log — each Stripe event is recorded before processing to prevent duplicate handling.';

-- RLS: only service_role can access
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage stripe_events'
  ) THEN
DROP POLICY IF EXISTS "Service role can manage stripe_events" ON stripe_events;
    CREATE POLICY "Service role can manage stripe_events"
      ON stripe_events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── 2. Atomic check-and-insert RPC (eliminates race condition) ──
CREATE OR REPLACE FUNCTION check_and_record_stripe_event(
  p_event_id   text,
  p_event_type text
)
RETURNS boolean  -- true = newly inserted (should process), false = already existed (skip)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_exists boolean;
BEGIN
  -- Try to insert; if duplicate, the ON CONFLICT clause handles it
  INSERT INTO stripe_events (stripe_event_id, event_type)
  VALUES (p_event_id, p_event_type)
  ON CONFLICT (stripe_event_id) DO NOTHING;

  -- Check whether the row was newly inserted or already existed
  GET DIAGNOSTICS v_already_exists = ROW_COUNT;
  RETURN v_already_exists > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_record_stripe_event(text, text) TO service_role;

-- ── 3. Auto-cleanup: remove events older than 90 days (scheduled via pg_cron if available) ──
-- Can be run manually: DELETE FROM stripe_events WHERE created_at < now() - interval '90 days';
