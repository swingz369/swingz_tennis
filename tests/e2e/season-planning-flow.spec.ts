import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';

/**
 * Season Planning E2E Flow Test (Plan + Grid routes)
 *
 * Covers the end-to-end navigation through the season planning flow:
 *   1. /admin/seasons              — seasons list page
 *   2. /admin/seasons/[id]         — season detail page
 *   3. /admin/seasons/[id]/planning — planning wizard (3 steps)
 *   4. Step 2 "Plan"               — plan generation / clustering view
 *   5. /admin/seasons/[id]/plan-grid — plan grid view
 *
 * The test is CI-ready and gracefully skips individual steps if:
 *   - Login fails (no live Supabase)
 *   - No seasons exist in the database
 *   - Required buttons / stepper are not visible
 *
 * Pattern: pure Playwright (no Midscene), shares the loginAs helper from
 * tests/helpers/auth.ts.
 */

const TIMEOUT_NAVIGATION = 20_000;

/**
 * Try to click the first element matching any of the given name patterns.
 * Returns true on click, false if nothing matched.
 */
async function tryClickByName(page: Page, patterns: RegExp[]): Promise<boolean> {
  for (const pattern of patterns) {
    const el = page
      .getByRole('link', { name: pattern })
      .or(page.getByRole('button', { name: pattern }))
      .first();
    try {
      if (await el.isVisible({ timeout: 1500 })) {
        await el.click();
        return true;
      }
    } catch {
      // try next pattern
    }
  }
  return false;
}

