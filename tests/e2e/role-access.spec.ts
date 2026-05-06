import { test, expect } from '@playwright/test';

test.describe('Role-based Access Control', () => {
  test.describe('Superadmin Navigation and Access', () => {
    test('superadmin sees correct navigation items', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['superadmin'] }),
        });
      });

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            user: { id: 'test-superadmin', email: 'superadmin@test.com' },
            roles: ['superadmin'],
          }),
        });
      });

      await page.goto('/superadmin/dashboard');

      // Superadmin should see platform-wide navigation
      await expect(page.getByRole('link', { name: /Superadmin Dashboard/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Vereinsübersicht/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Club-Verwaltung/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Plattform-Analyse/i })).toBeVisible();

      // Should see "Plattform" heading
      await expect(page.getByText('PLATTFORM')).toBeVisible();
    });

    test('superadmin does NOT see club-scoped admin navigation', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['superadmin'] }),
        });
      });

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            user: { id: 'test-superadmin', email: 'superadmin@test.com' },
            roles: ['superadmin'],
          }),
        });
      });

      await page.goto('/superadmin/dashboard');

      // Superadmin should NOT see club-specific items
      await expect(page.getByRole('link', { name: /^Saisonplanung$/i })).not.toBeVisible();
      await expect(page.getByRole('link', { name: /^Benutzerverwaltung$/i })).not.toBeVisible();
      await expect(page.getByRole('link', { name: /^Genehmigungen$/i })).not.toBeVisible();

      // Should NOT see "Administration" heading
      await expect(page.getByText('ADMINISTRATION')).not.toBeVisible();
    });

    test('superadmin can access /superadmin/* routes', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['superadmin'] }),
        });
      });

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            user: { id: 'test-superadmin', email: 'superadmin@test.com' },
            roles: ['superadmin'],
          }),
        });
      });

      // Test access to superadmin routes
      await page.goto('/superadmin/dashboard');
      expect(page.url()).toContain('/superadmin/dashboard');

      await page.goto('/superadmin/tenants');
      expect(page.url()).toContain('/superadmin/tenants');

      await page.goto('/superadmin/clubs');
      expect(page.url()).toContain('/superadmin/clubs');
    });
  });

  test.describe('Admin Navigation and Access', () => {
    test('admin sees correct navigation items', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['admin'] }),
        });
      });

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            user: { id: 'test-admin', email: 'admin@test.com' },
            roles: ['admin'],
          }),
        });
      });

      await page.goto('/dashboard');

      // Admin should see club-scoped navigation
      await expect(page.getByRole('link', { name: /^Dashboard$/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Saisonplanung/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Benutzerverwaltung/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Genehmigungen/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Stundennachweise/i })).toBeVisible();

      // Should see "Administration" heading
      await expect(page.getByText('ADMINISTRATION')).toBeVisible();
    });

    test('admin does NOT see superadmin navigation', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['admin'] }),
        });
      });

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            user: { id: 'test-admin', email: 'admin@test.com' },
            roles: ['admin'],
          }),
        });
      });

      await page.goto('/dashboard');

      // Admin should NOT see superadmin items
      await expect(page.getByRole('link', { name: /Superadmin Dashboard/i })).not.toBeVisible();
      await expect(page.getByRole('link', { name: /Vereinsübersicht/i })).not.toBeVisible();
      await expect(page.getByRole('link', { name: /^Club-Verwaltung$/i })).not.toBeVisible();
      await expect(page.getByRole('link', { name: /Plattform-Analyse/i })).not.toBeVisible();

      // Should NOT see "Plattform" heading
      await expect(page.getByText('PLATTFORM')).not.toBeVisible();
    });

    test('admin CANNOT access /superadmin/* routes', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['admin'] }),
        });
      });

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            user: { id: 'test-admin', email: 'admin@test.com' },
            roles: ['admin'],
          }),
        });
      });

      // Attempt to access superadmin route - should be blocked/redirected
      await page.goto('/superadmin/dashboard');

      // Should be redirected away or see 403/unauthorized
      expect(page.url()).not.toContain('/superadmin/dashboard');
    });

    test('admin can access /admin/* routes', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['admin'] }),
        });
      });

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            user: { id: 'test-admin', email: 'admin@test.com' },
            roles: ['admin'],
          }),
        });
      });

      // Test access to admin routes
      await page.goto('/admin/members');
      expect(page.url()).toContain('/admin/members');

      await page.goto('/admin/seasons');
      expect(page.url()).toContain('/admin/seasons');
    });
  });

  test.describe('Trainer Navigation', () => {
    test('trainer sees correct navigation items', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['trainer'] }),
        });
      });

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            user: { id: 'test-trainer', email: 'trainer@test.com' },
            roles: ['trainer'],
          }),
        });
      });

      await page.goto('/dashboard');

      // Trainer should see trainer-specific navigation
      await expect(page.getByRole('link', { name: /Trainer Dashboard/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Termin-Verwaltung/i })).toBeVisible();

      // Should see "Trainer" heading
      await expect(page.getByText('TRAINER')).toBeVisible();
    });

    test('trainer CANNOT access admin or superadmin routes', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['trainer'] }),
        });
      });

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            user: { id: 'test-trainer', email: 'trainer@test.com' },
            roles: ['trainer'],
          }),
        });
      });

      // Attempt to access admin route
      await page.goto('/admin/members');
      expect(page.url()).not.toContain('/admin/members');

      // Attempt to access superadmin route
      await page.goto('/superadmin/dashboard');
      expect(page.url()).not.toContain('/superadmin/dashboard');
    });
  });

  test.describe('Member Navigation', () => {
    test('member sees correct navigation items', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['member'] }),
        });
      });

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            user: { id: 'test-member', email: 'member@test.com' },
            roles: ['member'],
          }),
        });
      });

      await page.goto('/dashboard');

      // Member should see basic navigation
      await expect(page.getByRole('link', { name: /^Dashboard$/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Buchungen & Kalender/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Trainingszeiten/i })).toBeVisible();

      // Should see "Hauptmenü" heading
      await expect(page.getByText('HAUPTMENÜ')).toBeVisible();
    });

    test('member CANNOT access admin or superadmin routes', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ roles: ['member'] }),
        });
      });

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            user: { id: 'test-member', email: 'member@test.com' },
            roles: ['member'],
          }),
        });
      });

      // Attempt to access admin route
      await page.goto('/admin/members');
      expect(page.url()).not.toContain('/admin/members');

      // Attempt to access superadmin route
      await page.goto('/superadmin/dashboard');
      expect(page.url()).not.toContain('/superadmin/dashboard');
    });
  });
});
