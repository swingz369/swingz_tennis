/**
 * Pflicht-Abo statt Freemium (PRODUKTIONSREIFE.md 3.1).
 *
 * Der teure Fall ist nicht "blockiert, obwohl bezahlt", sondern
 * "durchgelassen, obwohl nie bezahlt" — genau das war der Zustand vorher:
 * subscription_tier stand per Vorgabewert auf 'free', subscription_status auf
 * 'active', und geprüft wurde nur der Status. Ein Neukonto hatte damit
 * dauerhaft vollen Zugriff.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSubscriptionState, isSubscriptionPastDue } from '@/lib/subscription-gate';

function clientReturning(row: { subscription_tier?: string; subscription_status?: string } | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('getSubscriptionState', () => {
  it('lässt ein bezahltes, laufendes Abo durch', async () => {
    const sb = clientReturning({ subscription_tier: 'solo_s', subscription_status: 'active' });
    expect(await getSubscriptionState(sb, 'u1')).toBe('ok');
  });

  it('sperrt den Freemium-Vorgabewert — der eigentliche Befund', async () => {
    const sb = clientReturning({ subscription_tier: 'free', subscription_status: 'active' });
    expect(await getSubscriptionState(sb, 'u1')).toBe('none');
  });

  it('sperrt ein Konto ohne jede Abo-Zeile', async () => {
    expect(await getSubscriptionState(clientReturning(null), 'u1')).toBe('none');
  });

  it('meldet den Mahnfall getrennt, damit der Kunde ins Stripe-Portal kommt', async () => {
    const sb = clientReturning({ subscription_tier: 'solo_l', subscription_status: 'past_due' });
    expect(await getSubscriptionState(sb, 'u1')).toBe('past_due');
    expect(await isSubscriptionPastDue(sb, 'u1')).toBe(true);
  });

  it('behandelt ein gekündigtes Abo wie keines', async () => {
    const sb = clientReturning({ subscription_tier: 'school_s', subscription_status: 'canceled' });
    expect(await getSubscriptionState(sb, 'u1')).toBe('none');
  });

  it('meldet ein Konto ohne Abo NICHT als Mahnfall — sonst landet ein Neukunde im Stripe-Portal statt in der Tarifauswahl', async () => {
    const sb = clientReturning({ subscription_tier: 'free', subscription_status: 'active' });
    expect(await isSubscriptionPastDue(sb, 'u1')).toBe(false);
  });
});
