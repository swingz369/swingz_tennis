import { test, expect } from '@playwright/test';

test.describe('Enhanced Authentication', () => {
  test('should login with demo credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@swingz.com');
    await page.getByLabel('Passwort').fill('demo123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('should display error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('invalid@example.com');
    await page.getByLabel('Passwort').fill('wrongpassword');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });

  test('should logout and redirect to login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@swingz.com');
    await page.getByLabel('Passwort').fill('demo123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/dashboard');

    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page).toHaveURL('/login');
  });

  test('should maintain auth state across page reloads', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@swingz.com');
    await page.getByLabel('Passwort').fill('demo123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/dashboard');

    await page.reload();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should clear auth state on logout', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@swingz.com');
    await page.getByLabel('Passwort').fill('demo123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/dashboard');

    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page).toHaveURL('/login');

    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
});
