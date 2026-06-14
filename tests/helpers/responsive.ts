import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Shared helpers for mobile-responsiveness and accessibility E2E tests.
 */

/** Assert document scrollWidth ≤ clientWidth (no horizontal scrollbar). */
export async function assertNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1 for sub-pixel rounding
}

/**
 * Collect page errors, deduplicating by message text.
 * Filters known benign patterns (404s, scroll-behavior warnings, cookies).
 */
export function collectPageErrors(page: Page) {
  const seen = new Set<string>();

  const onError = (msg: string) => {
    if (
      !msg.includes('404') &&
      !msg.includes('Failed to load resource') &&
      !msg.includes('scroll-behavior') &&
      !msg.includes('cookie') &&
      !msg.includes('cookieStore')
    ) {
      seen.add(msg);
    }
  };

  page.on('pageerror', (err) => onError(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') onError(msg.text());
  });

  return { getCritical: () => [...seen] };
}

/** Set up member auth mocks on the page. */
export async function mockMemberAuth(page: Page) {
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
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/auth/') || url.includes('/api/user/')) return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

/** Set up admin auth mocks on the page. */
export async function mockAdminAuth(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'test-admin', email: 'admin@test.com' },
        roles: ['admin'],
      }),
    });
  });
  await page.route('**/api/user/roles', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ roles: ['admin'] }),
    });
  });
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/auth/') || url.includes('/api/user/')) return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

/** Set up trainer auth mocks on the page. */
export async function mockTrainerAuth(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'test-trainer', email: 'trainer@test.com' },
        roles: ['trainer'],
      }),
    });
  });
  await page.route('**/api/user/roles', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ roles: ['trainer'] }),
    });
  });
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/auth/') || url.includes('/api/user/')) return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}
