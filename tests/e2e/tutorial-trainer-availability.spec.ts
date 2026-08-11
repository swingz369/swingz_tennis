import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { screenshotStep } from './helpers/screenshots';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Tutorial: Trainer Availability', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_TRAINER_EMAIL!, process.env.TEST_TRAINER_PASSWORD!);
  });

  test('Step 1: /trainer/availability loads with Verfügbarkeit heading + Heute button', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/trainer/availability`, {
      waitUntil: 'networkidle',
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: /verfügbarkeit/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: /^heute$/i })).toBeVisible();
    await screenshotStep(page, 'trainer-availability/step-1-page');
  });

  test('Step 2: preset chips (08:00, 09:30, …) are visible for the current week', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/trainer/availability`, { waitUntil: 'networkidle' });
    // At minimum the 08:00 preset should be in the DOM somewhere
    await expect(
      page
        .locator('button')
        .filter({ hasText: /^08:00$/ })
        .first()
    ).toBeVisible({
      timeout: 10_000,
    });
    await screenshotStep(page, 'trainer-availability/step-2-preset-chips');
  });

  // Step 3 (Vor/Zurück-Wochennavigation) entfernt — components/trainer-availability-manager.tsx
  // hat keine Kalender-Wochennavigation mehr (kein "Woche"-Text, kein Chevron/prev-next-Handler);
  // die Komponente arbeitet mit einem festen Wochenraster statt paginierten Wochen.
});
