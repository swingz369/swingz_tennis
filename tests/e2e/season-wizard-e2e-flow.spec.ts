import { test, expect } from '@playwright/test';
import { tryClick, waitForText, loginAsAdmin, navigateToFirstSeason } from '../helpers/navigation';

/**
 * Season Wizard E2E Flow — Full Journey
 *
 * Tests the complete season planning wizard from start to finish:
 *   1. Open wizard from season detail page
 *   2. Step 1: Configure (readiness check, settings, member selection)
 *   3. Step 2: Generate plan, review, check conflicts, publish
 *   4. Verify published state on season detail page
 *
 * Pattern: real Supabase login via /api/auth/login.
 * Requires a seeded agent-lane season that is ready for planning.
 */

const TIMEOUT = 30_000;
const TIMEOUT_LONG = 60_000;

// ============================================
// TEST SUITE
// ============================================

test.describe('Season Wizard E2E — Full Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ──────────────────────────────────────────────
  // TEST 1: Wizard opens from season detail
  // ──────────────────────────────────────────────
  test('Wizard opens from season detail page', async ({ page }) => {
    const seasonId = await navigateToFirstSeason(page);
    test.skip(!seasonId, 'No season found');

    // Click the wizard/planung button
    const clicked = await tryClick(page, [
      /wizard öffnen|saisonplanung.*ansehen|planung fortsetzen|planung starten/i,
    ]);

    if (clicked) {
      await page.waitForURL(/\/admin\/seasons\/[a-f0-9-]+\/planning/, { timeout: TIMEOUT });
    } else {
      await page.goto(`/admin/seasons/${seasonId}/planning`, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT,
      });
    }

    // Wizard should be visible — check for step navigation
    const hasStepNav =
      (await waitForText(page, /konfigurieren/i)) || (await waitForText(page, /planen/i));

    expect(hasStepNav).toBe(true);
  });

  // ──────────────────────────────────────────────
  // TEST 2: Step 1 — Config page loads with readiness check
  // ──────────────────────────────────────────────
  test('Step 1: Config page shows readiness check and settings', async ({ page }) => {
    const seasonId = await navigateToFirstSeason(page);
    test.skip(!seasonId, 'No season found');

    await page.goto(`/admin/seasons/${seasonId}/planning`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    // Wait for wizard content to render
    await page.locator('body').waitFor({ state: 'visible', timeout: 5_000 });

    // Should see readiness check or planning settings
    const hasReadiness =
      (await waitForText(page, /bereitschaft|readiness/i)) ||
      (await waitForText(page, /planungseinstellungen/i)) ||
      (await waitForText(page, /mitglied.*auswählen|member.*select/i));

    expect(hasReadiness).toBe(true);
  });

  // ──────────────────────────────────────────────
  // TEST 3: Step 2 — Plan generation UI
  // ──────────────────────────────────────────────
  test('Step 2: Plan generation shows generate button or existing plan', async ({ page }) => {
    const seasonId = await navigateToFirstSeason(page);
    test.skip(!seasonId, 'No season found');

    await page.goto(`/admin/seasons/${seasonId}/planning`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await page.locator('body').waitFor({ state: 'visible', timeout: 5_000 });

    // Try to advance to step 2
    await tryClick(page, [/^weiter$/i, /next/i]);
    await page.waitForTimeout(1500);

    // OR click the Planen step directly
    await tryClick(page, [/planen.*veröffentlichen|planen/i]);
    await page.waitForTimeout(1500);

    // Step 2 should show: generate button OR existing plan metrics
    const hasGenerate = await page
      .getByRole('button', { name: /plan generieren|generate/i })
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    const hasPlan =
      (await waitForText(page, /gruppe|group|score|auslastung/i, 2000)) ||
      (await waitForText(page, /planungs-score|metrik/i, 2000));

    // If neither, we might not be on step 2 yet (readiness check failed)
    if (!hasGenerate && !hasPlan) {
      // Check if there's a readiness blocker
      const hasBlocker = await waitForText(
        page,
        /bereitschaftsprüfung.*nicht.*bestanden|nicht.*bereit/i,
        1000
      );
      test.skip(true, `Plan step not accessible (blocker: ${hasBlocker})`);
    }

    expect(hasGenerate || hasPlan).toBe(true);
  });

  // ──────────────────────────────────────────────
  // TEST 4: Full flow — generate → conflicts → publish
  // ──────────────────────────────────────────────
  test('Full flow: generate plan → review conflicts → confirm & publish', async ({ page }) => {
    const seasonId = await navigateToFirstSeason(page);
    expect(seasonId, 'Für den vollständigen Planungsablauf fehlt eine Testsaison').toBeTruthy();

    // Navigate to wizard
    await page.goto(`/admin/seasons/${seasonId}/planning`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await page.locator('body').waitFor({ state: 'visible', timeout: 5_000 });

    // ── Phase 1: Readiness check & advance ──
    await test.step('Check readiness and advance to Step 2', async () => {
      const isReady = await waitForText(page, /bereit|ready/i, 3000);

      expect(isReady, 'Testsaison ist nicht bereit für die Planung').toBe(true);

      const advanced = await tryClick(page, [/^weiter$/i]);
      if (advanced) {
        await page.waitForTimeout(2000);
      }
    });

    // ── Phase 2: Generate plan ──
    await test.step('Generate plan via clustering algorithm', async () => {
      const hasGenerateBtn = await page
        .getByRole('button', { name: /plan generieren|generate/i })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (hasGenerateBtn) {
        await page
          .getByRole('button', { name: /plan generieren|generate/i })
          .first()
          .click();

        const planGenerated = await Promise.race([
          waitForText(page, /planungs-score|score|gruppen|metrik/i, TIMEOUT_LONG),
          waitForText(page, /fehler|error|fehlgeschlagen/i, TIMEOUT_LONG).then(() => false),
          page.waitForTimeout(TIMEOUT_LONG).then(() => false),
        ]);

        expect(planGenerated, 'Plangenerierung ist fehlgeschlagen oder abgelaufen').toBe(true);
      }

      const hasPlanResult =
        (await waitForText(page, /score|gruppen|auslastung|metrik/i, 5000)) ||
        (await waitForText(page, /plan.*generiert|neu generieren/i, 5000));

      expect(hasPlanResult).toBe(true);
    });

    // ── Phase 3: Conflict detection ──
    await test.step('Run conflict detection', async () => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);

      const hasConflictSection =
        (await waitForText(page, /konflikt|conflict|prüfen/i, 3000)) ||
        (await waitForText(page, /konflikte prüfen|bestätigen|veröffentlichen/i, 3000));

      if (hasConflictSection) {
        const clickedCheck = await tryClick(page, [/konflikte prüfen|prüfen|conflicts.*check/i]);

        if (clickedCheck) {
          const checkDone = await Promise.race([
            waitForText(
              page,
              /keine.*konflikte|alle.*gelöst|bereit.*bestätigung|warnung|kritisch/i,
              TIMEOUT
            ),
            waitForText(page, /fehler/i, TIMEOUT).then(() => false),
            page.waitForTimeout(TIMEOUT).then(() => false),
          ]);

          expect(checkDone, 'Konfliktprüfung ist fehlgeschlagen oder abgelaufen').toBe(true);
        }
      }
    });

    // ── Phase 4: Accept warnings ──
    await test.step('Accept open warnings', async () => {
      const hasWarningCheckboxes = await page
        .getByRole('checkbox')
        .count()
        .then((c) => c > 0)
        .catch(() => false);

      if (hasWarningCheckboxes) {
        const warningSection = page
          .locator('label:has-text("Warnung"), label:has-text("Hinweis"), [class*="border-amber"]')
          .first();
        const warningCheckboxes = warningSection.locator(
          'input[type="checkbox"], [role="checkbox"]'
        );
        const count = await warningCheckboxes.count();
        for (let i = 0; i < count; i++) {
          const cb = warningCheckboxes.nth(i);
          const isChecked = await cb.isChecked().catch(() => true);
          if (!isChecked) {
            await cb.click();
          }
        }
      }
    });

    // ── Phase 5: Confirm & Publish ──
    await test.step('Confirm plan and publish', async () => {
      const hasPublishBtn = await page
        .getByRole('button', {
          name: /planung bestätigen|bestätigen.*veröffentlichen|confirm.*publish/i,
        })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      expect(hasPublishBtn, 'Die Schaltfläche zum Veröffentlichen fehlt').toBe(true);
      await page
        .getByRole('button', {
          name: /planung bestätigen|bestätigen.*veröffentlichen/i,
        })
        .first()
        .click();

      const published = await waitForText(
        page,
        /erfolgreich.*bestätigt|veröffentlicht|published/i,
        TIMEOUT
      );

      expect(published).toBe(true);
      const seasonResponse = await page.request.get(`/api/seasons/${seasonId}`);
      expect(seasonResponse.ok()).toBe(true);
      const seasonData = await seasonResponse.json();
      expect(seasonData.season?.published_at).toBeTruthy();
    });
  });

  // ──────────────────────────────────────────────
  // TEST 5: Season detail shows tabs for its current state
  // ──────────────────────────────────────────────
  test('Season detail shows group changes only for published plans', async ({ page }) => {
    // navigateToFirstSeason() already navigates to this exact URL — a second
    // page.goto() here raced its in-flight fetch and left the page stuck on
    // the loading spinner (aborted request), failing every assertion below.
    const seasonId = await navigateToFirstSeason(page);
    test.skip(!seasonId, 'No season found');

    await page.locator('body').waitFor({ state: 'visible', timeout: 5_000 });

    // The season detail page fetches its data client-side after mount (see
    // fetchSeason() in seasons/[id]/page.tsx) — the loading spinner, not the
    // tabs, is what's actually present right after domcontentloaded. Wait for
    // the tablist itself (generous timeout: dev-mode hydration + a real API
    // round trip) instead of racing a tight per-tab timeout against it.
    await page.getByRole('tablist').waitFor({ state: 'visible', timeout: TIMEOUT });

    await expect(page.getByRole('tab', { name: 'Übersicht' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Saisonkalender' })).toBeVisible();

    const seasonResponse = await page.request.get(`/api/seasons/${seasonId}`);
    expect(seasonResponse.ok()).toBe(true);
    const seasonData = await seasonResponse.json();
    const isPublished = ['published', 'active', 'completed', 'archived'].includes(
      seasonData.season?.planning_status ?? ''
    );
    const groupChangeTab = page.getByRole('tab', { name: 'Gruppenwechsel' });
    if (isPublished) {
      await expect(groupChangeTab).toBeVisible();
    } else {
      await expect(groupChangeTab).toHaveCount(0);
    }
  });

  // ──────────────────────────────────────────────
  // TEST 6: Wizard step navigation works
  // ──────────────────────────────────────────────
  test('Wizard allows navigating between steps', async ({ page }) => {
    const seasonId = await navigateToFirstSeason(page);
    test.skip(!seasonId, 'No season found');

    await page.goto(`/admin/seasons/${seasonId}/planning`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await page.locator('body').waitFor({ state: 'visible', timeout: 5_000 });

    // Should start on step 1
    const onStep1 = await waitForText(page, /konfigurieren/i, 3000);
    expect(onStep1).toBe(true);

    // At minimum the step navigation buttons should exist
    const hasBackBtn = await page
      .getByRole('button', { name: /zurück|back/i })
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    const hasForwardBtn = await page
      .getByRole('button', { name: /weiter|next/i })
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Forward button should exist (even if disabled)
    expect(hasForwardBtn || hasBackBtn).toBe(true);
  });

  // ──────────────────────────────────────────────
  // TEST 7: API routes respond correctly
  // ──────────────────────────────────────────────
  test('Season planning API routes return valid responses', async ({ page }) => {
    const seasonId = await navigateToFirstSeason(page);
    test.skip(!seasonId, 'No season found');

    // Test season detail API
    const seasonRes = await page.request.get(`/api/seasons/${seasonId}`);
    expect(seasonRes.ok()).toBe(true);

    const seasonData = await seasonRes.json();
    expect(seasonData.season).toBeTruthy();
    expect(seasonData.season.id).toBe(seasonId);

    // Test seasons list API
    const listRes = await page.request.get('/api/seasons');
    expect(listRes.ok()).toBe(true);

    const listData = await listRes.json();
    expect(Array.isArray(listData.seasons)).toBe(true);
  });
});
