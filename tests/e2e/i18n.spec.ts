import { test, expect } from '@playwright/test';

test.describe('Internationalization', () => {
  test('should display German text by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/swingz/i)).toBeVisible();
  });

  test('should switch to English locale', async ({ page }) => {
    await page.goto('/de');
    await expect(page.getByText(/anmelden/i)).toBeVisible();

    await page.goto('/en');
    await expect(page.getByText(/login/i)).toBeVisible();
  });

  test('should maintain locale across navigation', async ({ page }) => {
    await page.goto('/de/login');
    await expect(page.getByText(/anmelden/i)).toBeVisible();

    await page.goto('/de/dashboard');
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should display English translations', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page.getByText(/email/i)).toBeVisible();
    await expect(page.getByText(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('should display German translations', async ({ page }) => {
    await page.goto('/de/login');
    await expect(page.getByText(/e-mail/i)).toBeVisible();
    await expect(page.getByText(/passwort/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /anmelden/i })).toBeVisible();
  });
});
