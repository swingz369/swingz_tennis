import { test, expect } from '@playwright/test';
import { loginAsRoleAware } from '../helpers/auth';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Authentication & Authorization', () => {
  test('unauthenticated redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page loads without redirect loop', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /anmelden/i })).toBeVisible();
  });

  test('static assets accessible without auth', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/favicon.ico`);
    expect(response.status()).not.toBe(307);
  });

  test('member cannot access admin routes', async ({ page }) => {
    // Use loginAsRoleAware — middleware role checks must be active
    await loginAsRoleAware(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    await page.waitForURL((url) => !url.pathname.includes('/admin'), { timeout: 15000 });
    expect(page.url()).not.toContain('/admin');
  });
});

test.describe('Member Route Access', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
  });

  test('member can access unified bookings page', async ({ page }) => {
    await page.goto(`${BASE_URL}/bookings`, { waitUntil: 'networkidle', timeout: 15000 });
    await expect(page.locator('body')).toBeVisible();
    // The unified bookings page has heading "Buchungen & Kalender"
    await expect(page.getByRole('heading', { name: /Buchungen.*Kalender/i })).toBeVisible({
      timeout: 8000,
    });
  });

  test('member can access dashboard routes (no admin guard)', async ({ page }) => {
    // /dashboard/* is under protected layout (not admin layout)
    // Any authenticated user can access it — only /admin/* is role-guarded
    await page.goto(`${BASE_URL}/dashboard/bookings/new`, {
      waitUntil: 'networkidle',
      timeout: 15000,
    });
    const currentUrl = page.url();
    expect(currentUrl).toContain('/dashboard/bookings/new');
    await expect(page.locator('body')).toBeVisible();
  });

  test('member redirected from /admin routes', async ({ page }) => {
    // /admin/* IS guarded by admin layout — member should be redirected
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForURL((url) => !url.pathname.includes('/admin'), { timeout: 15000 });
    expect(page.url()).not.toContain('/admin');
  });
});
