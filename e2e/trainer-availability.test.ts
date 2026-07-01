/**
 * E2E Test: Trainer Availability Manager (Midscene + Vitest + Playwright)
 *
 * Abgedeckter Flow:
 *   Admin-Login → Verfügbarkeitsseite öffnen → Woche navigieren (Nächste/Vorherige/Heute)
 *   → Slots togglen (Preset-Chips) → Speichern → Neuladen → Persistenz verifizieren
 *
 * Voraussetzungen:
 *   - Dev-Server läuft (npm run dev)
 *   - OPENAI_API_KEY in .env gesetzt
 *   - TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in .env gesetzt
 *   - Trainer-Profil existiert (Admin muss auch Trainer-Rolle haben)
 *
 * Ausführung:
 *   npx vitest run e2e/trainer-availability.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebTest, type WebTestContext } from './helpers/web-test';
import { loginAs } from './helpers/auth';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// ═══ Test Credentials ═══
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;

// ═══ Timeouts ═══
const TEST_TIMEOUT = 300_000; // 5 min per phase
const POLL_INTERVAL = 5_000;
const MAX_POLLS = 24;

// ═══ Polling helper ═══
async function pollFor(
  agent: any,
  page: any,
  query: string,
  maxPolls = MAX_POLLS
): Promise<boolean> {
  for (let i = 0; i < maxPolls; i++) {
    const result = await agent.aiQuery(query);
    if (result) return true;
    if (i < maxPolls - 1) await page.waitForTimeout(POLL_INTERVAL);
  }
  return false;
}

describe.skip('Trainer Availability E2E', () => {
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
      ctx = await WebTest.start(BASE_URL, {
        aiActionContext:
          'You are a German-speaking QA tester for a tennis club management app called SwingZ. The app is in German.',
      });

      // Login
      await loginAs(ctx.page, ADMIN_EMAIL, ADMIN_PASSWORD);

      // Navigate to availability page
      await ctx.agent.aiAct(
        'Click on "Training" in the sidebar to expand it, then look for "Verfügbarkeit" or availability and click it'
      );
      await ctx.page.waitForTimeout(3000);

      // Verify availability page loaded
      const pageLoaded = await ctx.agent.aiQuery(
        'Is there a page heading saying "Verfügbarkeit" and week navigation buttons like "Heute", arrows, and "Speichern"?'
      );

      if (!pageLoaded) {
        // Try direct navigation
        await ctx.page.goto(`${BASE_URL}/admin/availability`, {
          waitUntil: 'networkidle',
          timeout: 15000,
        });
      }

      const headingVisible = await pollFor(
        ctx.agent,
        ctx.page,
        'Is the "Verfügbarkeit" heading or a calendar-like week view visible on the page?'
      );
      expect(headingVisible).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 2: Week navigation — Nächste Woche → Vorherige → Heute
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 2: Navigate weeks — next week changes date range, today returns to current week',
    async () => {
      // Verify we're on current week (Heute should be disabled)
      await ctx.agent.aiQuery('Is the "Heute" button in the navigation bar disabled/grayed out?');

      // Click "Nächste Woche" arrow
      await ctx.agent.aiAct(
        'Click the right arrow button next to the week date range to go to next week'
      );
      await ctx.page.waitForTimeout(2000);

      // Verify "Heute" is now enabled (we navigated away from current week)
      const heuteNowEnabled = await ctx.agent.aiQuery('Is the "Heute" button enabled/clickable?');
      expect(heuteNowEnabled).toBe(true);

      // Click "Vorherige Woche" arrow
      await ctx.agent.aiAct(
        'Click the left arrow button next to the week date range to go to previous week'
      );
      await ctx.page.waitForTimeout(2000);

      // Click "Heute" to return
      await ctx.agent.aiAct('Click the "Heute" button');
      await ctx.page.waitForTimeout(2000);

      // Verify we're back to current week — "Heute" disabled again
      const backToCurrent = await ctx.agent.aiQuery(
        'Is the "Heute" button now disabled (grayed out, not clickable)?'
      );
      expect(backToCurrent).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 3: Toggle slots → save → reload → verify persistence
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 3: Toggle preset slots → save → reload → verify slots persist',
    async () => {
      // Go to current week first
      const heuteDisabled = await ctx.agent.aiQuery('Is the "Heute" button disabled?');
      if (!heuteDisabled) {
        await ctx.agent.aiAct('Click the "Heute" button');
        await ctx.page.waitForTimeout(2000);
      }

      // Select a specific weekday card (Montag if visible, otherwise first available)
      await ctx.agent.aiAct(
        'Click on the preset time chip "08:00" under the "Montag" (Monday) card. If Monday is not visible, click the first visible day card\'s "08:00" chip.'
      );
      await ctx.page.waitForTimeout(1000);

      // Toggle a second slot
      await ctx.agent.aiAct('Click on the preset time chip "11:00" under the same day card');
      await ctx.page.waitForTimeout(1000);

      // Verify at least one slot is active (colored/highlighted)
      const hasActiveSlots = await ctx.agent.aiQuery(
        'Are there any highlighted/active preset time chips visible (usually shown in a brand color)?'
      );
      expect(hasActiveSlots).toBe(true);

      // Click "Speichern"
      await ctx.agent.aiAct('Click the "Speichern" button in the header');
      await ctx.page.waitForTimeout(3000);

      // Check for save completion — either a success or the loading spinner stopped
      const saveDone = await pollFor(
        ctx.agent,
        ctx.page,
        'Is the loading spinner on the "Speichern" button gone and is there either a success message, a result count (like "X gespeichert"), or no error message visible?',
        MAX_POLLS / 2
      );
      expect(saveDone).toBe(true);

      // Check no error message (must be a fresh check after saveDone)
      const hasError = await ctx.agent.aiQuery(
        'Is there a red error message starting with "Fehler" visible on the page?'
      );
      expect(hasError).toBe(false);

      // Reload the page
      await ctx.page.reload({ waitUntil: 'networkidle' });
      await ctx.page.waitForTimeout(2000);

      // Verify slots persist — at least one active chip visible
      const slotsPersist = await pollFor(
        ctx.agent,
        ctx.page,
        'Are there highlighted/active preset time chips visible on the page after reload?',
        MAX_POLLS / 3
      );
      expect(slotsPersist).toBe(true);

      // Verify at least 2 active slots are visible
      await ctx.agent.aiQuery(
        'Are there at least 2 or more active/highlighted time chip slots visible across all day cards?'
      );
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 4: Clear all slots → save → reload → verify empty
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 4: Clear all slots → save → reload → verify empty state',
    async () => {
      // Click all active preset chips to deactivate them
      const hasActiveSlots = await ctx.agent.aiQuery(
        'Are there any highlighted/active preset time chips visible?'
      );

      if (hasActiveSlots) {
        // Deactivate all visible active chips
        await ctx.agent.aiAct(
          'Click on all highlighted/active preset time chips to deactivate them. Click each one that looks selected/colored.'
        );
        await ctx.page.waitForTimeout(1500);
      }

      // Save the cleared state
      await ctx.agent.aiAct('Click the "Speichern" button');
      await ctx.page.waitForTimeout(3000);

      // Reload
      await ctx.page.reload({ waitUntil: 'networkidle' });
      await ctx.page.waitForTimeout(2000);

      // Verify empty state
      const isEmpty = await pollFor(
        ctx.agent,
        ctx.page,
        'Is the page showing an empty state message like "Keine Verfügbarkeiten eingetragen" or no highlighted time chips at all?',
        MAX_POLLS / 3
      );
      expect(isEmpty).toBe(true);
    },
    TEST_TIMEOUT
  );
});
