import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';

/**
 * Minimal stub replacing @midscene/web PlaywrightAgent.
 * Provides the same interface so existing E2E tests compile without @midscene.
 * AI-powered methods (aiAct, aiQuery, aiAssert) throw — use standard Playwright
 * methods (page.click, page.locator, etc.) for E2E tests.
 */
export class PlaywrightAgent {
  constructor(_page: Page, _opts?: unknown) {}

  async aiAct(_instruction: string): Promise<void> {
    throw new Error(
      '@midscene/web removed — use Playwright page methods directly (page.click, page.fill, etc.)'
    );
  }

  async aiQuery<T = unknown>(_instruction: string): Promise<T> {
    throw new Error(
      '@midscene/web removed — use Playwright page.locator() or page.evaluate() directly'
    );
  }

  async aiAssert(_assertion: string): Promise<void> {
    throw new Error('@midscene/web removed — use Playwright expect() assertions directly');
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- matches removed @midscene type
export interface WebPageAgentOpt {}

export interface WebTestContext {
  browser: Browser;
  page: Page;
  agent: PlaywrightAgent;
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
  static async start(url: string, opts?: WebPageAgentOpt): Promise<WebTestContext> {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const agent = new PlaywrightAgent(page, opts);
    return { browser, page, agent };
  }

  static async close(ctx: WebTestContext): Promise<void> {
    await ctx.browser.close();
  }
}
