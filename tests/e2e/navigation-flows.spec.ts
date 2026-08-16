import { test, expect } from '@playwright/test';
import { loginAsRoleAware } from '../helpers/auth';

/**
 * Navigation Flow Tests
 *
 * Tests critical user journeys through the application with ECHTEN Logins
 * (client-seitiges API-Mocking kommt an der server-seitigen Auth nicht vorbei):
 * - Dashboard-Dispatch pro Rolle
 * - Admin-Sidebar-Navigation (Spielbetrieb → Plätze/Saisonplanung)
 * - Superadmin overview
 * - Cross-Role-Redirects
 */

const SIDEBAR = 'aside[aria-label="Seitennavigation"]';

test.describe('Dashboard Navigation Flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  test('Admin: /dashboard dispatcht zur Admin-Oberfläche', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/admin/, { timeout: 15000 });
    expect(page.url()).toContain('/admin');
  });

  test('Admin: Sidebar Spielbetrieb → Plätze (Kalender + Verwaltung)', async ({ page }) => {
    await page.goto('/admin/members', { waitUntil: 'networkidle' });
    const sidebar = page.locator(SIDEBAR);
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Spielbetrieb ist defaultOpen — Plätze direkt klickbar
    await sidebar.getByText('Plätze').click();
    await expect(page).toHaveURL(/\/admin\/courts/, { timeout: 10000 });

    // Hub zeigt beide Sichten: Kalender (default) und Verwaltung
    await expect(page.getByRole('tab', { name: /Kalender/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: /Verwaltung/i })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Admin Workflow Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  test('Admin: Navigate between approval workflow pages', async ({ page }) => {
    await page.goto('/admin/approvals', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL(/approv/);
    await expect(page.locator('body')).toContainText(/genehmigung|approval|probetraining/i, {
      timeout: 8000,
    });
  });

  test('Admin: Navigate between admin sections via sidebar', async ({ page }) => {
    await page.goto('/admin/members', { waitUntil: 'networkidle' });
    const sidebar = page.locator(SIDEBAR);
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Spielbetrieb ist defaultOpen → Saisonplanung direkt klickbar
    await sidebar.getByText('Saisonplanung').click();
    await expect(page).toHaveURL(/\/admin\/seasons/, { timeout: 10000 });
  });

  test('Admin: Navigate tournament creation flow', async ({ page }) => {
    await page.goto('/admin/events?tab=tournaments', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();

    // Find "New Tournament" button/link (defensiv — leerer Zustand hat evtl. keinen CTA)
    const newTournamentBtn = page
      .locator('a, button')
      .filter({ hasText: /neue?s? Turnier|erstellen/i })
      .first();
    if (await newTournamentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newTournamentBtn.click();
      await expect(page).toHaveURL(/tournament/, { timeout: 5000 });
    }
  });
});

test.describe('Member Navigation Flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
  });

  test('Member: /dashboard dispatcht zu /member', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/member/, { timeout: 15000 });
    expect(page.url()).toContain('/member');
  });

  test('Member: Bottom-Nav → Buchen', async ({ page }) => {
    // Bottom-Nav ist md:hidden — nur im Mobile-Viewport sichtbar
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/member', { waitUntil: 'domcontentloaded' });
    const bottomNav = page.locator('nav[aria-label="Navigation"]');
    await expect(bottomNav).toBeVisible({ timeout: 10000 });
    await bottomNav.getByRole('link', { name: /Buchen/i }).click();
    await expect(page).toHaveURL(/\/bookings/, { timeout: 10000 });
  });

  test('Member: Bottom-Nav → Stundenplan', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/member', { waitUntil: 'domcontentloaded' });
    const bottomNav = page.locator('nav[aria-label="Navigation"]');
    await expect(bottomNav).toBeVisible({ timeout: 10000 });
    await bottomNav.getByRole('link', { name: /Stundenplan/i }).click();
    await expect(page).toHaveURL(/\/scheduler/, { timeout: 10000 });
  });
});

test.describe('Superadmin Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(
      page,
      process.env.TEST_SUPERADMIN_EMAIL!,
      process.env.TEST_SUPERADMIN_PASSWORD!
    );
  });

  test('Superadmin: Sidebar → Vereinsübersicht → Clubs', async ({ page }) => {
    await page.goto('/superadmin', { waitUntil: 'networkidle' });
    const sidebar = page.locator(SIDEBAR);
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    const meineVereine = sidebar.getByRole('button', { name: /Meine Vereine/i });
    if ((await meineVereine.getAttribute('aria-expanded')) !== 'true') {
      await meineVereine.click();
    }
    await sidebar.getByText('Vereinsübersicht').click();
    await expect(page).toHaveURL(/\/superadmin\/clubs/, { timeout: 10000 });
  });
});

test.describe('Cross-Role Transition Tests', () => {
  test('Member trying admin URL gets redirected to their dashboard', async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
    await page.goto('/admin/members', { waitUntil: 'networkidle' });
    await page.waitForURL((url) => !url.pathname.startsWith('/admin/members'), { timeout: 15000 });
    expect(page.url()).not.toContain('/admin/members');
  });

  test('Admin trying superadmin URL gets redirected', async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    await page.goto('/superadmin/dashboard', { waitUntil: 'networkidle' });
    await page.waitForURL((url) => !url.pathname.startsWith('/superadmin/dashboard'), {
      timeout: 15000,
    });
    expect(page.url()).not.toContain('/superadmin/dashboard');
  });

  test('Trainer trying admin URL gets redirected', async ({ page }) => {
    await loginAsRoleAware(
      page,
      process.env.TEST_TRAINER_EMAIL!,
      process.env.TEST_TRAINER_PASSWORD!
    );
    await page.goto('/admin/members', { waitUntil: 'networkidle' });
    await page.waitForURL((url) => !url.pathname.startsWith('/admin/members'), { timeout: 15000 });
    expect(page.url()).not.toContain('/admin/members');
  });
});
