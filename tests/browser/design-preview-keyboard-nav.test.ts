/**
 * E2E Test: Tab-Navigation durch alle 11 Design-Preview-Tabs via Keyboard
 *
 * Fokussiert jeden Tab-Button und aktiviert ihn mit Enter — verifiziert,
 * dass der korrekte Content geladen wird (h2-Section-Titel).
 *
 * Verwendet Vitest + Playwright (page.keyboard, page.locator, page.waitForSelector).
 *
 * Voraussetzungen:
 *   - Dev-Server läuft (npm run dev)
 *   - TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in .env gesetzt
 *
 * Ausführung:
 *   npx vitest run tests/browser/design-preview-keyboard-nav.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebTest, type WebTestContext } from '../helpers/web-test';
import { loginAs } from '../helpers/auth';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;
const TEST_TIMEOUT = 60_000;

// Must match the tabs array in app/(public)/design-preview/page.tsx
const ALL_TABS = [
  { id: 'colors', label: 'Farben', sectionTitle: 'Brand Colors' },
  { id: 'typography', label: 'Typografie', sectionTitle: 'Typografie' },
  { id: 'shadows', label: 'Schatten', sectionTitle: 'Schatten' },
  { id: 'glass', label: 'Glass', sectionTitle: 'Glass Morphism' },
  { id: 'radius', label: 'Radius', sectionTitle: 'Border Radius' },
  { id: 'animations', label: 'Animationen', sectionTitle: 'Animationen' },
  { id: 'spacing', label: 'Abstände', sectionTitle: 'Abstände' },
  { id: 'badges', label: 'Badges', sectionTitle: 'Badges' },
  { id: 'buttons', label: 'Buttons', sectionTitle: 'Buttons' },
  { id: 'iconbox', label: 'IconBox', sectionTitle: 'IconBox' },
  { id: 'interactive', label: 'Interaktion', sectionTitle: 'Interaktive Zustände' },
] as const;

describe('Design Preview — Keyboard Tab Navigation', () => {
  let ctx: WebTestContext;

  beforeAll(async () => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env');
    }
    ctx = await WebTest.start(BASE_URL);
    await loginAs(ctx.page, ADMIN_EMAIL, ADMIN_PASSWORD);
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await WebTest.close(ctx);
  });

  it(
    'should load the design-preview page',
    async () => {
      await ctx.page.goto(`${BASE_URL}/design-preview`, {
        waitUntil: 'networkidle',
        timeout: 15_000,
      });

      const text = await ctx.page.locator('h1').textContent();
      expect(text).toBeTruthy();
      expect(text).toContain('Design');
    },
    TEST_TIMEOUT
  );

  it(
    'should have all 11 tab buttons in the DOM',
    async () => {
      for (const tab of ALL_TABS) {
        const count = await ctx.page.locator('button', { hasText: tab.label }).count();
        expect(count).toBeGreaterThan(0);
      }
    },
    TEST_TIMEOUT
  );

  it(
    'should navigate through all 11 tabs using only keyboard (focus + Enter)',
    async () => {
      const failed: string[] = [];

      for (const tab of ALL_TABS) {
        // Focus the tab button via keyboard-accessible focus()
        const btn = ctx.page.locator('button', { hasText: tab.label }).first();
        await btn.focus();

        // Verify the button is actually focused
        const isFocused = await btn.evaluate((el) => document.activeElement === el);
        expect(isFocused).toBe(true);

        // Activate with Enter
        await ctx.page.keyboard.press('Enter');

        // Wait for the section to render — the section title is in an h2.
        // waitFor throws if the element doesn't appear, which fails the
        // test immediately with a clear error message showing which tab failed.
        try {
          await ctx.page
            .locator('h2', { hasText: tab.sectionTitle })
            .waitFor({ state: 'visible', timeout: 5_000 });
        } catch {
          failed.push(tab.label);
        }
      }

      expect(failed).toEqual([]);
    },
    TEST_TIMEOUT
  );

  it(
    'should navigate backwards through tabs using Shift+Tab',
    async () => {
      // Verify all tabs are focusable in reverse order using Shift+Tab.
      // We start by focusing the last tab, then Shift+Tab backwards.
      const REVERSE_TABS = [...ALL_TABS].reverse();

      // Focus the last tab directly
      const lastTab = ctx.page.locator('button', { hasText: REVERSE_TABS[0].label }).first();
      await lastTab.focus();

      let isFocused = await lastTab.evaluate((el) => document.activeElement === el);
      expect(isFocused).toBe(true);

      // Activate the last tab
      await ctx.page.keyboard.press('Enter');
      await ctx.page
        .locator('h2', { hasText: REVERSE_TABS[0].sectionTitle })
        .waitFor({ state: 'visible', timeout: 5_000 });

      // Now Shift+Tab backward through all remaining tabs
      for (let i = 1; i < REVERSE_TABS.length; i++) {
        await ctx.page.keyboard.press('Shift+Tab');

        const expectedLabel = REVERSE_TABS[i].label;
        const focusedBtn = ctx.page.locator('button', { hasText: expectedLabel }).first();

        isFocused = await focusedBtn.evaluate((el) => document.activeElement === el);
        expect(isFocused).toBe(true);

        // Activate and verify content
        await ctx.page.keyboard.press('Enter');
        await ctx.page
          .locator('h2', { hasText: REVERSE_TABS[i].sectionTitle })
          .waitFor({ state: 'visible', timeout: 5_000 });
      }
    },
    TEST_TIMEOUT
  );

  it(
    'should render the footer with SwingZ branding',
    async () => {
      const text = await ctx.page.locator('footer').textContent();
      expect(text).toContain('SwingZ Design System');
    },
    TEST_TIMEOUT
  );
});
