/**
 * Verhaltens-Tests für POST /api/stripe/subscribe — Rollen-Restriktion pro
 * Plan-Typ und die Weiche "Plan-Wechsel via Update" vs. "neue Checkout-
 * Session" (Komplexität 33, tokensave test_risk: ungetestet, 16.09.2026).
 *
 * Die Update-statt-Neu-Session-Weiche war ein dokumentierter Doppel-
 * belastungs-Bug (siehe Kommentar in der Route) — deshalb hier fest
 * verankert.
 *
 * Nutzt den Standard-Harness (installSupabaseMock): der echte withApiAuth-
 * Code läuft, nur DB- und Stripe-SDK-Antworten sind kontrolliert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest } from '../helpers/api-route';

const supa = installSupabaseMock();

const fakeStripeClient = {
  checkout: {
    sessions: { create: vi.fn(async () => ({ id: 'cs_1', url: 'https://stripe.test/cs_1' })) },
  },
  subscriptions: {
    retrieve: vi.fn(async () => ({ items: { data: [{ id: 'si_1', price: { id: 'price_x' } }] } })),
    update: vi.fn(async () => ({ id: 'sub_1' })),
  },
};

vi.doMock('@/lib/stripe/client', () => ({
  getStripe: vi.fn(() => fakeStripeClient),
  STRIPE_CONFIGURED: true,
}));

const { POST } = await import('@/app/api/stripe/subscribe/route');

function subscribeRequest(body: unknown) {
  return makeApiRequest('http://localhost/api/stripe/subscribe', { method: 'POST', json: body });
}

describe('POST /api/stripe/subscribe', () => {
  beforeEach(() => {
    supa.reset();
    fakeStripeClient.checkout.sessions.create.mockClear();
    fakeStripeClient.subscriptions.retrieve.mockClear();
    fakeStripeClient.subscriptions.update.mockClear();
  });

  it('lehnt einen ungültigen Plan ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(subscribeRequest({ plan: 'gold' }));
    expect(res.status).toBe(400);
  });

  it('lehnt ein ungültiges Intervall ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(subscribeRequest({ plan: 'solo_s', interval: 'weekly' }));
    expect(res.status).toBe(400);
  });

  it('lehnt einen Solo-Plan für Nicht-Admins ab (Rollen-Restriktion)', async () => {
    supa.setRole('superadmin', 'club-1');
    const res = await POST(subscribeRequest({ plan: 'solo_s' }));
    expect(res.status).toBe(403);
  });

  it('lehnt einen Tennisschule-Plan für Nicht-Superadmins ab (Rollen-Restriktion)', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(subscribeRequest({ plan: 'school_s' }));
    expect(res.status).toBe(403);
  });

  it('erstellt eine neue Checkout-Session ohne bestehendes Abo', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('users', () => ({
      data: {
        email: 'admin@example.de',
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_status: 'free',
      },
      error: null,
    }));
    const res = await POST(subscribeRequest({ plan: 'solo_s' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe('https://stripe.test/cs_1');
    expect(fakeStripeClient.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(fakeStripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('aktualisiert ein bestehendes aktives Abo statt eine neue Session zu erzeugen (Doppelbelastungs-Guard)', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('users', () => ({
      data: {
        email: 'admin@example.de',
        stripe_customer_id: 'cus_1',
        stripe_subscription_id: 'sub_existing',
        subscription_status: 'active',
      },
      error: null,
    }));
    const res = await POST(subscribeRequest({ plan: 'solo_l' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(fakeStripeClient.subscriptions.update).toHaveBeenCalledTimes(1);
    expect(fakeStripeClient.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
