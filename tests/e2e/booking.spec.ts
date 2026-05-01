import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@swingz.com');
    await page.getByLabel('Passwort').fill('demo123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create a new booking', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');

    // Click "Neue Buchung" button
    await page.getByRole('button', { name: 'Neue Buchung' }).click();

    // Select session (first available)
    const sessionOptions = page.locator('.session-card').first();
    await sessionOptions.click();

    // Confirm booking
    await page.getByRole('button', { name: 'Buchen' }).click();

    // Check success toast
    await expect(page.getByText('Buchung erfolgreich')).toBeVisible({ timeout: 5000 });
  });

  test('should cancel a booking', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');

    // Open menu for first booking
    const menuButton = page.locator('[data-testid="booking-menu"]').first();
    await menuButton.click();

    // Click cancel
    await page.getByRole('menuitem', { name: 'Stornieren' }).click();

    // Confirm cancellation
    await page.getByRole('button', { name: 'Ja, stornieren' }).click();

    // Check success toast
    await expect(page.getByText('Buchung storniert')).toBeVisible({ timeout: 5000 });
  });
});
