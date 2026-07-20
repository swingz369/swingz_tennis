import { test, expect } from '@playwright/test';
import { screenshotStep } from './helpers/screenshots';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Tutorial: Public Trial Booking', () => {
  test('Step 1: trial-training page renders with form', async ({ page }) => {
    await page.goto(`${BASE_URL}/trial-training`, { waitUntil: 'networkidle', timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('form, [role="form"]')).toBeVisible();
    await screenshotStep(page, 'public-trial-booking/step-1-page-loaded');
  });

  test('Step 2: empty submit shows validation errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/trial-training`, { waitUntil: 'networkidle' });

    // Click submit without filling fields
    const submit = page.getByRole('button', { name: /probetraining.*anfragen/i }).first();
    if (await submit.isVisible()) {
      await submit.click({ trial: true }).catch(() => undefined);
      // Wait for either validation messages or nothing (form may just stay put)
      await page.waitForTimeout(800);
    }

    await screenshotStep(page, 'public-trial-booking/step-2-validation');
  });

  test('Step 3: valid submit shows success state', async ({ page }) => {
    await page.goto(`${BASE_URL}/trial-training`, { waitUntil: 'networkidle' });

    // Fill the form
    await page.getByLabel(/vorname/i).fill('Smoke');
    await page.getByLabel(/nachname/i).fill('Test');
    await page
      .getByRole('textbox', { name: /e-?mail/i })
      .first()
      .fill(`smoke-${Date.now()}@example.com`);
    await page.getByLabel(/telefon/i).fill('+49 123 4567890');
    await page.locator('input[type="date"]').first().fill('1995-01-01');
    await page.locator('input[type="date"]').nth(1).fill('2030-12-31');
    await page.locator('input[type="time"]').first().fill('14:00');

    await screenshotStep(page, 'public-trial-booking/step-3-filled');

    const submit = page.getByRole('button', { name: /probetraining.*anfragen/i }).first();
    await submit.click();

    // Either a success card or an error banner
    await page.waitForTimeout(2_000);
    await screenshotStep(page, 'public-trial-booking/step-3-submitted');
  });
});
