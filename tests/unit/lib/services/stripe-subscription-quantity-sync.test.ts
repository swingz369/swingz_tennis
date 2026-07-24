/**
 * Vitest coverage for stripe-subscription-quantity-sync.service.ts
 *
 * Tests the pure threshold logic + plan-item-finder exhaustively. The async
 * service contract is verified via a lightweight Stripe SDK mock that
 * captures subscription.retrieve + subscriptionItems.update calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';
import {
  shouldSyncQuantity,
  findSaasPlanItem,
  syncSubscriptionItemQuantity,
} from '@/lib/services/stripe-subscription-quantity-sync.service';

// Helper: builds a minimal Stripe.Subscription-shaped fixture for findSaasPlanItem tests.
function buildStripeSub(
  items: Array<{ id: string; nickname: string; productName?: string }>
): Stripe.Subscription {
  return {
    id: 'sub_test',
    items: {
      data: items.map((i) => ({
        id: i.id,
        price: {
          id: `price_${i.id}`,
          nickname: i.nickname,
          product: i.productName
            ? ({ id: 'prod_x', name: i.productName } as Stripe.Product)
            : 'prod_x',
        },
      })) as unknown as Stripe.SubscriptionItem[],
    },
  } as unknown as Stripe.Subscription;
}

function buildStripeMock(
  overrides: Partial<{
    retrieve: () => Promise<Stripe.Subscription>;
    update: (id: string, params: { quantity: number }) => Promise<unknown>;
  }> = {}
): Stripe {
  return {
    subscriptions: {
      retrieve: vi.fn(
        overrides.retrieve ??
          (async () => buildStripeSub([{ id: 'si_x', nickname: 'mitgliedschaft' }]))
      ),
    },
    subscriptionItems: {
      update: vi.fn(overrides.update ?? (async () => ({}))),
    },
  } as unknown as Stripe;
}

describe('stripe-subscription-quantity-sync — pure helpers', () => {
  describe('shouldSyncQuantity', () => {
    it('returns false when target equals cached', () => {
      expect(shouldSyncQuantity({ currentSyncedQuantity: 5, targetQuantity: 5 })).toBe(false);
    });

    it('returns true on first-sync (cached = null)', () => {
      expect(shouldSyncQuantity({ currentSyncedQuantity: null, targetQuantity: 0 })).toBe(true);
    });

    it('returns true on first-sync even when target = 0 (canonicalize sticker-shock)', () => {
      // Important: empty clubs must still push quantity=0 once so invoices
      // do not roll forward with stale quantities from a prior migration.
      expect(shouldSyncQuantity({ currentSyncedQuantity: null, targetQuantity: 0 })).toBe(true);
    });

    it('returns true when target grew', () => {
      expect(shouldSyncQuantity({ currentSyncedQuantity: 5, targetQuantity: 6 })).toBe(true);
    });

    it('returns true when target shrank', () => {
      expect(shouldSyncQuantity({ currentSyncedQuantity: 5, targetQuantity: 4 })).toBe(true);
    });

    it('returns false when target is negative (defensive reject)', () => {
      expect(shouldSyncQuantity({ currentSyncedQuantity: 5, targetQuantity: -1 })).toBe(false);
      expect(shouldSyncQuantity({ currentSyncedQuantity: null, targetQuantity: -3 })).toBe(false);
    });

    it('returns false when target is NaN/Infinity (defensive reject)', () => {
      expect(shouldSyncQuantity({ currentSyncedQuantity: 5, targetQuantity: NaN })).toBe(false);
      expect(shouldSyncQuantity({ currentSyncedQuantity: 5, targetQuantity: Infinity })).toBe(
        false
      );
    });

    it('returns true when target = 0 and cached was 5 (member cleanup)', () => {
      expect(shouldSyncQuantity({ currentSyncedQuantity: 5, targetQuantity: 0 })).toBe(true);
    });
  });

  describe('findSaasPlanItem', () => {
    it('returns item with "mitglied" in nickname (German)', () => {
      const sub = buildStripeSub([
        { id: 'si_addon', nickname: 'addon' },
        { id: 'si_plan', nickname: 'mitgliedschaft-monatlich' },
      ]);
      expect(findSaasPlanItem(sub)?.id).toBe('si_plan');
    });

    it('returns item with "membership" in nickname (English)', () => {
      const sub = buildStripeSub([{ id: 'si_a', nickname: 'membership-pro' }]);
      expect(findSaasPlanItem(sub)?.id).toBe('si_a');
    });

    it('returns item with hint in product-name', () => {
      const sub = buildStripeSub([
        { id: 'si_x', nickname: 'plan', productName: 'SaaS Subscription' },
      ]);
      expect(findSaasPlanItem(sub)?.id).toBe('si_x');
    });

    it('matches "saas" hint everywhere', () => {
      const sub = buildStripeSub([{ id: 'si_saas', nickname: 'pro-saas' }]);
      expect(findSaasPlanItem(sub)?.id).toBe('si_saas');
    });

    it('matches "klub" hint (alternative German)', () => {
      const sub = buildStripeSub([{ id: 'si_klub', nickname: 'klub-flat' }]);
      expect(findSaasPlanItem(sub)?.id).toBe('si_klub');
    });

    it('falls back to first item when no hint matches', () => {
      const sub = buildStripeSub([
        { id: 'si_first', nickname: 'random-plan' },
        { id: 'si_second', nickname: 'another' },
      ]);
      expect(findSaasPlanItem(sub)?.id).toBe('si_first');
    });

    it('returns null when subscription has no items', () => {
      const sub = buildStripeSub([]);
      expect(findSaasPlanItem(sub)).toBeNull();
    });
  });
});

describe('stripe-subscription-quantity-sync — service contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no-change when threshold says skip', async () => {
    const stripe = buildStripeMock();
    const result = await syncSubscriptionItemQuantity({
      stripe,
      subscriptionId: 'sub_1',
      currentSyncedQuantity: 5,
      targetQuantity: 5,
    });
    expect(result).toEqual({ updated: false, newQuantity: 5, reason: 'no-change' });
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(stripe.subscriptionItems.update).not.toHaveBeenCalled();
  });

  it('first-sync forces a sync even when target = 0', async () => {
    const retrieve = vi.fn(async () =>
      buildStripeSub([{ id: 'si_plan', nickname: 'mitgliedschaft' }])
    );
    const update = vi.fn(async () => ({}));
    const stripe = buildStripeMock({ retrieve, update });
    const result = await syncSubscriptionItemQuantity({
      stripe,
      subscriptionId: 'sub_first',
      currentSyncedQuantity: null,
      targetQuantity: 0,
    });
    expect(result.updated).toBe(true);
    expect(result.newQuantity).toBe(0);
    expect(result.reason).toBe('first-sync');
    expect(update).toHaveBeenCalledWith('si_plan', expect.objectContaining({ quantity: 0 }));
  });

  it('returns synced when quantity actually changed', async () => {
    const stripe = buildStripeMock({
      retrieve: async () => buildStripeSub([{ id: 'si_p', nickname: 'mitglieder-flat' }]),
    });
    const result = await syncSubscriptionItemQuantity({
      stripe,
      subscriptionId: 'sub_change',
      currentSyncedQuantity: 5,
      targetQuantity: 7,
    });
    expect(result).toEqual({ updated: true, newQuantity: 7, reason: 'synced' });
    expect(stripe.subscriptionItems.update).toHaveBeenCalledWith(
      'si_p',
      expect.objectContaining({ quantity: 7, proration_behavior: 'create_prorations' })
    );
  });

  it('returns no-plan-item when subscription has no items', async () => {
    const stripe = buildStripeMock({
      retrieve: async () => buildStripeSub([]),
    });
    const result = await syncSubscriptionItemQuantity({
      stripe,
      subscriptionId: 'sub_empty',
      currentSyncedQuantity: 5,
      targetQuantity: 6,
    });
    expect(result.reason).toBe('no-plan-item');
    expect(result.updated).toBe(false);
    expect(stripe.subscriptionItems.update).not.toHaveBeenCalled();
  });

  it('returns failed without throwing when Stripe API throws', async () => {
    const stripe = buildStripeMock({
      retrieve: vi.fn(async () => {
        throw new Error('Network down');
      }),
    });
    const result = await syncSubscriptionItemQuantity({
      stripe,
      subscriptionId: 'sub_err',
      currentSyncedQuantity: 5,
      targetQuantity: 6,
    });
    expect(result.reason).toBe('failed');
    expect(result.updated).toBe(false);
    expect(result.error).toBe('Network down');
    expect(result.newQuantity).toBe(5); // unchanged
  });

  it('does NOT call update when negative target was rejected by threshold', async () => {
    const stripe = buildStripeMock();
    const result = await syncSubscriptionItemQuantity({
      stripe,
      subscriptionId: 'sub_neg',
      currentSyncedQuantity: 5,
      targetQuantity: -2,
    });
    expect(result.reason).toBe('no-change');
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});
