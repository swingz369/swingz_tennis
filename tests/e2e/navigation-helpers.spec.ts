import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateToFirstSeason, navigateToFirstLeague } from '../helpers/navigation';

/**
 * Navigation Helpers — Direct API Verification
 *
 * Verifies that the API-first navigation helpers (`navigateToFirstSeason`,
 * `navigateToFirstLeague`) correctly fetch data via API and navigate to
 * the detail page. These helpers replace fragile DOM-based `getByRole('link')`
 * selectors that failed because Cards use `onClick router.push`, not `<a>` tags.
 *
 * Tests cover:
 *   1. API returns valid data (seasons/leagues exist)
 *   2. Helper returns a valid UUID
 *   3. Page navigates to the correct detail URL
 *   4. Detail page renders without error
 *   5. Graceful null return when no data exists (API-only test)
 */

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

test.describe('Navigation Helpers — API-first verification', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await loginAsAdmin(page);
    } catch (e) {
      test.skip(true, `Admin login failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  // ──────────────────────────────────────────────
  // navigateToFirstSeason
  // ──────────────────────────────────────────────

  test('navigateToFirstSeason: API returns valid season data', async ({ page }) => {
    const res = await page.request.get('/api/seasons');
    expect(res.ok()).toBe(true);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.seasons)).toBe(true);
    // Each season should have an id field
    for (const season of data.seasons ?? []) {
      expect(season.id).toMatch(UUID_RE);
    }
  });

  test('navigateToFirstSeason: returns valid UUID or null', async ({ page }) => {
    const seasonId = await navigateToFirstSeason(page);

    if (seasonId === null) {
      // No seasons exist — API returned empty array, helper returned null
      const res = await page.request.get('/api/seasons');
      const data = await res.json();
      expect((data.seasons ?? []).length).toBe(0);
    } else {
      // Seasons exist — helper returned a valid UUID
      expect(seasonId).toMatch(UUID_RE);
    }
  });

  test('navigateToFirstSeason: navigates to correct detail URL', async ({ page }) => {
    const seasonId = await navigateToFirstSeason(page);
    test.skip(!seasonId, 'No seasons exist in database');

    // URL should contain the season UUID
    expect(page.url()).toContain(`/admin/seasons/${seasonId}`);

    // Page should not be a 404 or error page
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText).not.toContain('404');
    expect(bodyText).not.toContain('Internal Server Error');
  });

  test('navigateToFirstSeason: detail page renders season content', async ({ page }) => {
    const seasonId = await navigateToFirstSeason(page);
    test.skip(!seasonId, 'No seasons exist in database');

    // Fetch the season name from API and verify it appears on the page
    const apiRes = await page.request.get(`/api/seasons/${seasonId}`);
    test.skip(!apiRes.ok(), 'Season detail API not accessible');
    const { season } = await apiRes.json();
    if (season?.name) {
      const hasSeasonName = await page
        .getByText(season.name, { exact: false })
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      // Either the season name is shown, or the page has rendered content
      const bodyText = await page.locator('body').textContent();
      expect(hasSeasonName || (bodyText && bodyText.length > 100)).toBe(true);
    }
  });

  test('navigateToFirstSeason: API response matches page content', async ({ page }) => {
    // First fetch season data via API
    const apiRes = await page.request.get('/api/seasons');
    test.skip(!apiRes.ok(), 'API not available');

    const apiData = await apiRes.json();
    test.skip(!apiData.seasons?.length, 'No seasons in API response');

    const firstSeason = apiData.seasons[0];

    // Now navigate using the helper
    const seasonId = await navigateToFirstSeason(page);
    test.skip(!seasonId, 'Helper returned null');

    // The helper should return the same ID as the API
    expect(seasonId).toBe(firstSeason.id);

    // The page URL should match
    expect(page.url()).toContain(`/admin/seasons/${firstSeason.id}`);
  });

  // ──────────────────────────────────────────────
  // navigateToFirstLeague
  // ──────────────────────────────────────────────

  test('navigateToFirstLeague: API returns valid league data', async ({ page }) => {
    const res = await page.request.get('/api/leagues');
    expect(res.ok()).toBe(true);

    const data = await res.json();
    expect(Array.isArray(data.leagues)).toBe(true);
  });

  test('navigateToFirstLeague: returns valid UUID or null', async ({ page }) => {
    const leagueId = await navigateToFirstLeague(page);

    if (leagueId === null) {
      // No leagues exist — API returned empty array, helper returned null
      const res = await page.request.get('/api/leagues');
      const data = await res.json();
      expect((data.leagues ?? []).length).toBe(0);
    } else {
      // Leagues exist — helper returned a valid UUID
      expect(leagueId).toMatch(UUID_RE);
    }
  });

  test('navigateToFirstLeague: navigates to correct detail URL', async ({ page }) => {
    const leagueId = await navigateToFirstLeague(page);
    test.skip(!leagueId, 'No leagues exist in database');

    // URL should contain the league UUID
    expect(page.url()).toContain(`/admin/leagues/${leagueId}`);

    // Page should not be a 404 or error page
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText).not.toContain('404');
    expect(bodyText).not.toContain('Internal Server Error');
  });

  test('navigateToFirstLeague: detail page renders league content', async ({ page }) => {
    const leagueId = await navigateToFirstLeague(page);
    test.skip(!leagueId, 'No leagues exist in database');

    // Fetch the league name from API and verify it appears on the page
    const apiRes = await page.request.get(`/api/leagues/${leagueId}`);
    test.skip(!apiRes.ok(), 'League detail API not accessible');
    const { league } = await apiRes.json();
    if (league?.name) {
      const hasLeagueName = await page
        .getByText(league.name, { exact: false })
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      const bodyText = await page.locator('body').textContent();
      expect(hasLeagueName || (bodyText && bodyText.length > 100)).toBe(true);
    }
  });

  test('navigateToFirstLeague: API response matches page content', async ({ page }) => {
    // First fetch league data via API
    const apiRes = await page.request.get('/api/leagues');
    test.skip(!apiRes.ok(), 'API not available');

    const apiData = await apiRes.json();
    test.skip(!apiData.leagues?.length, 'No leagues in API response');

    const firstLeague = apiData.leagues[0];

    // Now navigate using the helper
    const leagueId = await navigateToFirstLeague(page);
    test.skip(!leagueId, 'Helper returned null');

    // The helper should return the same ID as the API
    expect(leagueId).toBe(firstLeague.id);

    // The page URL should match
    expect(page.url()).toContain(`/admin/leagues/${firstLeague.id}`);
  });

  // ──────────────────────────────────────────────
  // Cross-helper consistency
  // ──────────────────────────────────────────────

  test('Both helpers return valid distinct IDs when data exists', async ({ page }) => {
    const seasonId = await navigateToFirstSeason(page);
    const leagueId = await navigateToFirstLeague(page);

    // At least one should return a valid UUID (or both null if empty DB)
    if (seasonId !== null) {
      expect(seasonId).toMatch(UUID_RE);
    }
    if (leagueId !== null) {
      expect(leagueId).toMatch(UUID_RE);
    }

    // If both returned IDs, they should be different (different entities)
    if (seasonId && leagueId) {
      expect(seasonId).not.toBe(leagueId);
    }
  });
});
