import { test, expect } from '@playwright/test';
import { loginAsRoleAware } from '../helpers/auth';
import { runAxe } from './helpers/axe';

test.describe('Matchday regressions', () => {
  test('mobile profile keeps the identity visible and opens the SEPA flow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsRoleAware(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
    await page.goto('/member/profile');
    const title = page.locator('main h1');
    await expect(title).toBeVisible({ timeout: 30000 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(value);
      }, theme);
      expect(await title.evaluate((element) => element.clientWidth)).toBeGreaterThan(100);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      ).toBeLessThanOrEqual(1);
    }
    await page.getByRole('tab', { name: 'Zahlungen', exact: true }).click();
    const mandate = page.getByRole('link', { name: 'Mandat erteilen' });
    await expect(mandate).toBeVisible();
    await mandate.click();
    await expect(page).toHaveURL(/\/sepa-mandate$/, { timeout: 30000 });
    await expect(page.getByLabel('Kontoinhaber', { exact: false })).toBeVisible();
  });

  test('week calendar contains its wide grid and all courts stay reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsRoleAware(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    await page.goto('/admin/courts');
    await page.getByRole('button', { name: 'Woche', exact: true }).click();
    // The scroll container must contain the wide raster, including positioned cells.
    const scroller = page.locator('div.relative.overflow-x-auto.-mx-4').first();
    await expect(scroller).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    ).toBeLessThanOrEqual(1);
    const reached = await scroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      return element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
    });
    expect(reached).toBe(true);
    await page.setViewportSize({ width: 390, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    ).toBeLessThanOrEqual(1);
  });

  test('mobile members use cards and return focus after closing the invite dialog', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsRoleAware(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    await page.goto('/admin/members');
    await expect(page.getByRole('button', { name: 'Tabellenansicht', exact: true })).toBeVisible();
    const details = page.getByRole('link', { name: 'Details', exact: true }).first();
    expect(
      await details.evaluate((element) => element.getBoundingClientRect().height)
    ).toBeGreaterThanOrEqual(44);
    const trigger = page.getByRole('button', { name: 'Mitglied einladen', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Neues Mitglied einladen' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused();
    expect(await runAxe(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    ).toBeLessThanOrEqual(1);
  });

  test('qualification entry opens, validates and keeps errors visible', async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    await page.goto('/admin/trainers');
    await page.locator('main a[href^="/admin/trainers/"]:visible').first().click();
    await page.getByRole('tab', { name: /Qualifikationen/ }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Qualifikation hinzufügen' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Speichern', exact: true })).toBeDisabled();
    await dialog.getByLabel('Bezeichnung', { exact: false }).fill('Trainerzertifikat');
    await dialog.getByLabel('Aussteller', { exact: false }).fill('Tennisverband');
    await dialog.getByLabel('Ausgestellt am', { exact: false }).fill('2026-09-29');
    await page.route('**/api/trainer-profiles/*/qualifications', (route) =>
      route.fulfill({ status: 500, json: { error: 'Prüffehler' } })
    );
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('nicht gespeichert');
    await expect(dialog.getByLabel('Bezeichnung', { exact: false })).toHaveValue(
      'Trainerzertifikat'
    );
    // Exercise the successful UI response without writing a qualification to the DB.
    const id = new URL(page.url()).pathname.split('/').at(-1);
    const response = await page.request.get(`/api/trainer-profiles/${id}`);
    expect(response.ok()).toBe(true);
    const { trainerProfile } = await response.json();
    await page.unroute('**/api/trainer-profiles/*/qualifications');
    await page.route('**/api/trainer-profiles/*/qualifications', async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        name: 'Trainerzertifikat',
        issuer: 'Tennisverband',
        issuedDate: '2026-09-29',
      });
      await route.fulfill({
        json: {
          success: true,
          trainerProfile: {
            ...trainerProfile,
            qualifications: [
              ...(trainerProfile.qualifications || []),
              {
                id: 'redesign-regression',
                name: 'Trainerzertifikat',
                issuer: 'Tennisverband',
                issuedDate: '2026-09-29',
                verified: false,
              },
            ],
          },
        },
      });
    });
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.locator('main').getByText('Trainerzertifikat', { exact: true })
    ).toBeVisible();
  });
});
