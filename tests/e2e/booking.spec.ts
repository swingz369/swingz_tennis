import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@swingz.com');
    await page.getByLabel('Passwort').fill('demo123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/dashboard');
    await page.goto('/bookings');
  });

  test('should create a new booking', async ({ page }) => {
    // Wait for sessions to be visible
    await expect(page.locator('div.cursor-pointer').first()).toBeVisible({ timeout: 10000 });

    // Click first available session to book
    await page.locator('div.cursor-pointer').first().click();

    // Check success toast
    await expect(page.getByText('Buchung erfolgreich')).toBeVisible({ timeout: 5000 });
  });

  test('should cancel a booking', async ({ page }) => {
    // Wait for sessions and create a booking first
    await expect(page.locator('div.cursor-pointer').first()).toBeVisible({ timeout: 10000 });
    await page.locator('div.cursor-pointer').first().click();
    await expect(page.getByText('Buchung erfolgreich')).toBeVisible({ timeout: 5000 });

    // Click cancel button on the booked session (title="Buchung stornieren")
    await page.getByTitle('Buchung stornieren').first().click();

    // Check cancellation toast
    await expect(page.getByText('Buchung storniert')).toBeVisible({ timeout: 5000 });
  });
});
