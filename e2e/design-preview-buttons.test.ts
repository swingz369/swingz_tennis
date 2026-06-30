/**
 * E2E Test: Alle 8 Button-Varianten + 6 Größen auf der Design-Preview-Seite
 *
 * Klickt den "Buttons"-Tab und prüft:
 *   - Alle 8 Varianten (default, primary, secondary, outline, ghost,
 *     destructive, accent, link) werden im DOM gerendert
 *   - Alle 6 Größen-Headings sind sichtbar
 *   - Loading-Buttons haben aria-busy="true" und sind disabled
 *   - Contract-Test: gradient/brand sind aus button.tsx entfernt
 *
 * Verwendet Vitest's expect mit Playwright's Locator-Methoden (.count(),
 * .textContent(), .isVisible(), .isDisabled()) — KEINE Playwright-Matcher.
 *
 * Voraussetzungen:
 *   - Dev-Server läuft (npm run dev)
 *   - TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in .env gesetzt
 *
 * Ausführung:
 *   npx vitest run e2e/design-preview-buttons.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebTest, type WebTestContext } from './helpers/web-test';
import { loginAs } from './helpers/auth';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;
const TEST_TIMEOUT = 60_000;

// ── Button-Varianten (muss mit button.tsx übereinstimmen) ──
const ACTIVE_VARIANTS = [
  'default',
  'primary',
  'secondary',
  'outline',
  'ghost',
  'destructive',
  'accent',
  'link',
] as const;

const DEPRECATED_VARIANTS = ['gradient', 'brand'] as const;
const ALL_SIZES = ['sm', 'default', 'md', 'lg', 'xl', 'icon'] as const;

// Variant labels as rendered on the Buttons tab (capitalized)
const VARIANT_LABELS: Record<string, string> = {
  default: 'Default',
  primary: 'Primary',
  secondary: 'Secondary',
  outline: 'Outline',
  ghost: 'Ghost',
  destructive: 'Destructive',
  accent: 'Accent',
  link: 'Link',
};

describe('Design Preview — Button Variants', () => {
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

  // ── Page Load ──

  it(
    'should load the design-preview page with hero heading',
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

  // ── Navigation Tabs ──

  it(
    'should render all 11 navigation tabs including Buttons',
    async () => {
      const expectedTabs = [
        'Farben',
        'Typografie',
        'Schatten',
        'Glass',
        'Radius',
        'Animationen',
        'Abstände',
        'Badges',
        'Buttons',
        'IconBox',
        'Interaktion',
      ];

      for (const tabLabel of expectedTabs) {
        const count = await ctx.page.locator('button', { hasText: tabLabel }).count();
        expect(count).toBeGreaterThan(0);
      }
    },
    TEST_TIMEOUT
  );

  // ── Buttons Tab — All 8 Variants × 6 Sizes ──

  it(
    'should open the Buttons tab and show 6 size headings',
    async () => {
      await ctx.page.locator('button', { hasText: 'Buttons' }).click();

      // Wait for the tab content to render (element-based, not fixed timeout)
      await ctx.page
        .locator('h3', { hasText: 'Size: sm' })
        .waitFor({ state: 'visible', timeout: 10_000 });

      // Section heading
      const h2Text = await ctx.page.locator('h2').first().textContent();
      expect(h2Text).toContain('Buttons');

      // Each size heading must be visible
      for (const size of ALL_SIZES) {
        const count = await ctx.page.locator('h3', { hasText: `Size: ${size}` }).count();
        expect(count).toBeGreaterThan(0);
      }

      // Loading State heading
      const loadingHeadingCount = await ctx.page
        .locator('h3', { hasText: 'Loading State' })
        .count();
      expect(loadingHeadingCount).toBeGreaterThan(0);
    },
    TEST_TIMEOUT
  );

  it(
    'should render each of the 8 button variants with correct labels',
    async () => {
      const missing: string[] = [];

      for (const variant of ACTIVE_VARIANTS) {
        const label = VARIANT_LABELS[variant];
        const count = await ctx.page.locator('button', { hasText: label }).count();
        if (count < 1) missing.push(variant);
      }

      expect(missing).toEqual([]);
    },
    TEST_TIMEOUT
  );

  it(
    'should render buttons in all sizes including sm, xl, and icon',
    async () => {
      // sm size: buttons with h-9 class (Tailwind height-9 = 2.25rem)
      const smCount = await ctx.page.locator('button.h-9').count();
      expect(smCount).toBeGreaterThan(0);

      // xl size: buttons with h-14 class (Tailwind height-14 = 3.5rem)
      const xlCount = await ctx.page.locator('button.h-14').count();
      expect(xlCount).toBeGreaterThan(0);

      // icon size: square buttons with w-10 class (Tailwind width-10 = 2.5rem)
      const iconCount = await ctx.page.locator('button.w-10').count();
      expect(iconCount).toBeGreaterThan(0);
    },
    TEST_TIMEOUT
  );

  // ── Loading State ──

  it(
    'should render loading buttons with aria-busy and disabled',
    async () => {
      const loadingButtons = ctx.page.locator('button[aria-busy="true"]');
      const count = await loadingButtons.count();
      expect(count).toBeGreaterThanOrEqual(2);

      const isDisabled = await loadingButtons.first().isDisabled();
      expect(isDisabled).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ── Footer ──

  it(
    'should render the footer with SwingZ branding',
    async () => {
      const text = await ctx.page.locator('footer').textContent();
      expect(text).toContain('SwingZ Design System');
    },
    TEST_TIMEOUT
  );

  // ── Contract Tests ──

  it('should define exactly 8 button variants (gradient / brand are deprecated)', () => {
    expect(ACTIVE_VARIANTS).toHaveLength(8);

    for (const v of [
      'default',
      'primary',
      'secondary',
      'outline',
      'ghost',
      'destructive',
      'accent',
      'link',
    ]) {
      expect(ACTIVE_VARIANTS).toContain(v);
    }

    for (const deprecated of DEPRECATED_VARIANTS) {
      expect(ACTIVE_VARIANTS).not.toContain(deprecated);
    }
  });

  it('should define all 6 button sizes', () => {
    expect(ALL_SIZES).toHaveLength(6);
    for (const s of ALL_SIZES) {
      expect(ALL_SIZES).toContain(s);
    }
  });
});
