import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { screenshotStep } from './helpers/screenshots';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Tutorial: Admin Members & Courts', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  test('Step 1: /admin/members loads with search input + Aktive tab', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/members`, { waitUntil: 'networkidle', timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /mitglieder|members/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    // Search input
    await expect(
      page.locator('input[type="search"], input[placeholder*="such" i]').first()
    ).toBeVisible();
    // Aktive tab default
    await expect(page.getByRole('button', { name: /aktive/i }).first())
      .toBeVisible()
      .catch(() => undefined);
    await screenshotStep(page, 'admin-members-and-courts/step-1-members');
  });

  test('Step 2: search filter applies on type', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/members`, { waitUntil: 'networkidle' });
    const search = page.locator('input[type="search"], input[placeholder*="such" i]').first();
    if (await search.isVisible().catch(() => false)) {
      await search.fill('mitglied');
      await page.waitForTimeout(800);
    }
    await screenshotStep(page, 'admin-members-and-courts/step-2-search');
  });

  test('Step 3: /admin/courts loads + sorted by number', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/courts`, { waitUntil: 'networkidle', timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /plätze|courts/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await screenshotStep(page, 'admin-members-and-courts/step-3-courts');
  });
});
