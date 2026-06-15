import type { Page } from '@playwright/test';
import { loginAs } from './auth';

const TIMEOUT = 30_000;

/** Try to click the first matching element (link or button). Returns true on success. */
export async function tryClick(page: Page, patterns: RegExp[]): Promise<boolean> {
  for (const pattern of patterns) {
    const el = page
      .getByRole('link', { name: pattern })
      .or(page.getByRole('button', { name: pattern }))
      .first();
    try {
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click();
        return true;
      }
    } catch {
      // try next
    }
  }
  return false;
}

/** Wait for a text pattern to appear on the page. Returns true if visible within timeout. */
export async function waitForText(page: Page, pattern: RegExp, timeout = 5000): Promise<boolean> {
  try {
    await page.getByText(pattern).first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Perform admin login using TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD env vars.
 * @throws if env vars are missing or login fails
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD not set');
  }
  await loginAs(page, email, password);
}

/**
 * Navigate to the first available league detail page.
 * Fetches a league ID via the API, then navigates directly — avoids fragile
 * DOM selectors (league Cards use onClick router.push, not <a> tags).
 * @returns the league UUID, or null if no leagues exist
 */
export async function navigateToFirstLeague(page: Page): Promise<string | null> {
  const res = await page.request.get('/api/leagues');
  if (!res.ok()) return null;

  const data = await res.json();
  const leagues: { id: string }[] = data.leagues ?? [];
  if (leagues.length === 0) return null;

  const leagueId = leagues[0].id;
  await page.goto(`/admin/leagues/${leagueId}`, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT,
  });

  return leagueId;
}

/**
 * Navigate to the first available season detail page.
 * Fetches a season ID via the API, then navigates directly — avoids fragile
 * DOM selectors (season Cards use onClick router.push, not <a> tags).
 * @returns the season UUID, or null if no seasons exist
 */
export async function navigateToFirstSeason(page: Page): Promise<string | null> {
  const res = await page.request.get('/api/seasons');
  if (!res.ok()) return null;

  const data = await res.json();
  const seasons: { id: string }[] = data.seasons ?? [];
  if (seasons.length === 0) return null;

  const seasonId = seasons[0].id;
  await page.goto(`/admin/seasons/${seasonId}`, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT,
  });

  return seasonId;
}
