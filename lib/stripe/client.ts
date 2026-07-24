/**
 * Stripe client - lazy-initialized, gracefully handles missing/placeholder keys
 */

const PLACEHOLDER_PREFIX = 'sk_test_51Qabc';

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith(PLACEHOLDER_PREFIX)) {
    return null; // Stripe not configured
  }
  // Use require to avoid module-level errors when key is absent
  const Stripe = require('stripe');
  return new Stripe(key, { apiVersion: '2026-06-24.dahlia' });
}

export const STRIPE_CONFIGURED = !!(
  process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith(PLACEHOLDER_PREFIX)
);
