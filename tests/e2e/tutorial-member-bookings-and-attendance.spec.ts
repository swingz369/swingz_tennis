import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { screenshotStep } from './helpers/screenshots';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Tutorial: Member Bookings & Attendance', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
  });

  test('Step 1: /bookings loads with stat row and upcoming list', async ({ page }) => {
    await page.goto(`${BASE_URL}/bookings`, { waitUntil: 'networkidle', timeout: 20_000 });
    await expect(page.locator('body')).toContainText(/buchung|booking/i, { timeout: 10_000 });
    // Default-Tab ist "Platz-Kalender" (app/(protected)/bookings/page.tsx) — es gibt keinen
    // separaten "kommende Buchungen"-Text mehr; stattdessen die Tab-Leiste mit "Meine Buchungen".
    await expect(page.getByText(/meine buchungen/i).first()).toBeVisible();
    await screenshotStep(page, 'member-bookings-and-attendance/step-1-bookings-page');
  });

  test('Step 2: month switcher buttons present', async ({ page }) => {
    await page.goto(`${BASE_URL}/bookings`, { waitUntil: 'networkidle' });
    const monthNav = page
      .locator('body')
      .getByText(/heute|monat/i)
      .first();
    expect(await monthNav.isVisible()).toBe(true);
    await screenshotStep(page, 'member-bookings-and-attendance/step-2-month-switcher');
  });

  test('Step 3: /attendance-history stats + filter tabs + pagination', async ({ page }) => {
    await page.goto(`${BASE_URL}/attendance-history`, {
      waitUntil: 'networkidle',
      timeout: 20_000,
    });

    // 4-Stat-Reihe (Gesamt, Anwesend, Verpasst, Quote)
    await expect(page.getByText(/gesamt/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/anwesend/i).first()).toBeVisible();
    await expect(page.getByText(/verpasst/i).first()).toBeVisible();
    await expect(page.getByText(/quote/i).first()).toBeVisible();

    // Filter tabs
    await expect(page.getByRole('button', { name: /^alle$/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^anwesend$/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^verpasst$/i }).first()).toBeVisible();

    await screenshotStep(page, 'member-bookings-and-attendance/step-3-attendance');
  });
});
