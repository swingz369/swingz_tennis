import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Authentication & Authorization', () => {
  test('unauthenticated → redirect to login', async ({ page }) => {
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
    expect(response.status()).not.toBe(307); // Kein Redirect auf Login!
  });

  test('member cannot access admin routes', async ({ page }) => {
    // Als Member einloggen
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', process.env.TEST_MEMBER_EMAIL!);
    await page.fill('[name="password"]', process.env.TEST_MEMBER_PASSWORD!);
    await page.click('[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Admin-Route aufrufen
    await page.goto(`${BASE_URL}/admin`);
    // Muss auf Dashboard redirecten, NICHT 403/500 werfen
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('admin can access admin routes', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', process.env.TEST_ADMIN_EMAIL!);
    await page.fill('[name="password"]', process.env.TEST_ADMIN_PASSWORD!);
    await page.click('[type="submit"]');

    await page.goto(`${BASE_URL}/admin`);
    await expect(page).toHaveURL(/\/admin/);
  });

  test('successful login → redirect to dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', process.env.TEST_MEMBER_EMAIL!);
    await page.fill('[name="password"]', process.env.TEST_MEMBER_PASSWORD!);
    await page.click('[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('logout → redirect to login', async ({ page }) => {
    // Einloggen
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', process.env.TEST_MEMBER_EMAIL!);
    await page.fill('[name="password"]', process.env.TEST_MEMBER_PASSWORD!);
    await page.click('[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Ausloggen (need to find logout button)
    await page.click('[data-testid="logout-button"]');
    await expect(page).toHaveURL(/\/login/);

    // Dashboard nicht mehr erreichbar
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Als Member einloggen vor jedem Test
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', process.env.TEST_MEMBER_EMAIL!);
    await page.fill('[name="password"]', process.env.TEST_MEMBER_PASSWORD!);
    await page.click('[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('booking form validation works', async ({ page }) => {
    // Navigate to booking page
    await page.goto(`${BASE_URL}/dashboard/bookings/new`);

    // Without filling, submit
    await page.click('[type="submit"]');

    // Validation errors visible
    await expect(page.getByText(/Ungültige/i)).toBeVisible();
  });

  test('past booking time shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/bookings/new`);

    // Past date input
    await page.fill('[name="startTime"]', '2020-01-01T10:00');
    await page.fill('[name="endTime"]', '2020-01-01T11:00');
    await page.click('[type="submit"]');

    await expect(page.getByText(/Buchungen können nicht in der Vergangenheit/i)).toBeVisible();
  });
});
