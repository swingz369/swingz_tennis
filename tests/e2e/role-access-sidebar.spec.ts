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
      // Section buttons (Collapsibles, siehe lib/navigation.ts superadminSidebarSections)
      const meineVereine = sidebar.getByRole('button', { name: /Meine Vereine/i });
      await expect(meineVereine).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Verwaltung/i })).toBeVisible();
      // Expand → platform-wide items (getByText — unabhängig von der Link-Rolle)
      if ((await meineVereine.getAttribute('aria-expanded')) !== 'true') {
        await meineVereine.click();
      }
      await expect(sidebar.getByText('Vereinsübersicht')).toBeVisible();
      await expect(sidebar.getByText('Admins verwalten')).toBeVisible();
      // Club-scoped admin items should NOT be visible
      await expect(sidebar.getByText('Alle Mitglieder')).not.toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Spielbetrieb/i })).not.toBeVisible();
    });

    test('shows Verwaltung settings section', async ({ page }) => {
      await page.goto('/superadmin', { waitUntil: 'networkidle' });
      const sidebar = page.locator('aside[role="navigation"]');
      await expect(sidebar).toBeVisible({ timeout: 10000 });
      const verwaltung = sidebar.getByRole('button', { name: /Verwaltung/i });
      await expect(verwaltung).toBeVisible();
      if ((await verwaltung.getAttribute('aria-expanded')) !== 'true') {
        await verwaltung.click();
      }
      await expect(sidebar.getByText('Statistiken')).toBeVisible();
      await expect(sidebar.getByText('Einstellungen')).toBeVisible();
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
      // Section header buttons (siehe lib/navigation.ts adminSidebarSections)
      await expect(sidebar.getByRole('button', { name: /Mitglieder/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Training/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Spielbetrieb/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Finanzen/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Vereinsführung/i })).toBeVisible();
      // Superadmin items should NOT be visible
      await expect(sidebar.getByText('Vereinsübersicht')).not.toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Meine Vereine/i })).not.toBeVisible();
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
      await expect(bottomNav.getByRole('link', { name: /Verfügbarkeit/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Saisonplanung/i })).toBeVisible();
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
      await expect(bottomNav.getByRole('link', { name: /Stundenplan/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Buchen/i })).toBeVisible();
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
      // Superadmin sieht eigene Sektionen, aber keine club-scoped Admin-Sektionen
      await expect(sidebar.getByRole('button', { name: /Meine Vereine/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Spielbetrieb/i })).not.toBeVisible();
      await expect(sidebar.getByRole('button', { name: /Vereinsführung/i })).not.toBeVisible();
    });
  });
});
