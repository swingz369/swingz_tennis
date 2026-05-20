import { chromium, Browser, Page } from 'playwright';
import { PlaywrightAgent, type WebPageAgentOpt } from '@midscene/web/playwright';

export interface WebTestContext {
  browser: Browser;
  page: Page;
  agent: PlaywrightAgent;
}

/**
 * WebTest helper for Vitest + Midscene E2E tests.
 *
 * Usage in a Vitest test:
 * ```ts
 * const ctx = await WebTest.start('http://localhost:3000');
 * await ctx.agent.aiAct('click the login button');
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

    // networkidle wartet, bis keine Netzwerk-Requests mehr ausstehen (React-Hydration abgeschlossen)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const agent = new PlaywrightAgent(page, opts);
    return { browser, page, agent };
  }

  static async close(ctx: WebTestContext): Promise<void> {
    await ctx.browser.close();
  }
}
