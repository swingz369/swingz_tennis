# Stripe — Integration, Webhook-Idempotenz, Dunning

> **Single source of code:** `lib/stripe/`. Niemals `stripe`-Package direkt importieren — immer Wrapper.

## 🧱 Architektur

```
Stripe-Payment-Provider (API 2026-06-24.dahlia)
   │
   ├── lib/stripe/client.ts        ← Graceful (für Checkout-UI, returnt null wenn nicht konfiguriert)
   ├── lib/stripe/stripe-client.ts ← Strict (für Webhooks, wirft wenn nicht konfiguriert)
   ├── lib/stripe-subscription-quantity-sync.service.ts ← Pure Logic + Side Effects
   └── lib/services/billing.service.ts                     ← Application-Layer
```

**Direkt `import 'stripe'` ist verboten.** Jeglicher Stripe-Code geht durch die Wrapper, sonst:

- Direktes Stripe-Call in API-Route → schwierig zu testen
- Inkonsistente Error-Handling
- Bypass der Idempotenz-Check

## 💰 Pricing-Tiers

Einzige Quelle: `lib/plans.ts` (Tarif-Keys in `users.subscription_tier`):

| Tier                            |       Preis | Beschreibung       |
| ------------------------------- | ----------: | ------------------ |
| **Starter** (`solo_s`)          | €29 / Monat | bis 200 Mitglieder |
| **Professional** (`solo_l`)     | €49 / Monat | ab 201 Mitglieder  |
| **Tennisschule S** (`school_s`) | €79 / Monat | bis zu 5 Vereine   |
| **Tennisschule L** (`school_l`) | €99 / Monat | mehr als 5 Vereine |

Plan-Wechsel siehe `app/api/stripe/subscribe`. Bei bereits aktivem Abo (`status` `active`/`trialing`) wird die bestehende Subscription per `subscriptions.update()` gewechselt statt eine zweite Checkout-Session zu erzeugen (`subscribe/route.ts` § "Plan-Wechsel bei bereits aktivem Abo") — verhindert die Doppel-Belastung, die hier früher als offener Punkt stand.

## 🛒 Checkout-Flow

```
Client (UI)
   │  POST /api/stripe/checkout { tier, billing_cycle }
   ▼
API-Route /api/stripe/checkout
   │  withApiAuth → auth.clubId (oder neu: club_id)
   │  Club.currentSubscription → Falls vorhanden: subscriptions.update
   │  Sonst: stripe.checkout.sessions.create
   ▼
Stripe-Checkout-Page (User payer)
   │  Zahlt
   ▼
Stripe → POST /api/webhooks/stripe  (siehe unten)
```

## 🔔 Webhook-Receiver

**Datei:** `app/api/webhooks/stripe/route.ts`

### Verarbeitete Events

Stand: Code-Check `app/api/webhooks/stripe/route.ts` (16.09.2026) — die Tabelle war zuvor veraltet
(dokumentierte u. a. `invoice.payment_failed` als unbehandelt, obwohl es seit Längerem behandelt
wird; `invoice.paid`/`invoice.created`/`charge.dispute.created` existieren dagegen nicht im Code).

| Event                           | Handler                                                                                                                            | Aktion                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `checkout.session.completed`    | `handleSaasSubscription` / `handleShopOrderPayment` / `handleInvoicePayment` / `handleBookingPayment` (je nach `session.metadata`) | SaaS-Abo anlegen, Shop-Bestellung, Rechnung oder Buchung als bezahlt markieren    |
| `customer.subscription.updated` | `handleSubscriptionUpdated`                                                                                                        | Plan-Wechsel, Mengen-Update in der DB spiegeln                                    |
| `customer.subscription.deleted` | `handleSubscriptionDeleted`                                                                                                        | Club-/Nutzer-Abo deaktivieren                                                     |
| `payment_intent.succeeded`      | `handlePaymentIntentSucceeded`                                                                                                     | SEPA-Lastschrift-Zahlungen (laufen nicht über `checkout.session.completed`)       |
| `payment_intent.payment_failed` | Inline + `handleBookingPaymentFailed`                                                                                              | Zahlung als `failed` markieren, Buchung ggf. stornieren                           |
| `invoice.payment_failed`        | `handleSaasInvoicePaymentFailed`                                                                                                   | Benachrichtigung (In-App + E-Mail) an den Nutzer bei fehlgeschlagener Abo-Zahlung |
| `charge.refunded`               | `handleChargeRefunded`                                                                                                             | Rückerstattung verbuchen                                                          |

