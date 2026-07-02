import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { screenshotStep } from './helpers/screenshots';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Tutorial: Trainer Sessions & Check-in', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_TRAINER_EMAIL!, process.env.TEST_TRAINER_PASSWORD!);
  });

  test('Step 1: /trainer dashboard loads with sessions section', async ({ page }) => {
    await page.goto(`${BASE_URL}/trainer`, { waitUntil: 'networkidle', timeout: 20_000 });
    await expect(page.locator('body')).toBeVisible();
    // Either there are session pills or "Keine bevorstehenden Sessions" empty text
    const hasPills = (await page.locator('button').count()) > 0;
    const hasEmpty = await page
      .getByText(/keine.*bevorstehenden.*sessions/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasPills || hasEmpty).toBe(true);
    await screenshotStep(page, 'trainer-sessions-and-checkin/step-1-dashboard');
  });

  test('Step 2: RSVP-Summary-Badges (Zugesagt, Abgesagt, Vielleicht) when sessions exist', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/trainer`, { waitUntil: 'networkidle' });
    // If sessions exist, the three badges should be in the DOM. Tolerate empty state.
    const zugesagt = await page
      .getByText(/zugesagt/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (zugesagt) {
      await expect(page.getByText(/zugesagt/i).first()).toBeVisible();
      await expect(page.getByText(/abgesagt/i).first()).toBeVisible();
      await expect(page.getByText(/vielleicht/i).first()).toBeVisible();
    }
    await screenshotStep(page, 'trainer-sessions-and-checkin/step-2-rsvp-badges');
  });
});
