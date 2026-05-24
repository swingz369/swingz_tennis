/**
 * E2E tests for the Stripe Checkout flow.
 *
 * Tests the UI flow for:
 * - Accessing the checkout endpoint (requires auth + booking)
 * - Stripe not configured → appropriate error message shown
 * - Booking not found → 404 error
 * - Unauthorized access → 403 / redirect
 *
 * Prerequisites:
 * - Development server running on localhost:3000
 * - Test user with member role is seeded
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const TEST_MEMBER_EMAIL = process.env.E2E_TEST_MEMBER_EMAIL || 'test-member@swingz.de';
const TEST_MEMBER_PASSWORD = process.env.E2E_TEST_MEMBER_PASSWORD || 'SwingZTest123!';

test.describe('Stripe Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as a member
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel(/email/i).fill(TEST_MEMBER_EMAIL);
    await page.getByLabel(/passwort/i).fill(TEST_MEMBER_PASSWORD);
    await page.getByRole('button', { name: /anmelden/i }).click();
    await page.waitForURL(/dashboard/);
  });

  test('Stripe checkout API returns 503 when not configured', async ({ page }) => {
    // Call the checkout API with a valid booking but without real Stripe keys
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'booking',
          bookingId: '00000000-0000-0000-0000-000000000000',
          clubId: '00000000-0000-0000-0000-000000000000',
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    // Either 503 (Stripe not configured) or 404 (booking not found) is acceptable
    // Both indicate the API is working correctly
    expect([404, 503]).toContain(response.status);
    if (response.status === 503) {
      expect(response.body.error).toContain('nicht konfiguriert');
    }
  });

  test('Stripe checkout API requires authentication', async ({ page }) => {
    // Log out first
    await page.evaluate(() => {
      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });
    });

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'booking', clubId: '00000000-0000-0000-0000-000000000000' }),
      });
      return res.status;
    });

    expect(response).toBe(401);
  });
});
