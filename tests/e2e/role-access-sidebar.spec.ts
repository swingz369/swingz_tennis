import { test, expect } from '@playwright/test';

/**
 * Sidebar Navigation Tests - Role-based Access Control
 *
 * These tests verify that the sidebar shows the correct navigation items
 * based on the user's role. We test the VISIBILITY of nav items only,
 * not actual route access (which requires full auth setup).
 */

test.describe('Sidebar Navigation by Role', () => {
  test.beforeEach(async ({ page }) => {
    // Mock successful auth to avoid login redirects
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-user', email: 'test@example.com' },
        }),
      });
    });
  });

  test.describe('Superadmin Sidebar', () => {
    test('shows platform-wide navigation only', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ roles: ['superadmin'] }),
        });
      });

      // Navigate to any protected page to render the sidebar
      await page.goto('/dashboard');

      // Wait for sidebar to render
      await page.waitForSelector('aside[role="navigation"]');

      // Superadmin SHOULD see these items
      await expect(page.locator('text=Superadmin Dashboard')).toBeVisible();
      await expect(page.locator('text=Vereinsübersicht')).toBeVisible();
      await expect(page.locator('text=Club-Verwaltung')).toBeVisible();
      await expect(page.locator('text=Plattform-Analyse')).toBeVisible();

      // Should see "PLATTFORM" section heading
      await expect(page.locator('text=PLATTFORM')).toBeVisible();

      // Superadmin should NOT see club-scoped admin items
      await expect(page.locator('text=Saisonplanung')).not.toBeVisible();
      await expect(page.locator('text=Benutzerverwaltung')).not.toBeVisible();
      await expect(page.locator('text=Genehmigungen')).not.toBeVisible();
      await expect(page.locator('text=ADMINISTRATION')).not.toBeVisible();
    });

    test('shows system settings section', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ roles: ['superadmin'] }),
        });
      });

      await page.goto('/dashboard');
      await page.waitForSelector('aside[role="navigation"]');

      // Should see system section heading
      await expect(page.locator('text=SYSTEM')).toBeVisible();

      // Should see Plattform-Verwaltung category
      await expect(page.locator('text=Plattform-Verwaltung')).toBeVisible();
    });
  });

  test.describe('Admin Sidebar', () => {
    test('shows club-scoped navigation only', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ roles: ['admin'] }),
        });
      });

      await page.goto('/dashboard');
      await page.waitForSelector('aside[role="navigation"]');

      // Admin SHOULD see these items
      await expect(page.locator('a[href="/dashboard"]').first()).toBeVisible();
      await expect(page.locator('text=Saisonplanung')).toBeVisible();
      await expect(page.locator('text=Benutzerverwaltung')).toBeVisible();
      await expect(page.locator('text=Genehmigungen')).toBeVisible();
      await expect(page.locator('text=Stundennachweise')).toBeVisible();

      // Should see "ADMINISTRATION" section heading
      await expect(page.locator('text=ADMINISTRATION')).toBeVisible();

      // Admin should NOT see superadmin items
      await expect(page.locator('text=Superadmin Dashboard')).not.toBeVisible();
      await expect(page.locator('text=Vereinsübersicht')).not.toBeVisible();
      await expect(page.locator('text=Plattform-Analyse')).not.toBeVisible();
      await expect(page.locator('text=PLATTFORM')).not.toBeVisible();
    });

    test('shows club management section', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ roles: ['admin'] }),
        });
      });

      await page.goto('/dashboard');
      await page.waitForSelector('aside[role="navigation"]');

      // Should see Verwaltung section
      await expect(page.locator('text=VERWALTUNG')).toBeVisible();

      // Should see Club-Verwaltung category (note: this is different from superadmin's "Club-Verwaltung" link)
      // Admin has it as a category with sub-items, superadmin has it as a direct link
      const clubManagementCategory = page.locator('button:has-text("Club-Verwaltung")');
      await expect(clubManagementCategory).toBeVisible();
    });
  });

  test.describe('Trainer Sidebar', () => {
    test('shows trainer navigation only', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ roles: ['trainer'] }),
        });
      });

      await page.goto('/dashboard');
      await page.waitForSelector('aside[role="navigation"]');

      // Trainer SHOULD see these items
      await expect(page.locator('text=Trainer Dashboard')).toBeVisible();
      await expect(page.locator('text=Termin-Verwaltung')).toBeVisible();
      await expect(page.locator('text=Meine Anwesenheit')).toBeVisible();

      // Should see "TRAINER" section heading
      await expect(page.locator('text=TRAINER')).toBeVisible();

      // Trainer should NOT see admin or superadmin items
      await expect(page.locator('text=Saisonplanung')).not.toBeVisible();
      await expect(page.locator('text=Superadmin Dashboard')).not.toBeVisible();
      await expect(page.locator('text=ADMINISTRATION')).not.toBeVisible();
      await expect(page.locator('text=PLATTFORM')).not.toBeVisible();
    });
  });

  test.describe('Member Sidebar', () => {
    test('shows member navigation only', async ({ page }) => {
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ roles: ['member'] }),
        });
      });

      await page.goto('/dashboard');
      await page.waitForSelector('aside[role="navigation"]');

      // Member SHOULD see these items
      await expect(page.locator('a[href="/dashboard"]').first()).toBeVisible();
      await expect(page.locator('text=Buchungen & Kalender')).toBeVisible();
      await expect(page.locator('text=Trainingszeiten')).toBeVisible();
      await expect(page.locator('text=Meine Anwesenheit')).toBeVisible();

      // Should see "HAUPTMENÜ" section heading
      await expect(page.locator('text=HAUPTMENÜ')).toBeVisible();

      // Member should NOT see admin, trainer, or superadmin items
      await expect(page.locator('text=Saisonplanung')).not.toBeVisible();
      await expect(page.locator('text=Trainer Dashboard')).not.toBeVisible();
      await expect(page.locator('text=Superadmin Dashboard')).not.toBeVisible();
      await expect(page.locator('text=ADMINISTRATION')).not.toBeVisible();
      await expect(page.locator('text=TRAINER')).not.toBeVisible();
      await expect(page.locator('text=PLATTFORM')).not.toBeVisible();
    });
  });

  test.describe('Role Separation Verification', () => {
    test('admin and superadmin have completely separate navigation', async ({ page }) => {
      // Test 1: Superadmin view
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ roles: ['superadmin'] }),
        });
      });

      await page.goto('/dashboard');
      await page.waitForSelector('aside[role="navigation"]');

      const superadminHasPlattform = await page.locator('text=PLATTFORM').isVisible();
      const superadminHasAdmin = await page.locator('text=ADMINISTRATION').isVisible();

      expect(superadminHasPlattform).toBe(true);
      expect(superadminHasAdmin).toBe(false);

      // Test 2: Admin view (need to reload page with new mock)
      await page.route('**/api/user/roles', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ roles: ['admin'] }),
        });
      });

      await page.goto('/dashboard', { waitUntil: 'networkidle' });
      await page.waitForSelector('aside[role="navigation"]');

      const adminHasPlattform = await page.locator('text=PLATTFORM').isVisible();
      const adminHasAdmin = await page.locator('text=ADMINISTRATION').isVisible();

      expect(adminHasPlattform).toBe(false);
      expect(adminHasAdmin).toBe(true);
    });
  });
});
