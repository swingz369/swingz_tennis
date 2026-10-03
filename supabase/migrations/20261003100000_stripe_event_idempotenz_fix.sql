-- check_and_record_stripe_event brach bei jedem Aufruf ab: ROW_COUNT landete in einer
-- boolean-Variable, `boolean > 0` gibt es nicht (42883). Der Stripe-Webhook lehnte damit
-- jedes Ereignis ab und Stripe wiederholte es endlos. CREATE OR REPLACE behält die Rechte
-- (EXECUTE nur service_role, 20260924100000).
CREATE OR REPLACE FUNCTION public.check_and_record_stripe_event(p_event_id text, p_event_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  INSERT INTO stripe_events (stripe_event_id, event_type)
  VALUES (p_event_id, p_event_type)
  ON CONFLICT (stripe_event_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$$;
