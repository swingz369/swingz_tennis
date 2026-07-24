/**
 * E2E Test: Trainer Availability Manager (Playwright + Vitest)
 *
 * Abgedeckter Flow:
 *   Admin-Login → Verfügbarkeitsseite öffnen → Woche navigieren (Nächste/Vorherige/Heute)
 *   → Slots togglen (Preset-Chips) → Speichern → Neuladen → Persistenz verifizieren
 *
 * Voraussetzungen:
 *   - Dev-Server läuft (npm run dev)
 *   - TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in .env gesetzt
 *   - Trainer-Profil existiert (Admin muss auch Trainer-Rolle haben)
 *
 * Ausführung:
 *   npx vitest run e2e/trainer-availability.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Page } from 'playwright';
import { WebTest, type WebTestContext } from './helpers/web-test';
import { loginAs } from './helpers/auth';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// ═══ Test Credentials ═══
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;

// ═══ Timeouts ═══
const TEST_TIMEOUT = 120_000; // 2 min per phase
const NAV_TIMEOUT = 15_000;

// ═══ Helpers ═══

/** Wait for an element matching `selector` to be visible, polling up to `timeout` ms. */
async function waitForVisible(page: Page, selector: string, timeout = 10_000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

describe('Trainer Availability E2E', () => {
  let ctx: WebTestContext;

  beforeAll(async () => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env');
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (ctx) await WebTest.close(ctx);
  });

  // ════════════════════════════════════════════════════════════════
  // Phase 1: Admin login → navigate to Verfügbarkeit
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 1: Admin login → navigate to availability page',
    async () => {
      ctx = await WebTest.start(BASE_URL);

      // Login
      await loginAs(ctx.page, ADMIN_EMAIL, ADMIN_PASSWORD);

      // Navigate to trainer availability page
      await ctx.page.goto(`${BASE_URL}/trainer/availability`, {
        waitUntil: 'networkidle',
        timeout: NAV_TIMEOUT,
      });

      // Verify heading is visible
      const heading = ctx.page.getByRole('heading', { name: 'Verfügbarkeit' });
      await heading.waitFor({ state: 'visible', timeout: 10_000 });
      expect(await heading.isVisible()).toBe(true);

      // Verify "Heute" button exists
      const heuteButton = ctx.page.getByRole('button', { name: 'Heute' });
      expect(await heuteButton.isVisible()).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 2: Week navigation — Nächste Woche → Vorherige → Heute
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 2: Navigate weeks — next week changes date range, today returns to current week',
    async () => {
      const page = ctx.page;
      const heuteButton = page.getByRole('button', { name: 'Heute' });

      // Verify we're on current week — "Heute" should be disabled
      expect(await heuteButton.isDisabled()).toBe(true);

      // Click "Nächste Woche" (right chevron button with title)
      const nextWeekBtn = page.getByRole('button', { name: 'Nächste Woche' });
      await nextWeekBtn.click();
      await page.waitForTimeout(2000);

      // "Heute" should now be enabled (we navigated away from current week)
      expect(await heuteButton.isEnabled()).toBe(true);

      // Click "Vorherige Woche" (left chevron button with title)
      const prevWeekBtn = page.getByRole('button', { name: 'Vorherige Woche' });
      await prevWeekBtn.click();
      await page.waitForTimeout(2000);

      // Click "Heute" to return to current week
      await heuteButton.click();
      await page.waitForTimeout(2000);

      // Verify we're back to current week — "Heute" disabled again
      expect(await heuteButton.isDisabled()).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 3: Toggle slots → save → reload → verify persistence
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 3: Toggle preset slots → save → reload → verify slots persist',
    async () => {
      const page = ctx.page;

      // Ensure we're on current week
      const heuteButton = page.getByRole('button', { name: 'Heute' });
      if (!(await heuteButton.isDisabled())) {
        await heuteButton.click();
        await page.waitForTimeout(2000);
      }

      // Click preset chip "08:00" for Montag (Monday = second day card in DAYS array).
      // The component renders Sonntag first, so Montag's chips are at index 1 of all matching buttons.
      await page
        .locator('button')
        .filter({ hasText: /^08:00$/ })
        .nth(1)
        .click();
      await page.waitForTimeout(500);

      // Click preset chip "11:00" for Montag (same approach)
      await page
        .locator('button')
        .filter({ hasText: /^11:00$/ })
        .nth(1)
        .click();
      await page.waitForTimeout(500);

      // Verify at least 2 active chips are visible (bg-brand-primary class = active)
      const activeChips = page.locator('button.bg-brand-primary');
      expect(await activeChips.count()).toBeGreaterThanOrEqual(2);

      // Click "Speichern" button
      const saveBtn = page.getByRole('button', { name: 'Speichern' });
      await saveBtn.click();

      // Wait for save to complete — success message contains "gespeichert"
      const successMsg = await waitForVisible(page, 'text=/gespeichert/', 15_000);
      expect(successMsg).toBe(true);

      // Verify no error message
      const errorMsg = page.locator('.bg-error-50');
      expect(await errorMsg.count()).toBe(0);

      // Reload the page
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Verify at least 1 active chip persists after reload
      const activeChipsAfterReload = page.locator('button.bg-brand-primary');
      expect(await activeChipsAfterReload.count()).toBeGreaterThanOrEqual(1);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 4: Clear all slots → save → reload → verify empty
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 4: Clear all slots → save → reload → verify empty state',
    async () => {
      const page = ctx.page;

      // Click all active preset chips to deactivate them.
      // Playwright locators are "live" — nth(0) re-evaluates each iteration.
      const activeChips = page.locator('button.bg-brand-primary');
      const activeCount = await activeChips.count();

      for (let i = 0; i < activeCount; i++) {
        await activeChips.nth(0).click();
        await page.waitForTimeout(200);
      }

      // Save the cleared state
      const saveBtn = page.getByRole('button', { name: 'Speichern' });
      await saveBtn.click();
      await page.waitForTimeout(3000);

      // Reload
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Verify empty state — "Keine Verfügbarkeiten eingetragen" text visible
      const emptyMsg = page.getByText('Keine Verfügbarkeiten eingetragen');
      await emptyMsg.waitFor({ state: 'visible', timeout: 10_000 });
      expect(await emptyMsg.isVisible()).toBe(true);
    },
    TEST_TIMEOUT
  );
});
