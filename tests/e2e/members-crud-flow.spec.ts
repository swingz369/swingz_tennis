import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

/**
 * Real Members CRUD flow (not just "page renders"): admin invites a member,
 * verifies it shows up in the list, then deactivates it again — the
 * end-to-end path a club admin actually uses day to day.
 */
test.describe('Admin: Members CRUD flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  test('invite member → appears in list → deactivate → status updates', async ({ page }) => {
    const unique = Date.now();
    const name = `E2E Testmitglied ${unique}`;
    const email = `e2e-member-${unique}@example.invalid`;

    await page.goto('/admin/members', { waitUntil: 'networkidle', timeout: 20000 });

    await page.getByRole('button', { name: /Mitglied einladen/i }).click();
    await page.locator('#invite_name').fill(name);
    await page.locator('#invite_email').fill(email);
    await page.getByRole('button', { name: /^Einladen$/ }).click();

    const row = page.locator('tr', { hasText: name });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByText('Aktiv', { exact: true })).toBeVisible();

    await row.getByTitle('Deaktivieren').click();
    await expect(row.getByText('Inaktiv', { exact: true })).toBeVisible({ timeout: 10000 });
  });
});