Jeder nicht gelistete Event-Typ landet im `default`-Zweig und wird nur geloggt (`log.info('Unhandled event type', …)`), ohne Fehler.

### Idempotenz

Stripe sendet Webhooks bis zu 3× (Retry). Mehrfache Verarbeitung würde z. B. eine Rechnung doppelt markieren.

**Lösung:** Atomare RPC `check_and_record_stripe_event(event_id)` in `supabase/migrations/20260623_stripe_events_idempotency.sql`:

```sql
-- Migration 20260623
CREATE TABLE stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB
);

CREATE OR REPLACE FUNCTION check_and_record_stripe_event(event_id text, event_type text, payload jsonb)
RETURNS boolean -- true wenn noch nicht verarbeitet
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO stripe_events (event_id, event_type, payload)
    VALUES (event_id, event_type, payload);
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END;
$$;
```

**Handler-Aufbau:**

```ts
const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
const { data } = await supabase.rpc('check_and_record_stripe_event', {
  event_id: event.id,
  event_type: event.type,
  payload: event,
});
if (!data) return NextResponse.json({ status: 'already_processed' });

// erst dann: Handler-Switch
switch (event.type) {
  case 'invoice.paid': await markInvoicePaid(...); break;
  // …
}
```

### Signatur-Verifikation

`stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)` aus `process.env.STRIPE_WEBHOOK_SECRET`. Wirft bei ungültiger Signatur → 400.

⚠️ **Wichtig:** Body-Parse muss `request.text()` sein (nicht `request.json()`) — Stripe-Signatur ist auf RAW-Body berechnet.

## 💳 Subscription-Quantity-Sync

**Datei:** `lib/stripe-subscription-quantity-sync.service.ts` — **Vorzeige-Pattern.**

Pure-Logic-First:

```ts
export type QuantitySyncResult =
  { kind: 'noop' } | { kind: 'update'; newQuantity: number; delta: number };

export function computeQuantitySync(
  currentSubscription: Subscription,
  activeMemberCount: number
): QuantitySyncResult {
  // pure logic, easy to test
  if (activeMemberCount === currentSubscription.quantity) return { kind: 'noop' };
  return {
    kind: 'update',
    newQuantity: activeMemberCount,
    delta: activeMemberCount - currentSubscription.quantity,
  };
}

export async function applyQuantitySync(result: QuantitySyncResult): Promise<void> {
  if (result.kind === 'noop') return;
  await stripe.subscriptions.update(currentSubscription.id, { quantity: result.newQuantity });
}
```

## ⚠️ Bekannte Probleme

| Problem                                                                            | Severity | Finding           |
| ---------------------------------------------------------------------------------- | -------- | ----------------- |
| Plan-Wechsel erzeugt Doppel-Belastung                                              | 🔴 P0    | P0-7              |
| Kein Dunning-Handler (`invoice.payment_failed`)                                    | 🔴 P0    | P0-8              |
| `lib/billing-engine.ts` und `src/application/services/billing.service.ts` parallel | 🟡 P1    | Architektur-Drift |
| Zapier-Webhook Dev-Bypass (`NODE_ENV !== 'production'`)                            | 🟡 P1    | –                 |
| Stripe-Customer-Portal nicht für Trainer-only-Abrechnung                           | 🟡 P1    | –                 |

## 🧪 Tests

- **Webhook-Handler Unit-Test**: `src/__tests__/api/webhooks/stripe.test.ts`
  - Idempotenz: zweimaliger POST mit gleichem event_id → nur 1× processing
  - Signatur-Failure: 400
- **Quantity-Sync**: pure-logic Tests mit Mock-Subscription + Member-Counts
- **Dunning-Flow Integration**: mit Test-Stripe-mock

## 📚 Verwandte Kapitel

- [`api-conventions.md`](./api-conventions.md) — wie eine Stripe-Webhook-Route aussieht
- [`auth-rbac.md`](./auth-rbac.md) — Webhook-Auth (kein User-Kontext → API-Key)
- [`background-jobs.md`](./background-jobs.md) — Dunning-Cron
- [`api-reference.md`](./api-reference.md) — alle Stripe-Routes
