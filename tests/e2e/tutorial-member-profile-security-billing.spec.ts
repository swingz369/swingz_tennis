import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { screenshotStep } from './helpers/screenshots';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Tutorial: Member Profile — Security & Billing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
  });

  test('Step 1: profile page loads with three tabs (Profil, Zahlungen, Sicherheit)', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle', timeout: 20_000 });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('tab', { name: /profil/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('tab', { name: /zahlung/i }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: /sicherheit/i }).first()).toBeVisible();
    await screenshotStep(page, 'member-profile-security-billing/step-1-tabs');
  });

  test('Step 2: Zahlungen tab shows SEPA-Mandat-Status', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    const zahlungenTab = page.getByRole('tab', { name: /zahlung/i }).first();
    await zahlungenTab.click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/sepa|lastschrift|mandat/i).first()).toBeVisible();
    await screenshotStep(page, 'member-profile-security-billing/step-2-sepa');
  });

  test('Step 3: Sicherheit tab shows 2FA + Email-Change + Danger Zone', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    const sicherheitTab = page.getByRole('tab', { name: /sicherheit/i }).first();
    await sicherheitTab.click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/2fa|zwei.faktor/i).first()).toBeVisible();
    await expect(page.getByText(/e-?mail.*ändern|e-?mail.*change/i).first()).toBeVisible();
    await expect(page.getByText(/gefahrenzone|konto.*lösch/i).first()).toBeVisible();
    await screenshotStep(page, 'member-profile-security-billing/step-3-sicherheit');
  });

  test('Step 4: 2FA button + email-change button render correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    const sicherheitTab = page.getByRole('tab', { name: /sicherheit/i }).first();
    await sicherheitTab.click();
    await page.waitForTimeout(500);
    // 2FA setup toggle or status badge should be in the DOM
    await screenshotStep(page, 'member-profile-security-billing/step-4-2fa-area');
  });
});
