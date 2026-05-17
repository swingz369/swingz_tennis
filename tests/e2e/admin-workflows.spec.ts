import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

/**
 * Admin & Superadmin Workflow Tests
 * Uses real API login with swingz_test_mode cookie to bypass rate limiting.
 */

test.describe('Admin Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  test('Admin dashboard loads with sidebar', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();

    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    await expect(sidebar.getByRole('link', { name: /Dashboard/i })).toBeVisible();
    // Check individual sidebar section buttons (avoid regex that matches multiple)
    await expect(sidebar.getByRole('button', { name: /Mitglieder/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Training/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Finanzen/i })).toBeVisible();
  });

  test('Admin members page renders', async ({ page }) => {
    await page.goto('/admin/members', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/mitglied|member/i, { timeout: 8000 });
  });

  test('Admin season planning page loads', async ({ page }) => {
    await page.goto('/admin/seasons', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/saison|season|plan/i, { timeout: 8000 });
  });

  test('Admin settings page renders', async ({ page }) => {
    await page.goto('/admin/settings', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/einstellung|setting/i, { timeout: 8000 });
  });

  test('Admin trainers page renders', async ({ page }) => {
    await page.goto('/admin/trainers', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/trainer/i, { timeout: 8000 });
  });

  test('Admin billing page renders', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/rechnung|billing|abrechnung/i, {
      timeout: 8000,
    });
  });
});

test.describe('Superadmin Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_SUPERADMIN_EMAIL!, process.env.TEST_SUPERADMIN_PASSWORD!);
  });

  test('Superadmin dashboard loads with sidebar', async ({ page }) => {
    await page.goto('/superadmin', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();

    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    await expect(sidebar.getByRole('link', { name: /Vereinsübersicht/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Club-Verwaltung/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Superadmin Dashboard/i })).toBeVisible();
  });

  test('Superadmin tenant management renders', async ({ page }) => {
    await page.goto('/superadmin/tenants', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/mandant|tenant|verein/i, { timeout: 8000 });
  });

  test('Superadmin club management renders', async ({ page }) => {
    await page.goto('/superadmin/clubs', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/club|verein/i, { timeout: 8000 });
  });

  test('Superadmin sections: Vereinsübersicht and Dashboard are separate', async ({ page }) => {
    await page.goto('/superadmin', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();

    const sidebar = page.locator('aside[aria-label="Main navigation"]');

    // Verify Vereinsübersicht link and navigate
    await sidebar.getByRole('link', { name: /Vereinsübersicht/i }).click();
    await expect(page).toHaveURL(/tenants/, { timeout: 8000 });
  });
});

test.describe('Cross-Role Server-Side Access Control', () => {
  test('admin redirected from /superadmin/ (real session)', async ({ page }) => {
    await loginAs(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    await page.goto('/superadmin/dashboard', { waitUntil: 'networkidle' });
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/superadmin/dashboard');
  });

  test('member redirected from /admin/ (real session)', async ({ page }) => {
    await loginAs(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
    await page.goto('/admin/members', { waitUntil: 'networkidle' });
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/admin/members');
  });
});
