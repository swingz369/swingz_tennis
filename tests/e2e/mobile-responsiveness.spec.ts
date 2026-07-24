import { test, expect } from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  collectPageErrors,
  mockMemberAuth,
  mockAdminAuth,
  mockTrainerAuth,
} from '../helpers/responsive';

/**
 * Mobile Responsiveness E2E Tests
 *
 * Validates that the app renders correctly on iPhone (375×812),
 * iPad (768×1024), and Pixel 5 viewports. Tests are project-scoped:
 * each test runs under the viewport defined in playwright.config.ts.
 */

/* ================================================================== */
/*  PUBLIC PAGES — Landing Page                                       */
/* ================================================================== */

test.describe('Landing Page — Mobile', () => {
  test('hero section is visible and readable', async ({ page }) => {
    const errCollector = collectPageErrors(page);

    await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();

    const hero = page.locator('h1').first();
    await expect(hero).toBeVisible({ timeout: 10000 });

    const ctaButtons = page.locator(
      'a:has-text("Probetraining"), a:has-text("Anmelden"), button:has-text("Jetzt")'
    );
    const ctaCount = await ctaButtons.count();
    expect(ctaCount).toBeGreaterThanOrEqual(1);

    await assertNoHorizontalOverflow(page);
    expect(errCollector.getCritical()).toEqual([]);
  });

  test('all sections stack properly — no overflow while scrolling', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });

    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), (bodyHeight / steps) * i);
      await page.waitForTimeout(300);
      await assertNoHorizontalOverflow(page);
    }
  });

  test('navigation is accessible on mobile', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });

    const mobileMenuBtn = page.locator(
      'button[aria-label*="menu" i], button[aria-label*="menü" i], [data-testid="mobile-menu"]'
    );
    const navVisible = page.locator('nav').first();

    const hasMenuBtn = (await mobileMenuBtn.count()) > 0;
    const hasNav = await navVisible.isVisible();

    expect(hasMenuBtn || hasNav).toBe(true);
  });

  test('text is not cut off on narrow viewport', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });

    const overflowElements = await page.evaluate(() => {
      const els = document.querySelectorAll('h1, h2, h3, p, span, a, button');
      const overflowing: string[] = [];
      for (const el of els) {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth + 2) {
          overflowing.push(
            `${el.tagName}.${el.className.toString().slice(0, 30)}: right=${Math.round(rect.right)}`
          );
        }
      }
      return overflowing;
    });

    expect(overflowElements.length).toBeLessThanOrEqual(2);
  });
});

/* ================================================================== */
/*  LOGIN PAGE                                                        */
/* ================================================================== */

test.describe('Login Page — Mobile', () => {
  test('login form is usable on mobile', async ({ page }) => {
    const errCollector = collectPageErrors(page);

    await page.goto('/login', { waitUntil: 'networkidle', timeout: 15000 });

    const emailInput = page.locator(
      'input[type="email"], input[name="email"], input[placeholder*="@" i]'
    );
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput.first()).toBeVisible({ timeout: 5000 });
    await expect(passwordInput.first()).toBeVisible({ timeout: 5000 });

    const emailBox = await emailInput.first().boundingBox();
    expect(emailBox).not.toBeNull();
    if (emailBox) {
      expect(emailBox.height).toBeGreaterThanOrEqual(36);
    }

    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Anmelden"), button:has-text("Login")'
    );
    await expect(submitBtn.first()).toBeVisible({ timeout: 5000 });

    await assertNoHorizontalOverflow(page);
    expect(errCollector.getCritical()).toEqual([]);
  });

  test('login layout stacks vertically on mobile', async ({ page }) => {
    // Auf Desktop ist das Login-Formular eine zentrierte Karte — Assertion gilt nur mobil
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await assertNoHorizontalOverflow(page);

    const form = page.locator('form').first();
    if (await form.isVisible()) {
      const formBox = await form.boundingBox();
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      if (formBox) {
        expect(formBox.width).toBeGreaterThanOrEqual(viewportWidth * 0.6);
      }
    }
  });
});

/* ================================================================== */
/*  AUTHENTICATED PAGES — Member                                      */
/* ================================================================== */

test.describe('Member Dashboard — Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await mockMemberAuth(page);
  });

  test('renders without horizontal overflow', async ({ page }) => {
    const errCollector = collectPageErrors(page);

    await page.goto('/member', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    expect(errCollector.getCritical()).toEqual([]);
  });

  test('bottom navigation is visible on mobile', async ({ page }) => {
    await page.goto('/member', { waitUntil: 'networkidle', timeout: 20000 });

    const bottomNav = page.locator(
      '[data-testid="mobile-bottom-nav"], [aria-label*="mobile" i], [aria-label*="unten" i]'
    );
    const fixedBottom = page.locator('.fixed.bottom-0, [class*="bottom-nav"]');

    const hasBottomNav = (await bottomNav.count()) > 0;
    const hasFixedBottom = (await fixedBottom.count()) > 0;

    if (hasBottomNav) {
      await expect(bottomNav.first()).toBeVisible();
    } else if (hasFixedBottom) {
      await expect(fixedBottom.first()).toBeVisible();
    }
  });

  test('sidebar is hidden or non-overlapping on mobile', async ({ page }) => {
    await page.goto('/member', { waitUntil: 'networkidle', timeout: 20000 });

    const sidebar = page.locator(
      'aside[aria-label*="navigation" i], aside[aria-label*="sidebar" i], [data-testid="sidebar"]'
    );

    if ((await sidebar.count()) > 0) {
      const isVisible = await sidebar.first().isVisible();
      if (isVisible) {
        const sidebarBox = await sidebar.first().boundingBox();
        if (sidebarBox) {
          expect(sidebarBox.width).toBeLessThanOrEqual(300);
        }
      }
    }
  });
});

