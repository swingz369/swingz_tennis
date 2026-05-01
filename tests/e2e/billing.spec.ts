import { test, expect } from '@playwright/test';

test.describe('Billing & Pricing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@swingz.com');
    await page.getByLabel('Passwort').fill('demo123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display pricing page', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Einfach. Fair. Transparent.')).toBeVisible();
    await expect(page.getByText('Free')).toBeVisible();
    await expect(page.getByText('Pro')).toBeVisible();
    await expect(page.getByText('Enterprise')).toBeVisible();
  });

  test('should show plan details', async ({ page }) => {
    await page.goto('/billing');

    // Check Pro plan features
    await expect(page.getByText('KI-optimierte Stundenplanung')).toBeVisible();
    await expect(page.getByText('Wartelisten-Management')).toBeVisible();
  });

  test('should have clickable checkout button', async ({ page }) => {
    await page.goto('/billing');

    // Pro plan button should be enabled
    const proButton = page.getByRole('button', { name: 'Jetzt upgraden' }).first();
    await expect(proButton).toBeEnabled();
  });

  test('should display FAQ section', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.getByText('Häufige Fragen')).toBeVisible();
    await expect(page.getByText('Kann ich jederzeit wechseln oder kündigen?')).toBeVisible();
  });
});
