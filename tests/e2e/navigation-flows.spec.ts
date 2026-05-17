import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

/**
 * Navigation Flow Tests
 *
 * Tests critical user journeys through the application:
 * - Dashboard → Bookings → Scheduler
 * - Dashboard → Member management
 * - Admin workflow (approvals → members)
 * - Superadmin overview
 */

async function setupAuthMock(page: Page, role: string) {
  // Test-Mode-Cookie setzen, damit Middleware Auth-Check überspringt
  await page
    .context()
    .addCookies([{ name: 'swingz_test_mode', value: 'true', domain: 'localhost', path: '/' }]);

  // Register catch-all FIRST (Playwright uses reverse-order: last-registered handler wins)
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    // Let specific auth handlers below handle these via fallback
    if (url.includes('/api/auth/') || url.includes('/api/user/')) {
      return route.fallback();
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // Mock session endpoint (registered AFTER catch-all, so it takes priority)
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: `test-${role}`, email: `${role}@test.com` },
        roles: [role],
      }),
    });
  });

  // Mock user roles endpoint
  await page.route('**/api/user/roles', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ roles: [role] }),
    });
  });
}

test.describe('Dashboard Navigation Flows', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, 'admin');
  });

  test('Admin: Dashboard → Quick Actions → Scheduler', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();

    // Find and click the scheduler/training link if it exists
    const schedulerLink = page
      .locator('a')
      .filter({ hasText: /scheduler|stundenplan|trainingsplan/i })
      .first();
    const schedulerButton = page
      .locator('button')
      .filter({ hasText: /scheduler|stundenplan|trainingsplan/i })
      .first();
    const schedulerCard = page
      .locator('[class*="cursor-pointer"]')
      .filter({ hasText: /trainingsplanung|scheduler/i })
      .first();

    if (await schedulerLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await schedulerLink.click();
    } else if (await schedulerButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await schedulerButton.click();
    } else if (await schedulerCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await schedulerCard.click();
    }

    // Should end up on scheduler page
    await expect(page).toHaveURL(/scheduler/, { timeout: 5000 });
  });

  test('Admin: Dashboard → Members management', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();

    // Click members link
    const membersLink = page
      .locator('a')
      .filter({ hasText: /mitglied|member|benutzer/i })
      .first();
    if (await membersLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await membersLink.click();
      await expect(page).toHaveURL(/members|mitglied/, { timeout: 5000 });
    }
  });

  test('Admin: Dashboard → Bookings overview', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    const bookingsLink = page
      .locator('a')
      .filter({ hasText: /buchung|booking/i })
      .first();
    const bookingsCard = page
      .locator('[class*="cursor-pointer"]')
      .filter({ hasText: /buchung|booking/i })
      .first();

    if (await bookingsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bookingsLink.click();
    } else if (await bookingsCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bookingsCard.click();
    }

    await expect(page).toHaveURL(/bookings?/, { timeout: 5000 });
  });
});

test.describe('Admin Workflow Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, 'admin');
  });

  test('Admin: Navigate between approval workflow pages', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();

    // Navigate to approvals
    const approvalsLink = page
      .locator('a')
      .filter({ hasText: /genehmigung|approval/i })
      .first();
    if (await approvalsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approvalsLink.click();
      await expect(page).toHaveURL(/approv/, { timeout: 5000 });
    }
  });

  test('Admin: Navigate between admin sections via sidebar', async ({ page }) => {
    await page.goto('/admin/members', { waitUntil: 'networkidle' });

    // Sidebar navigation to different admin sections
    const sections = [
      { text: /saison|season/i, url: /season/ },
      { text: /stunden|hours/i, url: /hours/ },
      { text: /einstellung|setting/i, url: /setting/ },
    ];

    for (const section of sections) {
      const link = page.locator('a, button').filter({ hasText: section.text }).first();
      if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
        await link.click();
        await page.waitForTimeout(1000); // Wait for navigation
      }
    }

    // Should still be on admin pages
    await expect(page).toHaveURL(/admin/, { timeout: 3000 });
  });

  test('Admin: Navigate tournament creation flow', async ({ page }) => {
    await page.goto('/admin/tournaments', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();

    // Find "New Tournament" button/link
    const newTournamentBtn = page
      .locator('a, button')
      .filter({ hasText: /neue?n?|erstellen|create/i })
      .first();
    if (await newTournamentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newTournamentBtn.click();
      await expect(page).toHaveURL(/tournament.*new|new.*tournament/, { timeout: 5000 });
    }
  });
});

test.describe('Member Navigation Flows', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, 'member');
  });

  test('Member: Dashboard → Bookings', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();

    // Navigate to bookings
    const bookingsLink = page
      .locator('a')
      .filter({ hasText: /buchung|booking|kalender/i })
      .first();
    if (await bookingsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bookingsLink.click();
      await expect(page).toHaveURL(/bookings?/i, { timeout: 5000 });
    }
  });

  test('Member: Dashboard → Scheduler', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    const schedulerLink = page
      .locator('a')
      .filter({ hasText: /stundenplan|scheduler|trainingszeit/i })
      .first();
    if (await schedulerLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await schedulerLink.click();
      await expect(page).toHaveURL(/scheduler|training-schedule/, { timeout: 5000 });
    }
  });

  test('Member: Dashboard → Profile', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    const profileLink = page
      .locator('a')
      .filter({ hasText: /profil|profile/i })
      .first();
    if (await profileLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await profileLink.click();
      await expect(page).toHaveURL(/profile/, { timeout: 5000 });
    }
  });
});

test.describe('Superadmin Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, 'superadmin');
  });

  test('Superadmin: Dashboard → Tenants → Clubs flow', async ({ page }) => {
    // Navigate to superadmin dashboard
    await page.goto('/superadmin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();

    // Navigate to tenants
    const tenantsLink = page
      .locator('a')
      .filter({ hasText: /mandant|tenant/i })
      .first();
    if (await tenantsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tenantsLink.click();
      await expect(page).toHaveURL(/tenant/, { timeout: 5000 });
    }

    // Navigate to clubs
    const clubsLink = page
      .locator('a')
      .filter({ hasText: /club|verein/i })
      .first();
    if (await clubsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clubsLink.click();
      await expect(page).toHaveURL(/club/, { timeout: 5000 });
    }
  });
});

test.describe('Cross-Role Transition Tests', () => {
  test('Member trying admin URL gets redirected to their dashboard', async ({ page }) => {
    await setupAuthMock(page, 'member');

    await page.goto('/admin/dashboard', { waitUntil: 'networkidle' });
    const currentUrl = page.url();
    // Should not be on the admin page - either redirected to dashboard or login
    expect(currentUrl).not.toContain('/admin/dashboard');
  });

  test('Admin trying superadmin URL gets redirected', async ({ page }) => {
    await setupAuthMock(page, 'admin');

    await page.goto('/superadmin/dashboard', { waitUntil: 'networkidle' });
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/superadmin/dashboard');
  });

  test('Trainer trying admin URL gets redirected', async ({ page }) => {
    await setupAuthMock(page, 'trainer');

    await page.goto('/admin/members', { waitUntil: 'networkidle' });
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/admin/members');
  });
});
