import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

/**
 * Comprehensive Page Rendering Tests
 *
 * Tests that every page in the application loads without errors for each role.
 * Uses API mocking to simulate auth and role state without needing a real database.
 */

interface RouteTest {
  path: string;
  expectedContent: string | RegExp;
  timeout?: number;
}

// Role-specific pages that SHOULD be accessible
const MEMBER_ROUTES: RouteTest[] = [
  { path: '/dashboard', expectedContent: /dashboard|SWINGZ/i },
  { path: '/dashboard/bookings/new', expectedContent: /Neue Buchung/i },
  { path: '/bookings', expectedContent: /buchung|platz/i },
  { path: '/bookings-unified', expectedContent: /buchung|platz/i },
  { path: '/my-bookings', expectedContent: /buchung|meine/i },
  { path: '/scheduler', expectedContent: /stundenplan|scheduler/i },
  { path: '/courts', expectedContent: /platz|court/i },
  { path: '/courts/daily', expectedContent: /platz|täglich/i },
  { path: '/training-schedule', expectedContent: /training/i },
  { path: '/member', expectedContent: /mitglied|member/i },
  { path: '/member/tournaments', expectedContent: /turnier|tournament/i },
  { path: '/member/trainer-booking', expectedContent: /trainer|buch/i },
  { path: '/search', expectedContent: /suche|search/i },
  { path: '/notifications', expectedContent: /benachrichtigung|notification/i },
  { path: '/news', expectedContent: /news|nachricht/i },
  { path: '/profile', expectedContent: /profil|profile/i },
  { path: '/billing', expectedContent: /rechnung|billing|zahlung/i },
  { path: '/attendance-history', expectedContent: /anwesenheit|attendance/i },
  { path: '/trial-training', expectedContent: /probetraining|trial/i },
];

const ADMIN_EXTRA_ROUTES: RouteTest[] = [
  { path: '/admin', expectedContent: /admin|dashboard/i },
  { path: '/admin/dashboard', expectedContent: /admin|dashboard|übersicht/i },
  { path: '/admin/members', expectedContent: /mitglied|member/i },
  { path: '/admin/seasons', expectedContent: /saison|season/i },
  { path: '/admin/seasons/new', expectedContent: /saison|season|erstellen/i },
  { path: '/admin/schedules', expectedContent: /trainingsplan|schedule/i },
  { path: '/admin/courts', expectedContent: /platz|court/i },
  { path: '/admin/courts/manage', expectedContent: /verwaltung|manage|court/i },
  { path: '/admin/trainers', expectedContent: /trainer/i },
  { path: '/admin/approvals', expectedContent: /genehmigung|approval/i },
  { path: '/admin/billing', expectedContent: /rechnung|billing|abrechnung/i },
  { path: '/admin/analytics', expectedContent: /analytics|statistik/i },
  { path: '/admin/settings', expectedContent: /einstellung|setting/i },
  { path: '/admin/hours-logs', expectedContent: /stunden|hours/i },
  { path: '/admin/tournaments', expectedContent: /turnier|tournament/i },
  { path: '/admin/tournaments/new', expectedContent: /turnier|tournament|erstellen/i },
  { path: '/admin/branding', expectedContent: /branding/i },
  { path: '/admin/court-types', expectedContent: /platztyp|court/i },
  { path: '/admin/onboarding', expectedContent: /onboarding/i },
  { path: '/admin/clubs', expectedContent: /club|verein/i },
];

const TRAINER_EXTRA_ROUTES: RouteTest[] = [
  { path: '/trainer', expectedContent: /trainer|dashboard/i },
  { path: '/trainer/availability', expectedContent: /verfügbar|availability/i },
];

const SUPERADMIN_EXTRA_ROUTES: RouteTest[] = [
  { path: '/superadmin', expectedContent: /superadmin/i },
  { path: '/superadmin/dashboard', expectedContent: /superadmin|übersicht/i },
  { path: '/superadmin/tenants', expectedContent: /mandant|tenant/i },
  { path: '/superadmin/clubs', expectedContent: /club|verein/i },
];

// Routes that the given role should NOT be able to access
const RESTRICTED_ROUTES: Record<string, string[]> = {
  member: [
    '/admin',
    '/admin/members',
    '/admin/seasons',
    '/superadmin',
    '/superadmin/dashboard',
    '/trainer',
  ],
  trainer: ['/admin', '/admin/members', '/superadmin', '/superadmin/dashboard'],
  admin: ['/superadmin', '/superadmin/dashboard', '/superadmin/tenants', '/superadmin/clubs'],
  superadmin: [], // superadmin can access everything
};

