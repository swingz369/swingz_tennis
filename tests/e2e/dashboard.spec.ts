import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@swingz.com');
    await page.getByLabel('Passwort').fill('demo123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await page.waitForURL('/dashboard');
  });

  test('should display dashboard KPIs', async ({ page }) => {
    await expect(page.getByText(/dashboard/i)).toBeVisible();
    await expect(page.locator('[data-testid="kpi-cards"]')).toBeVisible();
  });

  test('should display recent bookings', async ({ page }) => {
    await expect(page.getByText(/recent bookings/i)).toBeVisible();
    await expect(page.locator('[data-testid="recent-bookings"]')).toBeVisible();
  });

  test('should display upcoming sessions', async ({ page }) => {
    await expect(page.getByText(/upcoming sessions/i)).toBeVisible();
    await expect(page.locator('[data-testid="upcoming-sessions"]')).toBeVisible();
  });

  test('should navigate to bookings page', async ({ page }) => {
    await page.getByRole('link', { name: /bookings/i }).click();
    await expect(page).toHaveURL(/\/bookings/);
  });

  test('should navigate to scheduler page', async ({ page }) => {
    await page.getByRole('link', { name: /scheduler/i }).click();
    await expect(page).toHaveURL(/\/scheduler/);
  });
});
