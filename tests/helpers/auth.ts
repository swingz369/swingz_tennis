import type { Page } from '@playwright/test';

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
      // Override window.location to prevent actual navigation during tests
      const originalLocation = window.location;

      // Store mock session in localStorage
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
