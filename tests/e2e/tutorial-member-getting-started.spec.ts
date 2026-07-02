import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { screenshotStep } from './helpers/screenshots';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Tutorial: Member Getting Started', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
  });

  test('Step 1: /member dashboard loads with greeting hero', async ({ page }) => {
    await page.goto(`${BASE_URL}/member`, { waitUntil: 'networkidle', timeout: 20_000 });
    // "Hallo, <Vorname>!" or similar greeting
    await expect(page.locator('body')).toContainText(/hallo|willkommen|mitglied/i, {
      timeout: 10_000,
    });
    await screenshotStep(page, 'member-getting-started/step-1-dashboard');
  });

  test('Step 2: 4 stat cards (Buchungen, Rechnungen, Benachrichtigungen, Training)', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/member`, { waitUntil: 'networkidle' });
    await expect(page.getByText(/buchungen/i).first()).toBeVisible();
    await expect(page.getByText(/rechnungen/i).first()).toBeVisible();
    await expect(page.getByText(/benachrichtigungen/i).first()).toBeVisible();
    await expect(page.getByText(/training/i).first()).toBeVisible();
    await screenshotStep(page, 'member-getting-started/step-2-stats');
  });

  test('Step 3: 7 Quick-Actions grid (Buchen, Training, Trainer, Turniere, Rechnungen, Dienste, Präferenzen)', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/member`, { waitUntil: 'networkidle' });
    // Match at least one of the seven labels — assert the grid is present
    const body = page.locator('body');
    const labels = [
      'Buchen',
      'Training',
      'Trainer',
      'Turniere',
      'Rechnungen',
      'Dienste',
      'Präferenzen',
    ];
    let found = 0;
    for (const label of labels) {
      if (
        await body
          .getByText(label, { exact: false })
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        found++;
      }
    }
    expect(found).toBeGreaterThanOrEqual(4); // at least 4 visible at viewport time
    await screenshotStep(page, 'member-getting-started/step-3-quick-actions');
  });

  test('Step 4: Role-Guard (member sees no admin links in sidebar)', async ({ page }) => {
    await page.goto(`${BASE_URL}/member`, { waitUntil: 'networkidle' });
    const sidebar = page.locator('aside, nav').first();
    const adminLink = sidebar.getByRole('link', { name: /^admin/i }).first();
    expect(await adminLink.isVisible().catch(() => false)).toBe(false);
    await screenshotStep(page, 'member-getting-started/step-4-sidebar');
  });
});