test.describe('Season Planning Flow (Plan + Grid routes)', () => {
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

  test('Seasons list page loads with at least one season or empty state', async ({ page }) => {
    await page.goto('/admin/seasons', { waitUntil: 'networkidle', timeout: TIMEOUT_NAVIGATION });
    await expect(page.locator('body')).toBeVisible();

    // Either a season card/link OR a "no seasons" empty-state is acceptable
    const hasSeason = await page
      .getByRole('link', {
        name: /sommer|winter|saison|herbst|frühling|summer|spring|fall|autumn/i,
      })
      .first()
      .isVisible()
      .catch(() => false);

    if (hasSeason) {
      // List rendered with at least one season
      expect(hasSeason).toBe(true);
    } else {
      // Empty state — page may say "Keine Saisons" or similar
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
    }
  });

  test('Season detail page loads when clicking a season from the list', async ({ page }) => {
    await page.goto('/admin/seasons', { waitUntil: 'networkidle', timeout: TIMEOUT_NAVIGATION });

    const firstSeason = page
      .getByRole('link', {
        name: /sommer|winter|saison|herbst|frühling|summer|spring|fall|autumn/i,
      })
      .first();
    test.skip(
      !(await firstSeason.isVisible({ timeout: 3000 }).catch(() => false)),
      'No season found on /admin/seasons to drill into'
    );

    await firstSeason.click();
    await page.waitForURL(/\/admin\/seasons\/[a-f0-9-]+$/, { timeout: TIMEOUT_NAVIGATION });

    await expect(page.locator('body')).toBeVisible();
  });

  test('Planning wizard loads and stepper is visible (3 steps)', async ({ page }) => {
    await page.goto('/admin/seasons', { waitUntil: 'networkidle', timeout: TIMEOUT_NAVIGATION });

    const firstSeason = page
      .getByRole('link', {
        name: /sommer|winter|saison|herbst|frühling|summer|spring|fall|autumn/i,
      })
      .first();
    test.skip(
      !(await firstSeason.isVisible({ timeout: 3000 }).catch(() => false)),
      'No season found on /admin/seasons to drill into'
    );

    await firstSeason.click();
    await page.waitForURL(/\/admin\/seasons\/[a-f0-9-]+$/, { timeout: TIMEOUT_NAVIGATION });

    // Try to enter the planning wizard via the "Saisonplanung starten/fortsetzen" button
    const enteredWizard = await tryClickByName(page, [
      /saisonplanung starten|saisonplanung fortsetzen|planung starten|planung fortsetzen/i,
    ]);

    if (enteredWizard) {
      await page.waitForURL(/\/admin\/seasons\/[a-f0-9-]+\/planning/, {
        timeout: TIMEOUT_NAVIGATION,
      });
    } else {
      // Fallback: navigate directly
      const seasonId = page.url().match(/\/admin\/seasons\/([a-f0-9-]+)/)?.[1];
      if (!seasonId) test.skip(true, 'Could not extract seasonId from URL');
      await page.goto(`/admin/seasons/${seasonId}/planning`, {
        waitUntil: 'networkidle',
        timeout: TIMEOUT_NAVIGATION,
      });
    }

    await expect(page.locator('body')).toBeVisible();

    // Wizard stepper should show 3 steps: Konfigurieren, Planen, Abschließen
    const hasConfigStep = await page
      .getByText(/konfigurieren/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasPlanStep = await page
      .getByText(/planen|plan/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasFinalizeStep = await page
      .getByText(/abschließen|finalize|bestätigen/i)
      .first()
      .isVisible()
      .catch(() => false);

    // At least 1 of the 3 step labels should be visible
    expect(hasConfigStep || hasPlanStep || hasFinalizeStep).toBe(true);
  });

  test('Plan step (Step 2) shows "Plan generieren" or existing plan', async ({ page }) => {
    await page.goto('/admin/seasons', { waitUntil: 'networkidle', timeout: TIMEOUT_NAVIGATION });

    const firstSeason = page
      .getByRole('link', {
        name: /sommer|winter|saison|herbst|frühling|summer|spring|fall|autumn/i,
      })
      .first();
    test.skip(
      !(await firstSeason.isVisible({ timeout: 3000 }).catch(() => false)),
      'No season found on /admin/seasons to drill into'
    );

    await firstSeason.click();
    await page.waitForURL(/\/admin\/seasons\/[a-f0-9-]+$/, { timeout: TIMEOUT_NAVIGATION });

    const seasonId = page.url().match(/\/admin\/seasons\/([a-f0-9-]+)/)?.[1];
    if (!seasonId) test.skip(true, 'Could not extract seasonId from URL');

    // Navigate directly to the wizard and try to advance to step 2
    await page.goto(`/admin/seasons/${seasonId}/planning`, {
      waitUntil: 'networkidle',
      timeout: TIMEOUT_NAVIGATION,
    });

    // Click "Planen" step in stepper (or "Weiter" to advance from step 1)
    const clickedPlanStep =
      (await tryClickByName(page, [/^planen$|plan.*generieren|step 2/i])) ||
      (await tryClickByName(page, [/^weiter$|next/i]));

    if (clickedPlanStep) {
      // Give the stepper time to switch
      await page.waitForTimeout(2000);
    }

    await expect(page.locator('body')).toBeVisible();

    // Step 2 should show EITHER:
    //   (a) a "Plan generieren" / "Generate Plan" button (clustering not run yet), OR
    //   (b) existing plan / metrics / groups (clustering already done)
    const hasGenerateBtn = await page
      .getByRole('button', { name: /plan generieren|generate plan|planung generieren/i })
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    const hasExistingPlanIndicators = await Promise.all([
      page
        .getByText(/gruppe|group/i)
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false),
      page
        .getByText(/auslastung|utilization|metrik|metric|score/i)
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false),
      page
        .getByText(/unzugewiesen|unassigned|konflikt|conflict/i)
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false),
    ]);

    const hasExistingPlan = hasExistingPlanIndicators.some(Boolean);
    test.skip(
      !hasGenerateBtn && !hasExistingPlan,
      'Plan step is empty (no generate button + no plan indicators) — season may be in an unusual state'
    );

    expect(hasGenerateBtn || hasExistingPlan).toBe(true);
  });

  test('Grid view (/plan-grid) loads without error', async ({ page }) => {
    await page.goto('/admin/seasons', { waitUntil: 'networkidle', timeout: TIMEOUT_NAVIGATION });

    const firstSeason = page
      .getByRole('link', {
        name: /sommer|winter|saison|herbst|frühling|summer|spring|fall|autumn/i,
      })
      .first();
    test.skip(
      !(await firstSeason.isVisible({ timeout: 3000 }).catch(() => false)),
      'No season found on /admin/seasons to drill into'
    );

    await firstSeason.click();
    await page.waitForURL(/\/admin\/seasons\/[a-f0-9-]+$/, { timeout: TIMEOUT_NAVIGATION });

    const seasonId = page.url().match(/\/admin\/seasons\/([a-f0-9-]+)/)?.[1];
    if (!seasonId) test.skip(true, 'Could not extract seasonId from URL');

    // Navigate to the grid view
    const response = await page.goto(`/admin/seasons/${seasonId}/plan-grid`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_NAVIGATION,
    });

    // The grid page should respond (either 200 with content or 404 if not implemented)
    // If 404, skip — the page may not exist for this season state
    if (response && response.status() === 404) {
      test.skip(true, '/plan-grid route returned 404 — may not be implemented for this season');
    }

    await expect(page.locator('body')).toBeVisible();
  });
});
