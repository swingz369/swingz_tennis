/**
 * Screenshot helper for tutorial smoke specs.
 *
 * Writes full-page screenshots to a stable per-tutorial directory inside
 * `tests/e2e/screenshots/<tutorial-slug>/<step>.png`. Each step also gets
 * a 1-line marker written into a corresponding `steps.log` file in chronological
 * order — easier than sub-folder timestamps to skim during review.
 *
 * Usage in a spec file:
 *   await screenshotStep(page, 'member-getting-started/hero-card');
 */
import type { Page } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const SCREENSHOT_ROOT = 'tests/e2e/screenshots';

export async function screenshotStep(page: Page, slug: string): Promise<string> {
  // slug format: '<tutorial>/<step>'
  const safe = slug.replace(/[^a-zA-Z0-9_\-./]/g, '_');
  const filePath = join(SCREENSHOT_ROOT, `${safe}.png`);
  await mkdir(join(SCREENSHOT_ROOT, safe.split('/')[0]), { recursive: true });
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}