async function setupAuthMock(page: Page, role: string) {
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

test.describe('Public Pages (no auth required)', () => {
  const PUBLIC_PAGES: RouteTest[] = [
    { path: '/', expectedContent: /swingz|tischtennis|sport/i, timeout: 10000 },
    { path: '/login', expectedContent: /anmelden|login/i },
    { path: '/register', expectedContent: /Mitglied werden|registrieren|register/i },
    // /apply was removed — onboarding is now via Probetraining on /member
    { path: '/landing', expectedContent: /swingz|tischtennis|sport/i },
  ];

  for (const pageDef of PUBLIC_PAGES) {
    test(`public page: ${pageDef.path} loads without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(pageDef.path, {
        waitUntil: 'networkidle',
        timeout: pageDef.timeout || 15000,
      });
      await expect(page.locator('body')).toBeVisible();

      // Check for expected content
      await expect(page.locator('body')).toContainText(pageDef.expectedContent, {
        timeout: pageDef.timeout || 5000,
      });
      expect(errors.length).toBe(0);
    });
  }
});

test.describe('Member Pages', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, 'member');
  });

  const allRoutes = MEMBER_ROUTES;
  for (const route of allRoutes) {
    test(`page ${route.path} loads without errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(route.path, { waitUntil: 'networkidle', timeout: route.timeout || 15000 });
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).toContainText(route.expectedContent, {
        timeout: route.timeout || 8000,
      });

      // Allow 404 network errors for mocked API calls, but no critical errors
      const criticalErrors = consoleErrors.filter(
        (e) => !e.includes('404') && !e.includes('Failed to load resource')
      );
      expect(criticalErrors.length).toBe(0);
    });
  }

  test('member CANNOT access admin routes', async ({ page }) => {
    await setupAuthMock(page, 'member');
    for (const restricted of RESTRICTED_ROUTES.member) {
      await page.goto(restricted, { waitUntil: 'networkidle' });
      // Should be redirected away or show access denied
      const currentUrl = page.url();
      expect(currentUrl).not.toContain(restricted);
    }
  });
});

test.describe('Admin Pages', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, 'admin');
  });

  const memberRoutes = MEMBER_ROUTES.filter((r) => r.path !== '/member/trainer-booking'); // Admin sees all member routes
  const allRoutes = [...memberRoutes, ...ADMIN_EXTRA_ROUTES];

  for (const route of allRoutes) {
    test(`page ${route.path} loads without errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(route.path, { waitUntil: 'networkidle', timeout: route.timeout || 15000 });
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).toContainText(route.expectedContent, {
        timeout: route.timeout || 8000,
      });

      const criticalErrors = consoleErrors.filter(
        (e) => !e.includes('404') && !e.includes('Failed to load resource')
      );
      expect(criticalErrors.length).toBe(0);
    });
  }

  test('admin CANNOT access superadmin routes', async ({ page }) => {
    await setupAuthMock(page, 'admin');
    for (const restricted of RESTRICTED_ROUTES.admin) {
      await page.goto(restricted, { waitUntil: 'networkidle' });
      const currentUrl = page.url();
      expect(currentUrl).not.toContain(restricted);
    }
  });
});

test.describe('Trainer Pages', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, 'trainer');
  });

  const allRoutes = [...TRAINER_EXTRA_ROUTES];

  for (const route of allRoutes) {
    test(`page ${route.path} loads without errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(route.path, { waitUntil: 'networkidle', timeout: route.timeout || 15000 });
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).toContainText(route.expectedContent, {
        timeout: route.timeout || 8000,
      });

      const criticalErrors = consoleErrors.filter(
        (e) => !e.includes('404') && !e.includes('Failed to load resource')
      );
      expect(criticalErrors.length).toBe(0);
    });
  }

  test('trainer CANNOT access admin or superadmin routes', async ({ page }) => {
    await setupAuthMock(page, 'trainer');
    for (const restricted of RESTRICTED_ROUTES.trainer) {
      await page.goto(restricted, { waitUntil: 'networkidle' });
      const currentUrl = page.url();
      expect(currentUrl).not.toContain(restricted);
    }
  });
});

test.describe('Superadmin Pages', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, 'superadmin');
  });

  const allRoutes = SUPERADMIN_EXTRA_ROUTES;

  for (const route of allRoutes) {
    test(`page ${route.path} loads without errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(route.path, { waitUntil: 'networkidle', timeout: route.timeout || 15000 });
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).toContainText(route.expectedContent, {
        timeout: route.timeout || 8000,
      });

      const criticalErrors = consoleErrors.filter(
        (e) => !e.includes('404') && !e.includes('Failed to load resource')
      );
      expect(criticalErrors.length).toBe(0);
    });
  }
});
