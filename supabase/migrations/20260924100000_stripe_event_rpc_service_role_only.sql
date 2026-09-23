-- Live am 24.09.2026 geprüft: Die SECURITY-DEFINER-Funktion ist für anon,
-- authenticated und service_role ausführbar. Nur der signierte Stripe-Webhook
-- nutzt sie über den Service-Client.
REVOKE ALL ON FUNCTION public.check_and_record_stripe_event(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_record_stripe_event(text, text)
  TO service_role;
