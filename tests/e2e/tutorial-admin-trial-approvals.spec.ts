import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { screenshotStep } from './helpers/screenshots';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Tutorial: Admin Trial Approvals', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  // /admin/approvals wurde in einen Tab der Mitgliederseite verschoben
  // (components/admin-approvals.tsx, gerendert unter /admin/members?tab=approvals).
  test('Step 1: /admin/approvals loads with filter pills', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/approvals`, {
      waitUntil: 'networkidle',
      timeout: 20_000,
    });
    await expect(
      page.getByRole('heading', { name: /probetraining|genehmigung|approval/i }).first()
    ).toBeVisible({
      timeout: 10_000,
    });

    // Filter pills (Ausstehend | Genehmigt | Abgelehnt | Alle) — text matches
    await expect(page.getByRole('button', { name: /ausstehend/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /genehmigt/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /abgelehnt/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^alle$/i }).first()).toBeVisible();

    await screenshotStep(page, 'admin-trial-approvals/step-1-filtered');
  });

  test('Step 2: at least one trial card or empty-state visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/approvals`, { waitUntil: 'networkidle' });
    const card = await page
      .getByText(/ausstehend|genehmigt|abgelehnt/i)
      .first()
      .isVisible()
      .catch(() => false);
    const empty = await page
      .getByText(/keine anträge/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(card || empty).toBe(true);
    await screenshotStep(page, 'admin-trial-approvals/step-2-list');
  });
});
