import type { Page } from 'playwright';

// Note: we use APP_BASE_URL not BASE_URL — Vite hijacks process.env.BASE_URL
// and replaces it with "/" (the Vite base path) during transform.
const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

/**
 * Perform real Supabase API login via POST /api/auth/login.
 * Sends swingz_test_mode cookie header to bypass rate limiting.
 *
 * Adapted from tests/helpers/auth.ts for use with Midscene/Vitest
 * (uses plain Playwright `page` instead of @playwright/test fixture).
 */
async function doLogin(page: Page, email: string, password: string): Promise<string> {
  const loginRes = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
    headers: { Cookie: 'swingz_test_mode=true' },
  });
  if (!loginRes.ok()) {
    throw new Error(`Login failed (${loginRes.status()}): ${await loginRes.text()}`);
  }

  // Determine role-based target URL
  if (email.includes('superadmin')) return `${BASE_URL}/superadmin`;
  if (email.includes('admin')) return `${BASE_URL}/admin`;
  return `${BASE_URL}/member`;
}

/**
 * Login and navigate to the role-appropriate dashboard.
 * Uses real Supabase API login with swingz_test_mode for rate limit bypass.
 */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  const targetUrl = await doLogin(page, email, password);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
}
