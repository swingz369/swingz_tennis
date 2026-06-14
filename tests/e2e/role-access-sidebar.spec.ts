import { test, expect } from '@playwright/test';
import { loginAsRoleAware } from '../helpers/auth';

test.describe('Sidebar Navigation by Role', () => {
  test.describe('Superadmin Sidebar', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRoleAware(
        page,
        process.env.TEST_SUPERADMIN_EMAIL!,
        process.env.TEST_SUPERADMIN_PASSWORD!
      );
    });

    test('shows platform-wide navigation in sidebar', async ({ page }) => {
      await page.goto('/superadmin', { waitUntil: 'networkidle' });
      const sidebar = page.locator('aside[role="navigation"]');
      await expect(sidebar).toBeVisible({ timeout: 10000 });
      // Platform-wide links
      await expect(sidebar.getByRole('link', { name: /Superadmin Dashboard/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Vereinsübersicht/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Club-Verwaltung/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Plattform-Analyse/i })).toBeVisible();
      // Section labels
      await expect(sidebar.getByRole('heading', { name: /Plattform/i })).toBeVisible();
      await expect(sidebar.getByRole('heading', { name: /Verwaltung/i })).toBeVisible();
      // Club-scoped admin items should NOT be visible
      await expect(sidebar.getByText('Saisonplanung')).not.toBeVisible();
      await expect(sidebar.getByText('Alle Mitglieder')).not.toBeVisible();
    });

    test('shows Verwaltung settings section', async ({ page }) => {
      await page.goto('/superadmin', { waitUntil: 'networkidle' });
      const sidebar = page.locator('aside[role="navigation"]');
      await expect(sidebar).toBeVisible({ timeout: 10000 });
      await expect(sidebar.getByRole('heading', { name: /Verwaltung/i })).toBeVisible();
      await expect(sidebar.getByText('Plattform-Verwaltung')).toBeVisible();
    });
  });

  test.describe('Admin Sidebar', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRoleAware(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    });

    test('shows structured club-scoped navigation sidebar', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'networkidle' });
      const sidebar = page.locator('aside[role="navigation"]');
      await expect(sidebar).toBeVisible({ timeout: 10000 });
      // Übersicht section heading and Dashboard link
      await expect(sidebar.getByRole('heading', { name: /Übersicht/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Dashboard/i })).toBeVisible();
      // Section header buttons
      await expect(sidebar.getByRole('button', { name: /Mitglieder/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Training/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Plätze & Buchungen/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Finanzen/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Einstellungen/i })).toBeVisible();
      // Superadmin items should NOT be visible
      await expect(sidebar.getByText('Superadmin Dashboard')).not.toBeVisible();
      await expect(sidebar.getByText('Vereinsübersicht')).not.toBeVisible();
      await expect(sidebar.getByRole('heading', { name: /Plattform/i })).not.toBeVisible();
    });
  });

  test.describe('Trainer Bottom Nav', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRoleAware(
        page,
        process.env.TEST_TRAINER_EMAIL!,
        process.env.TEST_TRAINER_PASSWORD!
      );
    });

    test('shows trainer bottom nav items', async ({ page }) => {
      await page.goto('/trainer', { waitUntil: 'networkidle' });
      const bottomNav = page.locator('nav[aria-label="Navigation"]');
      await expect(bottomNav).toBeVisible({ timeout: 10000 });
      await expect(bottomNav.getByRole('link', { name: /Übersicht/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Einheiten/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Anwesenheit/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Verfügbarkeit/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Profil/i })).toBeVisible();
    });
  });

  test.describe('Member Bottom Nav', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRoleAware(
        page,
        process.env.TEST_MEMBER_EMAIL!,
        process.env.TEST_MEMBER_PASSWORD!
      );
    });

    test('shows member bottom nav items', async ({ page }) => {
      await page.goto('/member', { waitUntil: 'networkidle' });
      const bottomNav = page.locator('nav[aria-label="Navigation"]');
      await expect(bottomNav).toBeVisible({ timeout: 10000 });
      await expect(bottomNav.getByRole('link', { name: /Home/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Buchen/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Chat/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Rechnungen/i })).toBeVisible();
      // Profil removed — accessible via user menu in header
    });
  });

  test.describe('Role Separation Verification', () => {
    test('admin and superadmin have separate sidebars', async ({ page }) => {
      await loginAsRoleAware(
        page,
        process.env.TEST_SUPERADMIN_EMAIL!,
        process.env.TEST_SUPERADMIN_PASSWORD!
      );
      await page.goto('/superadmin', { waitUntil: 'networkidle' });
      const sidebar = page.locator('aside[role="navigation"]');
      await expect(sidebar).toBeVisible({ timeout: 10000 });
      // Superadmin should see Plattform items but NOT admin-specific section labels
      await expect(sidebar.getByRole('heading', { name: /Plattform/i })).toBeVisible();
      await expect(sidebar.getByText('Mitglieder')).not.toBeVisible();
    });
  });
});
