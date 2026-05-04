import { test, expect } from '@playwright/test';

test.describe('Role-based Access Control', () => {
  test.describe('Dashboard routing by role', () => {
    test('superadmin redirects to /admin/dashboard', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['superadmin'] }),
        });
      });

      await page.goto('/dashboard');
      await page.waitForURL(/\/admin\/dashboard/);
      expect(page.url()).toContain('/admin/dashboard');
    });

    test('admin redirects to /admin/analytics', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['admin'] }),
        });
      });

      await page.goto('/dashboard');
      await page.waitForURL(/\/admin\/analytics/);
      expect(page.url()).toContain('/admin/analytics');
    });

    test('trainer redirects to /trainer', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['trainer'] }),
        });
      });

      await page.goto('/dashboard');
      await page.waitForURL(/\/trainer/);
      expect(page.url()).toContain('/trainer');
    });

    test('member redirects to /bookings', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['member'] }),
        });
      });

      await page.goto('/dashboard');
      await page.waitForURL(/\/bookings/);
      expect(page.url()).toContain('/bookings');
    });
  });

  test.describe('Superadmin-only routes', () => {
    test('POST /api/clubs requires superadmin', async ({ request }) => {
      const response = await request.post('/api/clubs', {
        headers: {
          Authorization: 'Bearer admin-token',
        },
        data: {
          name: 'Test Club',
          maxMembers: 100,
        },
      });

      expect([401, 403]).toContain(response.status());
    });

    test('POST /api/billing/trainers/trainer-1/pay requires superadmin', async ({ request }) => {
      const response = await request.post('/api/billing/trainers/trainer-1/pay', {
        headers: {
          Authorization: 'Bearer admin-token',
        },
      });

      expect([401, 403]).toContain(response.status());
    });

    test('POST /api/billing/sepa/pain008 requires superadmin', async ({ request }) => {
      const response = await request.post('/api/billing/sepa/pain008', {
        headers: {
          Authorization: 'Bearer admin-token',
        },
        data: {
          paymentIds: ['payment-1'],
        },
      });

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Sidebar visibility by role', () => {
    test('superadmin sees Clubs in sidebar', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['superadmin'] }),
        });
      });

      await page.goto('/admin/dashboard');
      await expect(page.getByRole('link', { name: /Clubs/i })).toBeVisible();
    });

    test('admin does NOT see Clubs in sidebar', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['admin'] }),
        });
      });

      await page.goto('/admin/analytics');
      await expect(page.getByRole('link', { name: /Clubs/i })).not.toBeVisible();
    });

    test('superadmin sees Billing Admin in sidebar', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['superadmin'] }),
        });
      });

      await page.goto('/admin/dashboard');
      await expect(page.getByRole('link', { name: /Billing Admin/i })).toBeVisible();
    });

    test('admin does NOT see Billing Admin in sidebar', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['admin'] }),
        });
      });

      await page.goto('/admin/analytics');
      await expect(page.getByRole('link', { name: /Billing Admin/i })).not.toBeVisible();
    });
  });
});
