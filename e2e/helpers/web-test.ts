import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';

export interface WebTestContext {
  browser: Browser;
  page: Page;
}

/**
 * WebTest helper for Vitest E2E tests.
 *
 * Usage in a Vitest test:
 * ```ts
 * const ctx = await WebTest.start('http://localhost:3000');
 * // Use ctx.page for Playwright interactions
 * await WebTest.close(ctx);
 * ```
 */
export class WebTest {
  static async start(url: string): Promise<WebTestContext> {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    return { browser, page };
  }

  static async close(ctx: WebTestContext): Promise<void> {
    await ctx.browser.close();
  }
}
