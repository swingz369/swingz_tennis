import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const AUTH_DIR = path.resolve(__dirname, '../e2e/.auth');
// Supabase-Access-Token läuft nach 1h ab — Cache deutlich früher verwerfen
const STATE_MAX_AGE_MS = 30 * 60 * 1000;

function statePath(email: string): string {
  return path.join(AUTH_DIR, `${email.replace(/[^a-z0-9.@-]/gi, '_')}.json`);
}

function targetUrl(email: string): string {
  // Reihenfolge wichtig: "admin@swingz.com" (owner) enthält "admin" als Substring —
  // spezifischere Rollen-Checks müssen vor dem generischen admin-Check laufen.
  if (email === (process.env.TEST_OWNER_EMAIL ?? '__no_owner_email__')) return `${BASE_URL}/owner`;
  if (email.includes('superadmin')) return `${BASE_URL}/superadmin`;
  if (email.includes('admin')) return `${BASE_URL}/admin`;
  return `${BASE_URL}/member`;
}

/**
 * Real Supabase API login with storage-state cache: the first test per role
 * logs in and saves cookies to tests/e2e/.auth/; all later tests (any worker,
 * any browser project) reuse them instead of hitting the login endpoint.
 * @returns the role-appropriate target URL
 */
// ponytail: file cache instead of globalSetup — cold-start race costs at most
// one extra login per worker, still far below any rate limit
async function doLogin(page: Page, email: string, password: string): Promise<string> {
  const file = statePath(email);
  try {
    if (Date.now() - fs.statSync(file).mtimeMs < STATE_MAX_AGE_MS) {
      const state = JSON.parse(fs.readFileSync(file, 'utf8'));
      await page.context().addCookies(state.cookies ?? []);
      return targetUrl(email);
    }
  } catch {
    // kein (frischer) Cache → echter Login
  }

  const loginRes = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
  });
  if (!loginRes.ok()) {
    throw new Error(`Login failed (${loginRes.status()}): ${await loginRes.text()}`);
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: file });
  return targetUrl(email);
}

/**
 * Real API login for the given credentials.
 */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  const targetUrl = await doLogin(page, email, password);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
}

/**
 * Real API login — same as loginAs.
 * Use this for role-based access control tests.
 */
export async function loginAsRoleAware(page: Page, email: string, password: string): Promise<void> {
  const targetUrl = await doLogin(page, email, password);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
}

export async function mockAuthSession(page: Page, roles: string[]) {
  // Mock the auth session API
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: `test-${roles[0]}`,
          email: `${roles[0]}@test.com`,
          role: roles[0],
        },
        roles,
      }),
    });
  });

  // Mock the user roles API
  await page.route('**/api/user/roles', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ roles }),
    });
  });

  // Mock Supabase auth to avoid redirects
  await page.addInitScript(
    ({ roles }) => {
      void window.location;
      localStorage.setItem(
        'supabase.auth.token',
        JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: `test-${roles[0]}`,
            email: `${roles[0]}@test.com`,
            role: roles[0],
          },
        })
      );
    },
    { roles }
  );
}

export async function mockUnauthenticatedSession(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    });
  });

  await page.route('**/api/user/roles', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    });
  });
}
