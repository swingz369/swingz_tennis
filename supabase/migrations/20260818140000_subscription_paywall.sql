-- Pflicht-Abo statt Freemium-Default (PRODUKTIONSREIFE.md 3.1) — und der Grund,
-- warum das vorher gar nicht funktionieren konnte.
--
-- Befund vom 18.08.2026, gegen die lokale DB belegt: der Stripe-Webhook
-- schreibt `subscription_tier` als Plan-Key aus lib/plans.ts ('solo_s',
-- 'solo_l', 'school_s', 'school_l'). Der CHECK-Constraint kannte aber nur
-- 'free' | 'pro' | 'enterprise'. Jedes UPDATE nach einem erfolgreichen
-- Checkout schlug damit fehl — und weil der Webhook den Fehler nicht prüfte,
-- lautlos. Ein Kunde konnte bezahlen und blieb trotzdem auf 'free'.
--
-- Dasselbe beim Status: handleSubscriptionUpdated() schreibt `sub.status`
-- direkt aus Stripe durch. Stripe kennt u. a. 'trialing', 'paused' und
-- 'incomplete_expired' — der Constraint nicht.
--
-- Der Constraint bleibt bestehen (er faengt Tippfehler ab), aber er kennt jetzt
-- die Werte, die tatsaechlich geschrieben werden. Die alten Werte bleiben
-- erlaubt, weil Bestandszeilen sie tragen.

alter table public.users drop constraint if exists users_subscription_tier_check;
alter table public.users add constraint users_subscription_tier_check
  check (subscription_tier = any (array[
    -- aktuelle Plan-Keys, siehe lib/plans.ts
    'solo_s', 'solo_l', 'school_s', 'school_l',
    -- kein Abo
    'free',
    -- Altbestand aus der Zeit vor den Plan-Keys
    'pro', 'enterprise'
  ]));

alter table public.users drop constraint if exists users_subscription_status_check;
alter table public.users add constraint users_subscription_status_check
  check (subscription_status = any (array[
    -- vollstaendige Liste der Stripe-Subscription-Status
    'active', 'canceled', 'past_due', 'unpaid', 'incomplete',
    'incomplete_expired', 'trialing', 'paused'
  ]));

comment on column public.users.subscription_tier is
  'Plan-Key aus lib/plans.ts. ''free'' = kein Abo und damit kein Zugriff auf den Vereinsbereich (Pflicht-Abo, siehe lib/subscription-gate.ts). Wer hier einen Wert ergaenzt, ergaenzt den CHECK-Constraint mit.';

comment on column public.users.subscription_status is
  'Status der Stripe-Subscription, unveraendert durchgereicht. Siehe app/api/webhooks/stripe/route.ts.';
