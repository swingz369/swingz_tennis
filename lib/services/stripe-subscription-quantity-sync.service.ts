/**
 * Stripe Subscription Quantity Sync (Ticket 3.6.1 — Pay-per-Active-Member-Pricing)
 *
 * Idempotent sync of a Stripe Subscription's per-active-member quantity.
 * Reads active-member-count for a club, compares against the cached value on
 * `users.stripe_subscription_quantity_synced`, and only calls the Stripe API
 * when the count actually changed.
 *
 * Threshold logic (`shouldSyncQuantity`) is pure and exported for direct
 * unit-testing. The Stripe-API side is in `syncSubscriptionItemQuantity`.
 */

import type Stripe from 'stripe';
import { createLogger } from '@/lib/logger';

const log = createLogger('services:stripe-quantity-sync');

export interface SyncQuantityInput {
  /** Current locally-cached quantity (or null if never synced). */
  currentSyncedQuantity: number | null;
  /** Target quantity derived from active-member-count. */
  targetQuantity: number;
}

export type SyncOutcomeReason = 'no-change' | 'first-sync' | 'synced' | 'no-plan-item' | 'failed';

export interface SyncQuantityResult {
  updated: boolean;
  newQuantity: number | null;
  reason: SyncOutcomeReason;
  error?: string;
}

/**
 * Pure deterministic threshold comparator.
 *
 * Returns `false` when target matches the cached value (= idempotent short-circuit,
 * saves the Stripe API roundtrip). Returns `true` for first-sync (cached = null)
 * and any genuine quantity delta. Negative targets are rejected as a defensive
 * guard against bugs upstream in the active-member-count query.
 *
 * Exported as a named export so vitest can cover the threshold logic without
 * touching the Stripe SDK. The idempotency-correctness of the whole service
 * rests on this function being correct.
 */
export function shouldSyncQuantity(input: SyncQuantityInput): boolean {
  if (!Number.isFinite(input.targetQuantity) || input.targetQuantity < 0) {
    return false;
  }
  // First-sync: no cached quantity → force a push so the subscription matches
  // the club's actual active-member-count (prevent sticker-shock on first invoice).
  if (input.currentSyncedQuantity == null) {
    return true;
  }
  return input.currentSyncedQuantity !== input.targetQuantity;
}

/**
 * Find the SaaS-plan item in a Stripe subscription.
 * Strategy: prefer items whose price nickname / product name hints at membership
 * pricing; fall back to the first item if no hint matches. This keeps the
 * service stable across Stripe dashboard configurations where the plan item
 * is the only line on the subscription.
 */
export function findSaasPlanItem(sub: Stripe.Subscription): Stripe.SubscriptionItem | null {
  const hints = ['mitglied', 'membership', 'saas', 'mitglieder', 'klub'];
  for (const item of sub.items.data) {
    const nickname = (item.price.nickname ?? '').toLowerCase();
    const product = item.price.product;
    const productName =
      typeof product === 'string' ? product.toLowerCase() : (product?.name ?? '').toLowerCase();
    if (hints.some((h) => nickname.includes(h) || productName.includes(h))) {
      return item;
    }
  }
  // Fallback: the first subscription-item is almost always the plan item
  // for SaaS subscriptions with a single line item.
  return sub.items.data[0] ?? null;
}

/**
 * Sync the Stripe subscription item quantity to targetQuantity.
 * Idempotent: returns `no-change` if currentSyncedQuantity equals targetQuantity.
 * On Stripe API error, returns `failed` with the error message — never throws,
 * so the route caller can persist the failure to audit_logs without try/catch.
 */
export async function syncSubscriptionItemQuantity(args: {
  stripe: Stripe;
  subscriptionId: string;
  currentSyncedQuantity: number | null;
  targetQuantity: number;
}): Promise<SyncQuantityResult> {
  if (!shouldSyncQuantity({
    currentSyncedQuantity: args.currentSyncedQuantity,
    targetQuantity: args.targetQuantity,
  })) {
    return { updated: false, newQuantity: args.currentSyncedQuantity, reason: 'no-change' };
  }

  try {
    const subscription = await args.stripe.subscriptions.retrieve(args.subscriptionId);
    const planItem = findSaasPlanItem(subscription);
    if (!planItem) {
      log.warn('No plan item found in subscription', { subscriptionId: args.subscriptionId });
      return { updated: false, newQuantity: null, reason: 'no-plan-item' };
    }
    await args.stripe.subscriptionItems.update(planItem.id, {
      quantity: args.targetQuantity,
      proration_behavior: 'create_prorations',
    });
    log.info('Synced subscription quantity', {
      subscriptionId: args.subscriptionId,
      itemId: planItem.id,
      oldQuantity: args.currentSyncedQuantity,
      newQuantity: args.targetQuantity,
    });
    return {
      updated: true,
      newQuantity: args.targetQuantity,
      reason: args.currentSyncedQuantity == null ? 'first-sync' : 'synced',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe API error';
    log.error('Stripe quantity sync failed', { subscriptionId: args.subscriptionId, message });
    return {
      updated: false,
      newQuantity: args.currentSyncedQuantity,
      reason: 'failed',
      error: message,
    };
  }
}
