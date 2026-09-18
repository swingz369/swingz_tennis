import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { navigateToFirstSeason } from '../helpers/navigation';

/**
 * Modal Centering Regression Test
 *
 * Verifies that the CenteredModal component (and any modal rendered via it)
 * is properly centered in the viewport on all admin routes. This is a
 * regression test for the createPortal fix (commit d8f338e) that guarantees
 * modals are not affected by ancestor `transform`/`filter`/`backdrop-filter`
 * containing blocks (which would break the
 * `min-h-dvh flex items-center justify-center` centering).
 *
 * For each route, the test:
 *   1. Logs in as admin (skips gracefully if creds missing / login fails).
 *   2. Navigates to the route.
 *   3. Tries to open the most common modal on that route.
 *   4. Asserts the dialog's bounding-box center is within tolerance of the
 *      viewport center.
 *
 * Skips individual tests if no modal trigger button is found (e.g. empty
 * admin state in dev), so the test is robust on fresh databases.
 *
 * The bounding-box assertion catches regressions like:
 *   - Modal renders inside a transformed/filtered ancestor (centering broken)
 *   - Modal renders with `items-center` only (centers against own height, not viewport)
 *   - Missing `min-h-dvh` (overlay collapses, modal sticks to top)
 */

const CENTERING_TOLERANCE_PX = 50;

/**
 * Asserts that the first visible role="dialog" is centered in the viewport.
 */
async function assertModalCentered(page: Page, label: string) {
  const dialog = page.getByRole('dialog').first();
  await expect(dialog, `Dialog for "${label}" should be visible`).toBeVisible({
    timeout: 5000,
  });

  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();

  expect(box, `Modal "${label}" has no bounding box`).not.toBeNull();
  expect(viewport, 'No viewport size').not.toBeNull();
  if (!box || !viewport) return; // type narrowing for the assertions below

  const dialogCenterX = box.x + box.width / 2;
  const dialogCenterY = box.y + box.height / 2;
  const viewportCenterX = viewport.width / 2;
  const viewportCenterY = viewport.height / 2;

  const xOffset = Math.abs(dialogCenterX - viewportCenterX);
  const yOffset = Math.abs(dialogCenterY - viewportCenterY);

  // Provide useful failure context (viewport + box dimensions) so a regression
  // in a future change is easy to diagnose.
  const context =
    `Modal "${label}" — ` +
    `box: x=${box.x.toFixed(0)} y=${box.y.toFixed(0)} ` +
    `w=${box.width.toFixed(0)} h=${box.height.toFixed(0)}, ` +
    `viewport: ${viewport.width}x${viewport.height}, ` +
    `center offsets: x=${xOffset.toFixed(0)}px y=${yOffset.toFixed(0)}px ` +
    `(tolerance: ${CENTERING_TOLERANCE_PX}px)`;

  expect(xOffset, `${context} — horizontal center off`).toBeLessThan(CENTERING_TOLERANCE_PX);
  expect(yOffset, `${context} — vertical center off`).toBeLessThan(CENTERING_TOLERANCE_PX);
}

/**
 * Tries to open a modal by clicking the first visible button matching any
 * of the given name patterns. Returns true if a click happened.
 */
async function tryOpenModalByButton(page: Page, patterns: RegExp[]): Promise<boolean> {
  for (const pattern of patterns) {
    const btn = page.getByRole('button', { name: pattern }).first();
    try {
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click();
        return true;
      }
    } catch {
      // Try the next pattern
    }
  }
  return false;
}

test.describe('Modal Centering Regression', () => {
  test.beforeEach(async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    test.skip(!email || !password, 'TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD not set in env');
    try {
      await loginAs(page, email!, password!);
    } catch (e) {
      test.skip(
        true,
        `Admin login failed (likely no live Supabase): ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  });

  test('Billing: open a modal (Assign or Adhoc) → centered', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'networkidle', timeout: 20000 });

    const opened = await tryOpenModalByButton(page, [
      /mitglied.*zuweisen|zuweisen|assign/i,
      /ad-?hoc/i,
      /rechnung.*erstellen|new invoice/i,
    ]);
    test.skip(!opened, 'No modal trigger found on /admin/billing');

    await assertModalCentered(page, 'Billing');
  });

  test('Seasons: navigate to a season → open GroupChange → centered', async ({ page }) => {
    const seasonId = await navigateToFirstSeason(page);
    test.skip(!seasonId, 'No season found via API to navigate to');

    const opened = await tryOpenModalByButton(page, [
      /gruppe.*ändern|gruppe.*wechseln|group.*change/i,
    ]);
    test.skip(!opened, 'No GroupChange trigger found on season detail page');

    await assertModalCentered(page, 'Seasons GroupChange');
  });

  test('Trainers: open the Invite modal → centered', async ({ page }) => {
    await page.goto('/admin/trainers', { waitUntil: 'networkidle', timeout: 20000 });

    const opened = await tryOpenModalByButton(page, [
      /trainer.*einladen|einladen|invite/i,
      /neuer trainer|hinzufügen|new trainer/i,
    ]);
    test.skip(!opened, 'No Invite trigger found on /admin/trainers');

    await assertModalCentered(page, 'Trainers Invite');
  });
});
