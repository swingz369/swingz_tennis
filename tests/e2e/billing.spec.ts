import { test } from '@playwright/test';

// Billing & Pricing tests are temporarily disabled
// The public pricing page was removed in MVP simplification (Stripe integration deferred)
// Admin billing page is separate and requires superadmin role
test.describe.skip('Billing & Pricing', () => {
  test('pricing page skipped', () => {});
});
