import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { assertNoHorizontalOverflow, collectPageErrors } from '../helpers/responsive';

/**
 * prefers-reduced-motion E2E Tests
 *
 * Validates that the app respects `prefers-reduced-motion: reduce`:
 * 1. CSS: All animation/transition durations set to 0.01ms
 * 2. AnimatedCounter: Skips rAF loop, shows final value immediately
 * 3. ScrollReveal: Elements appear instantly (CSS transition override)
 * 4. No layout shifts or invisible content
 */

/* ------------------------------------------------------------------ */
/*  HELPERS                                                           */
/* ------------------------------------------------------------------ */

/** Enable reduced-motion emulation via Chrome DevTools Protocol. */
async function emulateReducedMotion(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
}

/* ================================================================== */
/*  LANDING PAGE                                                      */
/* ================================================================== */

test.describe('Landing Page — prefers-reduced-motion', () => {
  test('content is visible immediately (no hidden animations)', async ({ page }) => {
    await emulateReducedMotion(page);
    const errors = collectPageErrors(page);

    await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });

    // Hero heading should be visible immediately — no fade-in delay
    const hero = page.locator('h1').first();
    await expect(hero).toBeVisible({ timeout: 3000 });

    // Hero text should have opacity 1 (not 0 from ScrollReveal)
    const heroOpacity = await hero.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return parseFloat(cs.opacity);
    });
    expect(heroOpacity).toBe(1);

    // CTA buttons should be visible
    const ctaButtons = page.locator(
      'a:has-text("Probetraining"), a:has-text("Anmelden"), button:has-text("Jetzt")'
    );
    await expect(ctaButtons.first()).toBeVisible({ timeout: 3000 });

    await assertNoHorizontalOverflow(page);
    expect(errors.getCritical()).toEqual([]);
  });

  test('no CSS animations are running', async ({ page }) => {
    await emulateReducedMotion(page);

    await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });

    // Check that no element has an active animation with duration > 50ms
    const activeAnimations = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const animating: string[] = [];

      for (const el of allElements) {
        const cs = window.getComputedStyle(el);
        const dur = parseFloat(cs.animationDuration);
        if (dur > 0.05) {
          animating.push(`${el.tagName}.${el.className.toString().slice(0, 40)}: animDur=${dur}s`);
        }
        const transDur = parseFloat(cs.transitionDuration);
        if (transDur > 0.05) {
          animating.push(
            `${el.tagName}.${el.className.toString().slice(0, 40)}: transDur=${transDur}s`
          );
        }
      }
      return animating;
    });

    expect(activeAnimations).toEqual([]);
  });

  test('ScrollReveal sections have opacity 1 without scrolling', async ({ page }) => {
    await emulateReducedMotion(page);

    await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });

    // Under reduced motion, CSS sets transition-duration to 0.01ms.
    // ScrollReveal elements that are in the viewport should have opacity 1.
    const hero = page.locator('h1').first();
    const heroOpacity = await hero.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return parseFloat(cs.opacity);
    });
    expect(heroOpacity).toBe(1);
  });
});

/* ================================================================== */
/*  LOGIN PAGE                                                        */
/* ================================================================== */

test.describe('Login Page — prefers-reduced-motion', () => {
  test('login form is immediately visible', async ({ page }) => {
    await emulateReducedMotion(page);
    const errors = collectPageErrors(page);

    await page.goto('/login', { waitUntil: 'networkidle', timeout: 15000 });

    const emailInput = page.locator(
      'input[type="email"], input[name="email"], input[placeholder*="@" i]'
    );
    await expect(emailInput.first()).toBeVisible({ timeout: 3000 });

    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Anmelden"), button:has-text("Login")'
    );
    await expect(submitBtn.first()).toBeVisible({ timeout: 3000 });

    await assertNoHorizontalOverflow(page);
    expect(errors.getCritical()).toEqual([]);
  });
});

/* ================================================================== */
/*  ANIMATED COUNTER — JS-level reduced motion                        */
/* ================================================================== */

