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

Aktiv in `subscription_tiers` (Migration `20260724_subscription_tiers.sql`):

| Tier             |       Preis | Beschreibung                                                       |
| ---------------- | ----------: | ------------------------------------------------------------------ |
| **Starter**      | €29 / Monat | 1 Verein, bis 100 Mitglieder, Kern-Module                          |
| **Professional** | €79 / Monat | Multi-Club (Superadmin), alle Module, Smart Court-Add-On verfügbar |

Plan-Wechsel siehe `app/api/stripe/subscribe`. ⚠️ **P0-Finding 7**: aktuell erzeugt `subscribe/route.ts:81-96` eine **neue Checkout-Session** statt vorhandene Subscription via `subscriptions.update()` zu mutieren → Doppel-Belastung möglich.

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

| Event                           | Handler                  | Aktion                                                                                          |
| ------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `checkout.session.completed`    | `subscription_created`   | Neue Subscription in DB, Club-Features unlocken                                                 |
| `invoice.paid`                  | `mark_invoice_paid`      | `invoices.status = 'paid'`, `paid_at = now`, dunning-record close                               |
| `invoice.payment_failed`        | `mark_invoice_failed`    | ⚠️ **Aktuell nicht behandelt** (P0-8) — TODO: dunning-record escalate, club-flag, member-Notify |
| `invoice.created`               | `sync_invoice`           | Stripe-Invoice in DB spiegeln                                                                   |
| `customer.subscription.updated` | `sync_subscription`      | Plan-Change, Quantity-Update                                                                    |
| `customer.subscription.deleted` | `subscription_cancelled` | Club-Account deaktivieren nach Grace-Period                                                     |
| `charge.dispute.created`        | `notify_owner`           | E-Mail an Owner bei Chargeback                                                                  |
| `charge.refunded`               | `mark_invoice_refunded`  |                                                                                                 |

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
