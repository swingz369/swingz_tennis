import { expect } from 'vitest';
import type { Page } from 'playwright';

/**
 * War bis 16.09.2026 identisch dupliziert in 4 design-preview-*.test.ts
 * (per tokensave-Redundanzscan gefunden, AST-isomorph, similarity 1.0).
 */
export async function expectFooterBranding(page: Page): Promise<void> {
  const text = await page.locator('footer').textContent();
  expect(text).toContain('SwingZ Design System');
}
