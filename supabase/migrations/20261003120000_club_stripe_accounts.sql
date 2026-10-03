-- Stripe Connect: verbundenes Stripe-Konto je Verein (ADR-008).
--
-- Mitgliederzahlungen (Shop, Rechnungen) laufen als Direct Charge auf dem Konto des
-- Vereins, die Plattformgebühr über application_fee_amount. Eigene Tabelle statt
-- Spalten an `clubs`: Admins dürfen `clubs` bearbeiten, dürfen aber weder die
-- Konto-ID noch den Freischaltungs-Status setzen. Geschrieben wird nur serverseitig
-- (Onboarding-Route und Stripe-Webhook über systemDb), deshalb keine Schreib-Policy.
-- Lesen dürfen alle Mitglieder des Vereins: der Checkout eines Mitglieds braucht die
-- Konto-ID (sie steht ohnehin auf jedem Stripe-Beleg), den Status zeigt die Route nur Admins.

CREATE TABLE IF NOT EXISTS public.club_stripe_accounts (
  club_id uuid PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL UNIQUE,
  charges_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_stripe_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_stripe_accounts_member_read" ON public.club_stripe_accounts;
CREATE POLICY "club_stripe_accounts_member_read" ON public.club_stripe_accounts
  FOR SELECT TO authenticated
  USING (public.is_club_member(club_id));

REVOKE ALL ON public.club_stripe_accounts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.club_stripe_accounts FROM authenticated;
GRANT SELECT ON public.club_stripe_accounts TO authenticated;
GRANT ALL ON public.club_stripe_accounts TO service_role;
