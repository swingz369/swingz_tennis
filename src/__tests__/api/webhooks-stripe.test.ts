/**
 * Verhaltens-Tests für POST /api/webhooks/stripe — der Geld-Pfad des Abo- und
 * Zahlungs-Flows (Komplexität 38, tokensave test_risk: ungetestet, 16.09.2026).
 *
 * Diese Route läuft NICHT über withApiAuth/den Auth-Harness — sie ist ein
 * unauthentifizierter Webhook, dessen Vertrauensanker die Stripe-Signatur ist.
 * Deshalb kommt hier kein installSupabaseMock() zum Einsatz (der würde die
 * @supabase/ssr-Auth-Kette mocken, die diese Route gar nicht importiert).
 * Stattdessen: `constructStripeEvent` liefert ein von jedem Testfall frei
 * wählbares Stripe.Event, und `createServiceClient()` liefert einen
 * eigenständigen Fake-Client (kein mockState-Sharing nötig — die Route
 * verwendet `.rpc(...).maybeSingle()` fürs Idempotency-Gate, was der
 * generische Harness-Client so nicht chaint).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Preis-IDs kommen lokal aus .env.local, in CI gibt es sie nicht.
vi.hoisted(() => {
  process.env.STRIPE_PRICE_SOLO_S ??= 'price_solo_s_test';
  process.env.STRIPE_PRICE_SOLO_L ??= 'price_solo_l_test';
  process.env.STRIPE_PRICE_SCHOOL_S ??= 'price_school_s_test';
  process.env.STRIPE_PRICE_SCHOOL_L ??= 'price_school_l_test';
});
import { makeApiRequest } from '../helpers/api-route';

type TableHandler = (state: {
  op: 'select' | 'insert' | 'update' | 'delete';
  filters: Record<string, unknown>;
  payload?: unknown;
}) => { data: unknown; error: unknown };

let tableHandlers: Record<string, TableHandler> = {};
let rpcIsNew = true;
let rpcError: Error | null = null;

function buildChain(table: string) {
  const state: {
    op: 'select' | 'insert' | 'update' | 'delete';
    filters: Record<string, unknown>;
    payload?: unknown;
  } = {
    op: 'select',
    filters: {},
  };
  const handler = tableHandlers[table] ?? (() => ({ data: null, error: null }));
  const resolve = () => Promise.resolve(handler(state));
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.order = self;
  chain.gte = self;
  chain.insert = (payload: unknown) => {
    state.op = 'insert';
    state.payload = payload;
    return chain;
  };
  chain.update = (payload: unknown) => {
    state.op = 'update';
    state.payload = payload;
    return chain;
  };
  chain.delete = () => {
    state.op = 'delete';
    return chain;
  };
  chain.eq = (col: string, val: unknown) => {
    state.filters[col] = val;
    return chain;
  };
  chain.single = () => resolve();
  chain.maybeSingle = () => resolve();
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    resolve().then(onFulfilled, onRejected);
  return chain;
}

let currentEvent: { id: string; type: string; data: { object: unknown } } | null = null;

const fakeStripeClient = {
  subscriptions: { retrieve: vi.fn(), update: vi.fn() },
  checkout: { sessions: { list: vi.fn(async () => ({ data: [] })), create: vi.fn() } },
};

vi.doMock('@/lib/stripe/stripe-client', () => ({
  constructStripeEvent: vi.fn(() => currentEvent),
  stripe: () => fakeStripeClient,
}));

vi.doMock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => buildChain(table),
    rpc: () => ({
      maybeSingle: async () => ({ data: rpcIsNew, error: rpcError }),
    }),
  }),
}));

const billingEngineMock = {
  updatePaymentStatus: vi.fn(async () => {}),
  getInvoiceById: vi.fn(async () => null),
  createPayment: vi.fn(async () => ({ id: 'payment-new' })),
};
vi.doMock('@/lib/billing-engine', () => ({ billingEngine: billingEngineMock }));

class FakeResend {
  emails = { send: vi.fn(async () => ({ data: {}, error: null })) };
}
vi.doMock('resend', () => ({ Resend: FakeResend }));

const { POST } = await import('@/app/api/webhooks/stripe/route');

function webhookRequest(event: unknown, signature: string | null = 'sig_test') {
  return makeApiRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    json: event,
    headers: signature ? { 'stripe-signature': signature } : {},
  });
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    tableHandlers = {};
    rpcIsNew = true;
    rpcError = null;
    currentEvent = null;
    billingEngineMock.updatePaymentStatus.mockClear();
  });

  it('lehnt eine Anfrage ohne stripe-signature-Header ab', async () => {
    const res = await POST(webhookRequest({}, null));
    expect(res.status).toBe(400);
  });

  it('dedupliziert ein bereits verarbeitetes Event (Idempotency-Gate)', async () => {
    rpcIsNew = false;
    currentEvent = { id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } };
    const res = await POST(webhookRequest(currentEvent));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ received: true, deduplicated: true });
  });

  it('bricht bei einem Fehler der Event-Reservierung mit 503 ab', async () => {
    rpcError = new Error('DB nicht erreichbar');
    currentEvent = { id: 'evt_rpc_error', type: 'some.unhandled.event', data: { object: {} } };
    const res = await POST(webhookRequest(currentEvent));
    expect(res.status).toBe(503);
  });

  it('gibt die Event-Reservierung nach einem Handler-Fehler für den Retry frei', async () => {
    let releasedId: unknown = null;
    tableHandlers.stripe_events = (state) => {
      if (state.op === 'delete') releasedId = state.filters.stripe_event_id;
      return { data: null, error: null };
    };
    billingEngineMock.updatePaymentStatus.mockRejectedValueOnce(
      new Error('Zahlung vorübergehend nicht schreibbar')
    );
    tableHandlers.payments = () => ({ data: { id: 'payment-1' }, error: null });
    currentEvent = {
      id: 'evt_retry',
      type: 'charge.refunded',
      data: { object: { id: 'ch_retry', payment_intent: 'pi_retry' } },
    };
    const res = await POST(webhookRequest(currentEvent));
    expect(res.status).toBe(500);
    expect(releasedId).toBe('evt_retry');
  });

  it('schließt eine beim ersten Versuch nur angelegte Rechnungszahlung beim Retry ab', async () => {
    billingEngineMock.getInvoiceById.mockResolvedValueOnce({
      id: 'invoice-1',
      member_id: null,
    } as never);
    tableHandlers.payments = () => ({
      data: { id: 'payment-existing', status: 'pending' },
      error: null,
    });
    currentEvent = {
      id: 'evt_invoice_retry',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_retry',
          payment_intent: 'pi_retry',
          metadata: { invoiceId: 'invoice-1' },
          payment_method_types: ['card'],
        },
      },
    };
    const res = await POST(webhookRequest(currentEvent));
    expect(res.status).toBe(200);
    expect(billingEngineMock.updatePaymentStatus).toHaveBeenCalledWith(
      'payment-existing',
      'completed'
    );
  });

  it('aktiviert ein SaaS-Abo bei checkout.session.completed mit saasSubscription-Metadata', async () => {
    let capturedUpdate: unknown = null;
    tableHandlers.users = (state) => {
      if (state.op === 'update') capturedUpdate = state.payload;
      return { data: null, error: null };
    };
    currentEvent = {
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          customer: 'cus_1',
          subscription: 'sub_1',
          metadata: { saasSubscription: 'true', adminUserId: 'user-1', plan: 'solo_s' },
        },
      },
    };
    const res = await POST(webhookRequest(currentEvent));
    expect(res.status).toBe(200);
    expect(capturedUpdate).toMatchObject({
      subscription_tier: 'solo_s',
      subscription_status: 'active',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
    });
  });

  it('aktualisiert Tier und Status bei customer.subscription.updated', async () => {
    let capturedUpdate: unknown = null;
    tableHandlers.users = (state) => {
      if (state.op === 'update') capturedUpdate = state.payload;
      return { data: null, error: null };
    };
    currentEvent = {
      id: 'evt_3',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status: 'active',
          items: { data: [{ price: { id: process.env.STRIPE_PRICE_SOLO_L } }] },
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        },
      },
    };
    const res = await POST(webhookRequest(currentEvent));
    expect(res.status).toBe(200);
    expect(capturedUpdate).toMatchObject({
      subscription_status: 'active',
      stripe_subscription_id: 'sub_1',
      subscription_tier: 'solo_l',
    });
  });

  it('setzt den Nutzer bei customer.subscription.deleted auf free zurück', async () => {
    let capturedUpdate: unknown = null;
    tableHandlers.users = (state) => {
      if (state.op === 'update') capturedUpdate = state.payload;
      return { data: null, error: null };
    };
    currentEvent = {
      id: 'evt_4',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', customer: 'cus_1' } },
    };
    const res = await POST(webhookRequest(currentEvent));
    expect(res.status).toBe(200);
    expect(capturedUpdate).toMatchObject({
      subscription_tier: 'free',
      subscription_status: 'inactive',
      stripe_subscription_id: null,
    });
  });

  it('markiert die Zahlung bei charge.refunded als erstattet', async () => {
    tableHandlers.payments = (state) => {
      if (state.op === 'select') return { data: { id: 'payment-1' }, error: null };
      return { data: null, error: null };
    };
    currentEvent = {
      id: 'evt_5',
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_1' } },
    };
    const res = await POST(webhookRequest(currentEvent));
    expect(res.status).toBe(200);
    expect(billingEngineMock.updatePaymentStatus).toHaveBeenCalledWith('payment-1', 'refunded');
  });

  it('holt den Buchungsstatus beim Retry auch nach bereits abgeschlossener Zahlung nach', async () => {
    let bookingUpdate: unknown = null;
    tableHandlers.payments = () => ({
      data: { id: 'payment-1', status: 'completed' },
      error: null,
    });
    tableHandlers.bookings = (state) => {
      if (state.op === 'update') bookingUpdate = state.payload;
      return { data: state.op === 'select' ? { payment_status: 'pending' } : null, error: null };
    };
    fakeStripeClient.checkout.sessions.list.mockResolvedValueOnce({
      data: [{ metadata: { bookingId: 'booking-1' } }],
    } as never);
    currentEvent = {
      id: 'evt_async_retry',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_async_retry' } },
    };
    const res = await POST(webhookRequest(currentEvent));
    expect(res.status).toBe(200);
    expect(bookingUpdate).toMatchObject({ status: 'confirmed', payment_status: 'paid' });
  });

  it('beantwortet einen unbekannten Event-Typ ohne Fehler (default-Branch)', async () => {
    currentEvent = { id: 'evt_6', type: 'some.unhandled.event', data: { object: {} } };
    const res = await POST(webhookRequest(currentEvent));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ received: true });
  });
});
