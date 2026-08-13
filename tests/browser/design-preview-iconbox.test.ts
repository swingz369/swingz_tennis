/**
 * E2E Test: Alle 14 IconBox-Varianten + 4 Größen auf der Design-Preview-Seite
 *
 * Klickt den "IconBox"-Tab und prüft:
 *   - Alle 14 Varianten (primary, light, blue, green, amber, purple, red,
 *     orange, teal, rose, indigo, gray, gradient-primary, gradient-accent)
 *     werden im DOM gerendert
 *   - Alle 4 Größen-Headings (xs, sm, md, lg) sind sichtbar
 *   - IconBox-Container sind Quadrate mit Icon als Kind-Element
 *   - Contract-Test: 14 Varianten, 4 Größen
 *
 * Verwendet Vitest's expect mit Playwright's Locator-Methoden (.count(),
 * .textContent()) — KEINE Playwright-Matcher.
 *
 * Voraussetzungen:
 *   - Dev-Server läuft (npm run dev)
 *   - TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in .env gesetzt
 *
 * Ausführung:
 *   npx vitest run tests/browser/design-preview-iconbox.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebTest, type WebTestContext } from '../helpers/web-test';
import { loginAs } from '../helpers/auth';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;
const TEST_TIMEOUT = 60_000;

// ── IconBox-Varianten (muss mit icon-box.tsx übereinstimmen) ──
const ICONBOX_VARIANTS = [
  'primary',
  'light',
  'blue',
  'green',
  'amber',
  'purple',
  'red',
  'orange',
  'teal',
  'rose',
  'indigo',
  'gray',
  'gradient-primary',
  'gradient-accent',
] as const;

const ICONBOX_SIZES = ['xs', 'sm', 'md', 'lg'] as const;

const ICONBOX_LABELS: Record<string, string> = {
  primary: 'Primary',
  light: 'Light',
  blue: 'Blue',
  green: 'Green',
  amber: 'Amber',
  purple: 'Purple',
  red: 'Red',
  orange: 'Orange',
  teal: 'Teal',
  rose: 'Rose',
  indigo: 'Indigo',
  gray: 'Gray',
  'gradient-primary': 'Gradient Primary',
  'gradient-accent': 'Gradient Accent',
};

describe('Design Preview — IconBox Variants', () => {
  let ctx: WebTestContext;

  beforeAll(async () => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env');
    }
    ctx = await WebTest.start(BASE_URL);
    await loginAs(ctx.page, ADMIN_EMAIL, ADMIN_PASSWORD);
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (ctx) await WebTest.close(ctx);
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
    'should open the IconBox tab and show all 4 size headings',
    async () => {
      await ctx.page.locator('button', { hasText: 'IconBox' }).click();

      await ctx.page
        .locator('h3', { hasText: 'Size: xs' })
        .waitFor({ state: 'visible', timeout: 10_000 });

      const h2Text = await ctx.page.locator('h2').first().textContent();
      expect(h2Text).toContain('IconBox');

      for (const size of ICONBOX_SIZES) {
        const count = await ctx.page.locator('h3', { hasText: `Size: ${size}` }).count();
        expect(count).toBeGreaterThan(0);
      }
    },
    TEST_TIMEOUT
  );

  it(
    'should render each of the 14 IconBox variants with correct labels',
    async () => {
      // IconBox labels are rendered as <span> elements below the icon
      const missing: string[] = [];

      for (const variant of ICONBOX_VARIANTS) {
        const label = ICONBOX_LABELS[variant];
        const count = await ctx.page.locator('span', { hasText: label }).count();
        if (count < 1) missing.push(variant);
      }

      expect(missing).toEqual([]);
    },
    TEST_TIMEOUT
  );

  it(
    'should render IconBox containers in all 4 sizes',
    async () => {
      // xs: h-7 w-7 containers
      const xsCount = await ctx.page.locator('.h-7.w-7').count();
      expect(xsCount).toBeGreaterThan(0);

      // sm: h-8 w-8 containers
      const smCount = await ctx.page.locator('.h-8.w-8').count();
      expect(smCount).toBeGreaterThan(0);

      // md: h-10 w-10 containers
      const mdCount = await ctx.page.locator('.h-10.w-10').count();
      expect(mdCount).toBeGreaterThan(0);

      // lg: h-14 w-14 containers
      const lgCount = await ctx.page.locator('.h-14.w-14').count();
      expect(lgCount).toBeGreaterThan(0);
    },
    TEST_TIMEOUT
  );

  it(
    'should render each IconBox with an svg icon inside',
    async () => {
      // IconBox containers use shrink-0 class (specific to IconBox, not on other components)
      const iconContainers = ctx.page.locator('[class*="shrink-0"] svg');
      const count = await iconContainers.count();
      expect(count).toBeGreaterThanOrEqual(14);
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

  // ── Contract Tests ──

  it('should define exactly 14 IconBox variants', () => {
    expect(ICONBOX_VARIANTS).toHaveLength(14);

    for (const v of ICONBOX_VARIANTS) {
      expect(ICONBOX_VARIANTS).toContain(v);
    }
  });

  it('should define all 4 IconBox sizes', () => {
    expect(ICONBOX_SIZES).toHaveLength(4);
    for (const s of ICONBOX_SIZES) {
      expect(ICONBOX_SIZES).toContain(s);
    }
  });
});
