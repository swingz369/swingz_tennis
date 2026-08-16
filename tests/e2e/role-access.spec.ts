import { test, expect } from '@playwright/test';
import { loginAsRoleAware } from '../helpers/auth';

/**
 * Role-based Access Control + gerenderte Sidebar/Bottom-Nav.
 *
 * Konsolidiert aus den früheren Specs `role-access.spec.ts` und
 * `role-access-sidebar.spec.ts` (Audit P2, 13.08.2026 — beide prüften
 * dieselben Nav-Items pro Rolle und dieselben Cross-Role-Redirects).
 *
 * Abgedeckt pro Rolle:
 *   - welche Nav-Items sichtbar sind (positiv + negativ)
 *   - welche Routen erreichbar sind (positiv) bzw. wegredirecten (negativ)
 * Die Quellcode-Ebene der Nav-Definitionen prüft sidebar-structure.spec.ts;
 * das reine Seiten-Rendering (ohne Nav-Assertions) all-pages-render.spec.ts.
 */

const SIDEBAR = 'aside[role="navigation"]';

test.describe('Superadmin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(
      page,
      process.env.TEST_SUPERADMIN_EMAIL!,
      process.env.TEST_SUPERADMIN_PASSWORD!
    );
  });

  test('sieht platformweite Navigation, keine club-scoped Admin-Sektionen', async ({ page }) => {
    await page.goto('/superadmin', { waitUntil: 'networkidle' });
    const sidebar = page.locator(SIDEBAR);
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    const meineVereine = sidebar.getByRole('button', { name: /Meine Vereine/i });
    await expect(meineVereine).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Verwaltung/i })).toBeVisible();

    if ((await meineVereine.getAttribute('aria-expanded')) !== 'true') {
      await meineVereine.click();
    }
    await expect(sidebar.getByText('Vereinsübersicht')).toBeVisible();
    await expect(sidebar.getByText('Admins verwalten')).toBeVisible();

    // Club-scoped Admin-Sektionen dürfen nicht auftauchen
    await expect(sidebar.getByText('Alle Mitglieder')).not.toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Spielbetrieb/i })).not.toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Verein/i })).not.toBeVisible();
  });

  test('Verwaltung-Sektion zeigt Statistiken + Einstellungen', async ({ page }) => {
    await page.goto('/superadmin', { waitUntil: 'networkidle' });
    const sidebar = page.locator(SIDEBAR);
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    const verwaltung = sidebar.getByRole('button', { name: /Verwaltung/i });
    await expect(verwaltung).toBeVisible();
    if ((await verwaltung.getAttribute('aria-expanded')) !== 'true') {
      await verwaltung.click();
    }
    await expect(sidebar.getByText('Statistiken')).toBeVisible();
    await expect(sidebar.getByText('Einstellungen')).toBeVisible();
  });

  test('kann /superadmin/-Routen öffnen', async ({ page }) => {
    await page.goto('/superadmin', { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/superadmin');
    await page.goto('/superadmin/tenants', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/superadmin\/tenants/);
  });
});

test.describe('Admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  test('sieht club-scoped Sektionen, keine Superadmin-Sektionen', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'networkidle' });
    const sidebar = page.locator(SIDEBAR);
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    for (const section of ['Mitglieder', 'Trainer', 'Spielbetrieb', 'Finanzen', 'Verein']) {
      await expect(sidebar.getByRole('button', { name: new RegExp(section, 'i') })).toBeVisible();
    }
    // Superadmin-Sektionen dürfen nicht auftauchen
    await expect(sidebar.getByText('Vereinsübersicht')).not.toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Meine Vereine/i })).not.toBeVisible();
  });

  test('kann /admin/-Routen öffnen, /superadmin/ wird wegredirected', async ({ page }) => {
    await page.goto('/admin/members', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/admin\/members/);

    await page.goto('/superadmin/dashboard', { waitUntil: 'networkidle' });
    await page.waitForURL((url) => !url.pathname.includes('/superadmin/dashboard'), {
      timeout: 15000,
    });
    expect(page.url()).not.toContain('/superadmin/dashboard');
  });
});

test.describe('Trainer', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(
      page,
      process.env.TEST_TRAINER_EMAIL!,
      process.env.TEST_TRAINER_PASSWORD!
    );
  });

  test('sieht Bottom-Nav-Items (keine Sidebar)', async ({ page }) => {
    await page.goto('/trainer', { waitUntil: 'networkidle' });
    const bottomNav = page.locator('nav[aria-label="Navigation"]');
    await expect(bottomNav).toBeVisible({ timeout: 10000 });
    for (const item of ['Übersicht', 'Einheiten', 'Verfügbarkeit', 'Saisonplanung']) {
      await expect(bottomNav.getByRole('link', { name: new RegExp(item, 'i') })).toBeVisible();
    }
  });

  test('kann Admin-/Superadmin-Routen nicht öffnen', async ({ page }) => {
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

test.describe('Member', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
  });

  test('sieht Bottom-Nav-Items (keine Sidebar)', async ({ page }) => {
    await page.goto('/member', { waitUntil: 'networkidle' });
    const bottomNav = page.locator('nav[aria-label="Navigation"]');
    await expect(bottomNav).toBeVisible({ timeout: 10000 });
    for (const item of ['Home', 'Stundenplan', 'Buchen', 'Rechnungen']) {
      await expect(bottomNav.getByRole('link', { name: new RegExp(item, 'i') })).toBeVisible();
    }
  });

  test('kann Admin-/Superadmin-Routen nicht öffnen', async ({ page }) => {
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
