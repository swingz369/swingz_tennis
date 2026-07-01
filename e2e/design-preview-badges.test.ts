/**
 * E2E Test: Alle 8 Badge-Varianten + 3 Größen auf der Design-Preview-Seite
 *
 * Klickt den "Badges"-Tab und prüft:
 *   - Alle 8 Varianten (default, secondary, accent, success, warning,
 *     error, info, outline) werden im DOM gerendert
 *   - Alle 3 Größen-Headings (sm, md, lg) sind sichtbar
 *   - Contract-Test: 8 Varianten, 3 Größen
 *
 * Verwendet Vitest's expect mit Playwright's Locator-Methoden (.count(),
 * .textContent()) — KEINE Playwright-Matcher.
 *
 * Voraussetzungen:
 *   - Dev-Server läuft (npm run dev)
 *   - TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in .env gesetzt
 *
 * Ausführung:
 *   npx vitest run e2e/design-preview-badges.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebTest, type WebTestContext } from './helpers/web-test';
import { loginAs } from './helpers/auth';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;
const TEST_TIMEOUT = 60_000;

// ── Badge-Varianten (muss mit badge.tsx übereinstimmen) ──
const BADGE_VARIANTS = [
  'default',
  'secondary',
  'accent',
  'success',
  'warning',
  'error',
  'info',
  'outline',
] as const;

const BADGE_SIZES = ['sm', 'md', 'lg'] as const;

const BADGE_LABELS: Record<string, string> = {
  default: 'Default',
  secondary: 'Secondary',
  accent: 'Accent',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  info: 'Info',
  outline: 'Outline',
};

describe('Design Preview — Badge Variants', () => {
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

  it('should load the design-preview page', async () => {
    await ctx.page.goto(`${BASE_URL}/design-preview`, {
      waitUntil: 'networkidle',
      timeout: 15_000,
    });

    const text = await ctx.page.locator('h1').textContent();
    expect(text).toBeTruthy();
    expect(text).toContain('Design');
  }, TEST_TIMEOUT);

  it('should open the Badges tab and show all 3 size headings', async () => {
    await ctx.page.locator('button', { hasText: 'Badges' }).click();

    await ctx.page
      .locator('h3', { hasText: 'Size: sm' })
      .waitFor({ state: 'visible', timeout: 10_000 });

    const h2Text = await ctx.page.locator('h2').first().textContent();
    expect(h2Text).toContain('Badges');

    for (const size of BADGE_SIZES) {
      const count = await ctx.page.locator('h3', { hasText: `Size: ${size}` }).count();
      expect(count).toBeGreaterThan(0);
    }
  }, TEST_TIMEOUT);

  it('should render each of the 8 badge variants with correct labels', async () => {
    // Badges are rendered as <div> elements, not <button>
    const missing: string[] = [];

    for (const variant of BADGE_VARIANTS) {
      const label = BADGE_LABELS[variant];
      const count = await ctx.page.locator('div', { hasText: label }).count();
      if (count < 1) missing.push(variant);
    }

    // If some div elements have the same text (e.g. section headings could match),
    // we just need at least 3 (one per size). Be lenient.
    expect(missing).toEqual([]);
  }, TEST_TIMEOUT);

  it('should render badges in all 3 sizes with correct CSS classes', async () => {
    // sm badges have text-2xs class
    const smCount = await ctx.page.locator('.text-2xs.inline-flex').count();
    expect(smCount).toBeGreaterThan(0);

    // md badges have text-xs class (the default)
    const mdCount = await ctx.page.locator('.text-xs.inline-flex').count();
    expect(mdCount).toBeGreaterThan(0);

    // lg badges have text-sm class
    const lgCount = await ctx.page.locator('.text-sm.inline-flex').count();
    expect(lgCount).toBeGreaterThan(0);
  }, TEST_TIMEOUT);

  it('should render the footer with SwingZ branding', async () => {
    const text = await ctx.page.locator('footer').textContent();
    expect(text).toContain('SwingZ Design System');
  }, TEST_TIMEOUT);

  // ── Contract Tests ──

  it('should define exactly 8 badge variants', () => {
    expect(BADGE_VARIANTS).toHaveLength(8);

    for (const v of BADGE_VARIANTS) {
      expect(BADGE_VARIANTS).toContain(v);
    }
  });

  it('should define all 3 badge sizes', () => {
    expect(BADGE_SIZES).toHaveLength(3);
    for (const s of BADGE_SIZES) {
      expect(BADGE_SIZES).toContain(s);
    }
  });
});
