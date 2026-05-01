import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/swingz/i);
  });

  test('should login with demo credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@swingz.com');
    await page.getByLabel('Passwort').fill('demo123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should logout', async ({ page }) => {
    // Login first to get authenticated state
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@swingz.com');
    await page.getByLabel('Passwort').fill('demo123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/dashboard');

    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page).toHaveURL('/login');
  });
});
