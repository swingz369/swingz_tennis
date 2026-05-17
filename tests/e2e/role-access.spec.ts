import { test, expect } from '@playwright/test';
import { loginAsRoleAware } from '../helpers/auth';

test.describe('Role-based Access Control', () => {
  test.describe('Superadmin Navigation and Access', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRoleAware(
        page,
        process.env.TEST_SUPERADMIN_EMAIL!,
        process.env.TEST_SUPERADMIN_PASSWORD!
      );
    });

    test('superadmin sees correct navigation items in sidebar', async ({ page }) => {
      await page.goto('/superadmin', { waitUntil: 'networkidle' });
      const sidebar = page.locator('aside[role="navigation"]');
      await expect(sidebar).toBeVisible({ timeout: 10000 });
      // Sidebar links
      await expect(sidebar.getByRole('link', { name: /Superadmin Dashboard/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Vereinsübersicht/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Club-Verwaltung/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Plattform-Analyse/i })).toBeVisible();
      // Section labels (use heading to avoid ambiguous matches with link names)
      await expect(sidebar.getByRole('heading', { name: /Plattform/i })).toBeVisible();
      await expect(sidebar.getByRole('heading', { name: /Verwaltung/i })).toBeVisible();
    });

    test('superadmin can access /superadmin/ routes', async ({ page }) => {
      await page.goto('/superadmin', { waitUntil: 'networkidle' });
      expect(page.url()).toContain('/superadmin');
      await page.goto('/superadmin/tenants', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/superadmin\/tenants/);
    });
  });

  test.describe('Admin Navigation and Access', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRoleAware(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    });

    test('admin sees correct sidebar structure', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'networkidle' });
      const sidebar = page.locator('aside[role="navigation"]');
      await expect(sidebar).toBeVisible({ timeout: 10000 });
      // Direct overview link
      await expect(sidebar.getByRole('link', { name: /Dashboard/i })).toBeVisible();
      // Section header buttons (collapsible sections)
      await expect(sidebar.getByRole('button', { name: /Mitglieder/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Training/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Plätze & Buchungen/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Finanzen/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Einstellungen/i })).toBeVisible();
      // Übersicht section heading
      await expect(sidebar.getByRole('heading', { name: /Übersicht/i })).toBeVisible();
      // Superadmin items should NOT be visible in admin sidebar
      await expect(sidebar.getByText('Superadmin Dashboard')).not.toBeVisible();
      await expect(sidebar.getByText('Plattform')).not.toBeVisible();
    });

    test('admin CANNOT access /superadmin/ routes', async ({ page }) => {
      await page.goto('/superadmin/dashboard', { waitUntil: 'networkidle' });
      await page.waitForURL((url) => !url.pathname.includes('/superadmin/dashboard'), {
        timeout: 15000,
      });
      expect(page.url()).not.toContain('/superadmin/dashboard');
    });

    test('admin can access /admin/ routes', async ({ page }) => {
      await page.goto('/admin/members', { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/admin\/members/);
    });
  });

  test.describe('Trainer Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRoleAware(
        page,
        process.env.TEST_TRAINER_EMAIL!,
        process.env.TEST_TRAINER_PASSWORD!
      );
    });

    test('trainer sees correct bottom nav items', async ({ page }) => {
      await page.goto('/trainer', { waitUntil: 'networkidle' });
      // Trainer has NO sidebar — uses bottom nav (persistent)
      const bottomNav = page.locator('nav[aria-label="Navigation"]');
      await expect(bottomNav).toBeVisible({ timeout: 10000 });
      await expect(bottomNav.getByRole('link', { name: /Übersicht/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Einheiten/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Anwesenheit/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Abrechnung/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Profil/i })).toBeVisible();
    });

    test('trainer CANNOT access admin or superadmin routes', async ({ page }) => {
      await page.goto('/admin/members', { waitUntil: 'networkidle' });
      await page.waitForURL((url) => !url.pathname.includes('/admin/members'), { timeout: 15000 });
      expect(page.url()).not.toContain('/admin/members');

      await page.goto('/superadmin/dashboard', { waitUntil: 'networkidle' });
      await page.waitForURL((url) => !url.pathname.includes('/superadmin/dashboard'), {
        timeout: 15000,
      });
      expect(page.url()).not.toContain('/superadmin/dashboard');
    });
  });

  test.describe('Member Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRoleAware(
        page,
        process.env.TEST_MEMBER_EMAIL!,
        process.env.TEST_MEMBER_PASSWORD!
      );
    });

    test('member sees correct bottom nav items', async ({ page }) => {
      await page.goto('/member', { waitUntil: 'networkidle' });
      // Member has NO sidebar — uses bottom nav (persistent)
      const bottomNav = page.locator('nav[aria-label="Navigation"]');
      await expect(bottomNav).toBeVisible({ timeout: 10000 });
      await expect(bottomNav.getByRole('link', { name: /Home/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Buchen/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Training/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /News/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Profil/i })).toBeVisible();
    });

    test('member CANNOT access admin or superadmin routes', async ({ page }) => {
      await page.goto('/admin/members', { waitUntil: 'networkidle' });
      await page.waitForURL((url) => !url.pathname.includes('/admin/members'), { timeout: 15000 });
      expect(page.url()).not.toContain('/admin/members');

      await page.goto('/superadmin/dashboard', { waitUntil: 'networkidle' });
      await page.waitForURL((url) => !url.pathname.includes('/superadmin/dashboard'), {
        timeout: 15000,
      });
      expect(page.url()).not.toContain('/superadmin/dashboard');
    });
  });
});
