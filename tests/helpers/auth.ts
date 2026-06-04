import type { Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

/**
 * Perform real Supabase API login for the given credentials.
 * @returns the role-appropriate target URL
 */
async function doLogin(page: Page, email: string, password: string): Promise<string> {
  const loginRes = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
  });
  if (!loginRes.ok()) {
    throw new Error(`Login failed (${loginRes.status()}): ${await loginRes.text()}`);
  }

  // Determine role-based target URL
  return email.includes('superadmin')
    ? `${BASE_URL}/superadmin`
    : email.includes('admin')
      ? `${BASE_URL}/admin`
      : `${BASE_URL}/member`;
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
