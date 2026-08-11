/**
 * Behavioral test for the subscription dunning gate added to withAuth()
 * (lib/api-auth.ts). Regression guard for P3.1 of the 2026-07-26 audit
 * (docs/ARCHIV/2026-07-26-produktaudit-verkaufsreife.md): the SaaS business
 * model was previously enforced only in one page layout, never on the API
 * itself — this test locks in the centralized behavior.
 *
 * Mocks the Supabase SSR client and resolveActiveClub() so the REAL
 * withAuth()/requireAuth() run end to end; only isSubscriptionPastDue()'s
 * underlying `users` row is swapped per test via `mock.subscriptionStatus`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mock = vi.hoisted(() => ({
  role: 'admin' as 'owner' | 'superadmin' | 'admin' | 'trainer' | 'member',
  subscriptionStatus: 'active' as string | null,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(async () => {
        if (table === 'users') {
          return { data: { subscription_status: mock.subscriptionStatus }, error: null };
        }
        return { data: null, error: null };
      });
      // memberships query: awaited directly (no maybeSingle call in buildAuthContext)
      chain.then = (resolve: (v: unknown) => void) => {
        if (table === 'user_club_memberships') {
          resolve({ data: [{ club_id: 'club-1', role: mock.role }], error: null });
        } else {
          resolve({ data: [], error: null });
        }
        return chain;
      };
      return chain;
    }),
  })),
}));

vi.mock('@/lib/auth/resolve-active-club', () => ({
  resolveActiveClub: vi.fn(async () => ({
    clubId: mock.role === 'owner' || mock.role === 'superadmin' ? null : 'club-1',
    resolvedRole: mock.role,
    isValid: true,
  })),
}));

import { withAuth } from '@/lib/api-auth';

function makeRequest(method: string) {
  return new NextRequest('http://localhost/api/test', { method });
}

describe('withAuth: subscription dunning gate', () => {
  beforeEach(() => {
    mock.role = 'admin';
    mock.subscriptionStatus = 'active';
  });

  it('allows GET even when the admin subscription is past_due', async () => {
    mock.subscriptionStatus = 'past_due';
    const res = await withAuth(makeRequest('GET'), async () => NextResponse.json({ ok: true }));
    expect(res.status).toBe(200);
  });

  it('blocks POST for an admin whose subscription is past_due', async () => {
    mock.subscriptionStatus = 'past_due';
    const res = await withAuth(makeRequest('POST'), async () => NextResponse.json({ ok: true }));
    expect(res.status).toBe(402);
  });

  it('blocks POST for an admin whose subscription is unpaid', async () => {
    mock.subscriptionStatus = 'unpaid';
    const res = await withAuth(makeRequest('POST'), async () => NextResponse.json({ ok: true }));
    expect(res.status).toBe(402);
  });

  it('allows POST for an admin whose subscription is active', async () => {
    mock.subscriptionStatus = 'active';
    const res = await withAuth(makeRequest('POST'), async () => NextResponse.json({ ok: true }));
    expect(res.status).toBe(200);
  });

  it('blocks POST for a past_due superadmin too', async () => {
    mock.role = 'superadmin';
    mock.subscriptionStatus = 'past_due';
    const res = await withAuth(makeRequest('POST'), async () => NextResponse.json({ ok: true }));
    expect(res.status).toBe(402);
  });

  it('never blocks trainer, even with subscription_status past_due', async () => {
    mock.role = 'trainer';
    mock.subscriptionStatus = 'past_due';
    const res = await withAuth(makeRequest('POST'), async () => NextResponse.json({ ok: true }));
    expect(res.status).toBe(200);
  });

  it('never blocks member, even with subscription_status past_due', async () => {
    mock.role = 'member';
    mock.subscriptionStatus = 'past_due';
    const res = await withAuth(makeRequest('POST'), async () => NextResponse.json({ ok: true }));
    expect(res.status).toBe(200);
  });

  it('never blocks owner (platform staff, not a paying customer)', async () => {
    mock.role = 'owner';
    mock.subscriptionStatus = 'past_due';
    const res = await withAuth(makeRequest('POST'), async () => NextResponse.json({ ok: true }));
    expect(res.status).toBe(200);
  });

  it('respects allowWhilePastDue for routes a blocked admin must still reach', async () => {
    mock.subscriptionStatus = 'past_due';
    const res = await withAuth(makeRequest('POST'), async () => NextResponse.json({ ok: true }), {
      allowWhilePastDue: true,
    });
    expect(res.status).toBe(200);
  });
});