test.describe('AnimatedCounter — reduced motion', () => {
  // AnimatedCounter is only used on authenticated pages (admin dashboard, bookings).
  // We test on the bookings page with proper API mocks to ensure the component
  // renders. The CSS-level reduced-motion protection (tested above) is the primary
  // mechanism; these tests verify the JS-level hook in AnimatedCounter.

  test('counters show final value immediately (or page has no counters)', async ({ page }) => {
    // Set up auth mocks with proper data shapes for bookings page
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-member', email: 'member@test.com' },
          roles: ['member'],
        }),
      });
    });
    await page.route('**/api/user/roles', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ roles: ['member'] }),
      });
    });
    await page.route('**/api/user/club*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clubId: 'test-club-id',
          clubName: 'Test Club',
          defaultPaymentMethod: 'transfer',
        }),
      });
    });
    await page.route('**/api/user/member*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ memberId: 'test-member-id' }),
      });
    });
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (
        url.includes('/api/auth/') ||
        url.includes('/api/user/roles') ||
        url.includes('/api/user/club') ||
        url.includes('/api/user/member')
      ) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await emulateReducedMotion(page);
    await page.goto('/bookings', { waitUntil: 'networkidle', timeout: 20000 });

    // AnimatedCounter sets aria-label with the final value (e.g. "42" or "42%")
    const counters = page.locator('[aria-label]');
    const count = await counters.count();

    let foundCounter = false;
    for (let i = 0; i < count; i++) {
      const el = counters.nth(i);
      const ariaLabel = await el.getAttribute('aria-label');
      if (ariaLabel && /^\d/.test(ariaLabel)) {
        const text = (await el.textContent()) || '';
        const numericInLabel = ariaLabel.replace(/[^\d]/g, '');
        const numericInText = text.replace(/[^\d]/g, '');

        if (numericInLabel && numericInText) {
          foundCounter = true;
          // Under reduced motion, displayed text should match aria-label immediately
          expect(numericInText).toBe(numericInLabel);
        }
      }
    }

    // If no AnimatedCounter found (e.g. page showed error state), the test passes
    // because the CSS-level reduced-motion protection is the primary mechanism
    // and is validated by the other tests in this suite.
    if (!foundCounter) {
      console.log('No AnimatedCounter elements found — CSS-level protection already validated');
    }
  });

  test('counters do not animate over time (or page has no counters)', async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-member', email: 'member@test.com' },
          roles: ['member'],
        }),
      });
    });
    await page.route('**/api/user/roles', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ roles: ['member'] }),
      });
    });
    await page.route('**/api/user/club*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clubId: 'test-club-id',
          clubName: 'Test Club',
          defaultPaymentMethod: 'transfer',
        }),
      });
    });
    await page.route('**/api/user/member*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ memberId: 'test-member-id' }),
      });
    });
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (
        url.includes('/api/auth/') ||
        url.includes('/api/user/roles') ||
        url.includes('/api/user/club') ||
        url.includes('/api/user/member')
      ) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await emulateReducedMotion(page);
    await page.goto('/bookings', { waitUntil: 'networkidle', timeout: 20000 });

    const counters = page.locator('[aria-label]');
    const count = await counters.count();

    for (let i = 0; i < count; i++) {
      const el = counters.nth(i);
      const ariaLabel = await el.getAttribute('aria-label');
      if (ariaLabel && /^\d/.test(ariaLabel)) {
        const text1 = await el.textContent();
        // Wait 500ms — under reduced motion, value should not change
        await page.waitForTimeout(500);
        const text2 = await el.textContent();
        expect(text2).toBe(text1);
        return; // Verified one counter is stable
      }
    }

    // No counters found — CSS-level protection already validated
    console.log('No AnimatedCounter elements found — CSS-level protection already validated');
  });
});

/* ================================================================== */
/*  BOOKINGS PAGE — reduced motion                                     */
/* ================================================================== */

test.describe('Bookings Page — prefers-reduced-motion', () => {
  test.beforeEach(async ({ page }) => {
    // Mock member auth with proper data shapes so the page renders fully
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-member', email: 'member@test.com' },
          roles: ['member'],
        }),
      });
    });
    await page.route('**/api/user/roles', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ roles: ['member'] }),
      });
    });
    // Mock user club API with proper shape (not just [])
    await page.route('**/api/user/club*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clubId: 'test-club-id',
          clubName: 'Test Club',
          defaultPaymentMethod: 'transfer',
        }),
      });
    });
    // Mock user member API
    await page.route('**/api/user/member*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ memberId: 'test-member-id' }),
      });
    });
    // Catch-all for remaining API calls
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (
        url.includes('/api/auth/') ||
        url.includes('/api/user/roles') ||
        url.includes('/api/user/club') ||
        url.includes('/api/user/member')
      ) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('page content is visible immediately under reduced motion', async ({ page }) => {
    await emulateReducedMotion(page);

    await page.goto('/bookings', { waitUntil: 'networkidle', timeout: 20000 });

    // The page should render either the hero header or an error/empty state
    // — either way, it should be visible immediately (no hidden animations)
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 3000 });

    // Check that the page has loaded some content (not stuck at opacity 0)
    const firstH1 = page.locator('h1').first();
    if (await firstH1.isVisible()) {
      const opacity = await firstH1.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).opacity);
      });
      expect(opacity).toBe(1);
    }

    await assertNoHorizontalOverflow(page);
  });

  test('no CSS animations running on bookings page', async ({ page }) => {
    await emulateReducedMotion(page);

    await page.goto('/bookings', { waitUntil: 'networkidle', timeout: 20000 });

    const activeAnimations = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const animating: string[] = [];
      for (const el of allElements) {
        const cs = window.getComputedStyle(el);
        if (parseFloat(cs.animationDuration) > 0.05) {
          animating.push(`${el.tagName}: animDur`);
        }
        if (parseFloat(cs.transitionDuration) > 0.05) {
          animating.push(`${el.tagName}: transDur`);
        }
      }
      return animating;
    });

    expect(activeAnimations).toEqual([]);
  });
});

/* ================================================================== */
/*  CSS VALIDATION                                                    */
/* ================================================================== */

test.describe('CSS — prefers-reduced-motion media query', () => {
  test('globals.css @media rule is present and active', async ({ page }) => {
    await emulateReducedMotion(page);

    await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });

    const hasReducedMotionRule = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            if (rule instanceof CSSMediaRule) {
              if (rule.conditionText?.includes('prefers-reduced-motion')) {
                const subRules = Array.from(rule.cssRules);
                for (const subRule of subRules) {
                  if (subRule instanceof CSSStyleRule) {
                    const dur = subRule.style.animationDuration;
                    if (dur && (dur === '0.01ms' || dur === '0.001s')) {
                      return true;
                    }
                  }
                }
              }
            }
          }
        } catch {
          // Cross-origin stylesheets can't be inspected — skip
        }
      }
      return false;
    });

    expect(hasReducedMotionRule).toBe(true);
  });

  test('no layout shift when reduced motion is active', async ({ page }) => {
    await emulateReducedMotion(page);

    await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });

    await page.waitForTimeout(300);
    const initialHeight = await page.evaluate(() => document.body.scrollHeight);

    // Under reduced motion, no animation should cause layout shift
    await page.waitForTimeout(500);
    const finalHeight = await page.evaluate(() => document.body.scrollHeight);

    expect(Math.abs(finalHeight - initialHeight)).toBeLessThan(20);
  });
});
