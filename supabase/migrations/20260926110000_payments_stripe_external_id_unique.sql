-- Ein Stripe-PaymentIntent darf genau eine Zahlung erzeugen. Die Vorabprüfung
-- im Webhook allein verhindert parallele Duplikate nicht. Nur für Stripe:
-- Bankimport und manuelle Zahlungen können legitim gleiche Referenzen tragen.
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_external_id_key
  ON public.payments (external_id)
  WHERE payment_method = 'stripe' AND external_id IS NOT NULL;