/* ================================================================== */
/*  MEMBER PAGES — Horizontal overflow checks                         */
/* ================================================================== */

const MEMBER_PAGES = ['/bookings', '/scheduler', '/search', '/messages', '/profile'];

for (const pagePath of MEMBER_PAGES) {
  test.describe(`${pagePath} — Mobile`, () => {
    test.beforeEach(async ({ page }) => {
      await mockMemberAuth(page);
    });

    test(`renders without horizontal overflow`, async ({ page }) => {
      const errCollector = collectPageErrors(page);

      await page.goto(pagePath, { waitUntil: 'networkidle', timeout: 20000 });
      await expect(page.locator('body')).toBeVisible();
      await assertNoHorizontalOverflow(page);

      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      const steps = 3;
      for (let i = 0; i <= steps; i++) {
        await page.evaluate((y) => window.scrollTo(0, y), (bodyHeight / steps) * i);
        await page.waitForTimeout(200);
        await assertNoHorizontalOverflow(page);
      }

      expect(errCollector.getCritical()).toEqual([]);
    });
  });
}

/* ================================================================== */
/*  ADMIN DASHBOARD — Mobile                                          */
/* ================================================================== */

test.describe('Admin Dashboard — Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminAuth(page);
  });

  test('renders without horizontal overflow', async ({ page }) => {
    const errCollector = collectPageErrors(page);

    await page.goto('/admin/dashboard', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    expect(errCollector.getCritical()).toEqual([]);
  });

  test('KPI cards stack vertically on mobile', async ({ page }) => {
    await page.goto('/admin/dashboard', { waitUntil: 'networkidle', timeout: 20000 });

    const kpiCards = page.locator('[role="link"][aria-label]');
    const count = await kpiCards.count();

    if (count >= 2) {
      const firstBox = await kpiCards.nth(0).boundingBox();
      const secondBox = await kpiCards.nth(1).boundingBox();

      if (firstBox && secondBox) {
        expect(secondBox.y).toBeGreaterThanOrEqual(firstBox.y + firstBox.height - 3);
      }
    }
  });
});

/* ================================================================== */
/*  TRAINER DASHBOARD — Mobile                                        */
/* ================================================================== */

test.describe('Trainer Dashboard — Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await mockTrainerAuth(page);
  });

  test('renders without horizontal overflow', async ({ page }) => {
    const errCollector = collectPageErrors(page);

    await page.goto('/trainer', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    expect(errCollector.getCritical()).toEqual([]);
  });
});

/* ================================================================== */
/*  TOUCH TARGET SIZES — WCAG                                        */
/* ================================================================== */

test.describe('Touch Targets — Minimum Size', () => {
  const PAGES_TO_CHECK = ['/', '/login'];

  for (const pagePath of PAGES_TO_CHECK) {
    test(`buttons/links on ${pagePath} have adequate touch targets (≥24px, WCAG 2.5.8)`, async ({
      page,
    }) => {
      await page.goto(pagePath, { waitUntil: 'networkidle', timeout: 20000 });

      const smallTargets = await page.evaluate(() => {
        const interactiveEls = document.querySelectorAll(
          'button, a[href], [role="button"], input[type="submit"]'
        );
        const tooSmall: string[] = [];

        for (const el of interactiveEls) {
          const rect = el.getBoundingClientRect();
          // sr-only-Elemente (Skip-Links) sind bewusst 1x1 — keine Touch-Targets
          if (rect.width <= 2 || rect.height <= 2) continue;
          // WCAG 2.5.8 (AA): Mindestgröße 24x24
          if (rect.width < 24 || rect.height < 24) {
            const text = (el.textContent || '').trim().slice(0, 30);
            tooSmall.push(
              `${el.tagName} "${text}": ${Math.round(rect.width)}x${Math.round(rect.height)}`
            );
          }
        }
        return tooSmall;
      });

      if (smallTargets.length > 0) {
        console.warn(`Small touch targets on ${pagePath}:`, smallTargets);
      }
      expect(smallTargets.length).toBeLessThanOrEqual(5);
    });
  }
});

/* ================================================================== */
/*  LANDSCAPE ORIENTATION                                             */
/* ================================================================== */

test.describe('Landscape Orientation — Mobile', () => {
  test.use({ viewport: { width: 812, height: 375 } });

  test('landing page works in landscape', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const hero = page.locator('h1').first();
    await expect(hero).toBeVisible({ timeout: 10000 });
  });

  test('login page works in landscape', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 15000 });

    const emailInput = page.locator(
      'input[type="email"], input[name="email"], input[placeholder*="@" i]'
    );
    await expect(emailInput.first()).toBeVisible({ timeout: 5000 });
    await assertNoHorizontalOverflow(page);
  });
});
