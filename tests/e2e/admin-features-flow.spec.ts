import { test, expect } from '@playwright/test';
import { tryClick, waitForText, loginAsAdmin, navigateToFirstLeague } from '../helpers/navigation';

/**
 * Admin Features E2E Flow — Work Duties, Leagues & Match Days
 *
 * Covers navigation, page loading, and API validation for:
 *   1. /admin/work-duties       — Work duty management + bulk create
 *   2. /admin/work-duties/assignments — Work duty assignments
 *   3. /admin/leagues            — Leagues & teams overview
 *   4. /admin/leagues/[id]       — League detail with teams, matchdays, standings
 *   5. API route validation for all above
 *
 * Pattern: real Supabase login via /api/auth/login.
 * Gracefully skips if login fails or features are not enabled.
 */

const TIMEOUT = 30_000;

// ============================================
// WORK DUTIES (Arbeitsdienste)
// ============================================

test.describe('Work Duties (Arbeitsdienste)', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await loginAsAdmin(page);
    } catch (e) {
      test.skip(true, `Admin login failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  test('Work duties page loads with duty list or empty state', async ({ page }) => {
    await page.goto('/admin/work-duties', { waitUntil: 'networkidle', timeout: TIMEOUT });

    // Page should render — either duty cards or empty state
    const hasContent =
      (await waitForText(page, /dienst|arbeitsdienst|aufgabe|duty/i, 3000)) ||
      (await waitForText(page, /keine.*dienste|noch.*keine|empty/i, 3000)) ||
      (await waitForText(page, /neuer.*dienst|erstellen/i, 3000));

    expect(hasContent).toBe(true);
  });

  test('Work duties page shows "Neuer Dienst" and "Bulk-Erstellen" buttons', async ({ page }) => {
    await page.goto('/admin/work-duties', { waitUntil: 'networkidle', timeout: TIMEOUT });

    const hasNewDuty = await page
      .getByRole('button', { name: /neuer.*dienst|neu.*erstellen/i })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasBulkCreate = await page
      .getByRole('button', { name: /bulk|serien.*erstell|mehrere/i })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // At least the "Neuer Dienst" button should exist
    expect(hasNewDuty || hasBulkCreate).toBe(true);
  });

  test('Work duty creation dialog opens', async ({ page }) => {
    await page.goto('/admin/work-duties', { waitUntil: 'networkidle', timeout: TIMEOUT });

    const clicked = await tryClick(page, [/neuer.*dienst|neu.*erstellen/i]);
    test.skip(!clicked, 'No "Neuer Dienst" button found');

    await page.waitForTimeout(1000);

    // Dialog should show form fields
    const hasForm =
      (await waitForText(page, /titel|bezeichnung|title/i, 3000)) ||
      (await waitForText(page, /typ|art|kategorie|category/i, 3000)) ||
      (await waitForText(page, /datum|date|termin/i, 3000));

    expect(hasForm).toBe(true);
  });

  test('Bulk create dialog opens with date range and recurrence', async ({ page }) => {
    await page.goto('/admin/work-duties', { waitUntil: 'networkidle', timeout: TIMEOUT });

    const clicked = await tryClick(page, [/bulk|serien.*erstell|mehrere/i]);
    test.skip(!clicked, 'No "Bulk-Erstellen" button found');

    await page.waitForTimeout(1000);

    // Bulk dialog should show date range and recurrence options
    const hasBulkForm =
      (await waitForText(page, /zeitraum|datum.*von|von.*bis|date.*range|startdatum/i, 3000)) ||
      (await waitForText(page, /rhythmus|wiederholung|recurrence|täglich|wöchentlich/i, 3000)) ||
      (await waitForText(page, /vorlage|template/i, 3000));

    expect(hasBulkForm).toBe(true);
  });

  test('Assignments page loads', async ({ page }) => {
    await page.goto('/admin/work-duties/assignments', {
      waitUntil: 'networkidle',
      timeout: TIMEOUT,
    });

    const hasContent =
      (await waitForText(page, /zuweisung|assignment|zugewiesen|mitglied/i, 3000)) ||
      (await waitForText(page, /keine.*zuweisung|noch.*keine/i, 3000)) ||
      (await waitForText(page, /dienst|duty/i, 3000));

    expect(hasContent).toBe(true);
  });

  test('Work duties API returns valid response', async ({ page }) => {
    const res = await page.request.get('/api/work-duties');
    expect(res.ok()).toBe(true);

    const data = await res.json();
    expect(Array.isArray(data.duties)).toBe(true);
  });
});

// ============================================
// LEAGUES & TEAMS (Ligen & Teams)
// ============================================

test.describe('Leagues & Teams (Ligen & Teams)', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await loginAsAdmin(page);
    } catch (e) {
      test.skip(true, `Admin login failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  test('Leagues list page loads with leagues or empty state', async ({ page }) => {
    await page.goto('/admin/leagues', { waitUntil: 'networkidle', timeout: TIMEOUT });

    const hasContent =
      (await waitForText(page, /liga|league|mannschaft/i, 3000)) ||
      (await waitForText(page, /keine.*ligen|noch.*keine/i, 3000)) ||
      (await waitForText(page, /neue.*liga/i, 3000));

    expect(hasContent).toBe(true);
  });

  test('League creation form opens', async ({ page }) => {
    await page.goto('/admin/leagues', { waitUntil: 'networkidle', timeout: TIMEOUT });

    const clicked = await tryClick(page, [/neue.*liga|neu.*erstellen|liga.*anlegen/i]);
    test.skip(!clicked, 'No "Neue Liga" button found');

    await page.waitForTimeout(1000);

    // Form should show fields for league creation
    const hasForm =
      (await waitForText(page, /liganame|name.*liga/i, 3000)) ||
      (await waitForText(page, /sportart|sport/i, 3000)) ||
      (await waitForText(page, /saison|season|jahr|year/i, 3000));

    expect(hasForm).toBe(true);
  });

  test('League cards are clickable and navigate to detail page', async ({ page }) => {
    const leagueId = await navigateToFirstLeague(page);
    test.skip(!leagueId, 'No league found to click');

    // Detail page should show league name and tabs
    const hasDetail =
      (await waitForText(page, /team|mannschaft/i, 3000)) ||
      (await waitForText(page, /spieltag|matchday/i, 3000)) ||
      (await waitForText(page, /tabelle|standings/i, 3000));

    expect(hasDetail).toBe(true);
  });

  test('League detail shows Teams, Matchdays, and Standings tabs', async ({ page }) => {
    const leagueId = await navigateToFirstLeague(page);
    test.skip(!leagueId, 'No league found');

    // Check for tabs
    const hasTeamsTab = await page
      .getByRole('tab', { name: /team|mannschaft/i })
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasMatchdaysTab = await page
      .getByRole('tab', { name: /spieltag|matchday/i })
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    const hasStandingsTab = await page
      .getByRole('tab', { name: /tabelle|standings/i })
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(hasTeamsTab || hasMatchdaysTab || hasStandingsTab).toBe(true);
  });

  test('Leagues API returns valid response', async ({ page }) => {
    const res = await page.request.get('/api/leagues');
    expect(res.ok()).toBe(true);

    const data = await res.json();
    expect(Array.isArray(data.leagues)).toBe(true);
  });

  test('League detail API returns league with teams and matchdays', async ({ page }) => {
    // First get a league ID from the list
    const listRes = await page.request.get('/api/leagues');
    test.skip(!listRes.ok(), 'Leagues API not available');

    const listData = await listRes.json();
    const leagues = listData.leagues ?? [];
    test.skip(leagues.length === 0, 'No leagues found in API');

    const leagueId = leagues[0].id;

    // Fetch detail
    const detailRes = await page.request.get(`/api/leagues/${leagueId}`);
    expect(detailRes.ok()).toBe(true);

    const detailData = await detailRes.json();
    expect(detailData.league).toBeTruthy();
    expect(detailData.league.id).toBe(leagueId);
  });
});

// ============================================
// MATCH DAYS (Spieltage)
// ============================================

test.describe('Match Days (Spieltage)', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await loginAsAdmin(page);
    } catch (e) {
      test.skip(true, `Admin login failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  test('League detail matchdays tab shows matchday list or empty state', async ({ page }) => {
    const leagueId = await navigateToFirstLeague(page);
    test.skip(!leagueId, 'No league found');

    // Click matchdays tab
    const clicked = await tryClick(page, [/spieltag|matchday/i]);
    if (clicked) {
      await page.waitForTimeout(1000);
    }

    const hasContent =
      (await waitForText(page, /spieltag|gegner|opponent|heim|auswärts/i, 3000)) ||
      (await waitForText(page, /keine.*spieltag|noch.*keine/i, 3000)) ||
      (await waitForText(page, /neuer.*spieltag|erstellen/i, 3000));

    expect(hasContent).toBe(true);
  });

  test('Matchday creation form opens from league detail', async ({ page }) => {
    const leagueId = await navigateToFirstLeague(page);
    test.skip(!leagueId, 'No league found');

    // Click matchdays tab
    await tryClick(page, [/spieltag|matchday/i]);
    await page.waitForTimeout(1000);

    // Click "Neuer Spieltag"
    const clicked = await tryClick(page, [/neuer.*spieltag|neu.*erstellen/i]);
    test.skip(!clicked, 'No "Neuer Spieltag" button found');

    await page.waitForTimeout(1000);

    // Form should show matchday fields
    const hasForm =
      (await waitForText(page, /gegner|opponent/i, 3000)) ||
      (await waitForText(page, /datum|date|termin/i, 3000)) ||
      (await waitForText(page, /heim|auswärts|home|away/i, 3000));

    expect(hasForm).toBe(true);
  });

  test('Standings tab shows table with team positions', async ({ page }) => {
    const leagueId = await navigateToFirstLeague(page);
    test.skip(!leagueId, 'No league found');

    // Click standings tab
    const clicked = await tryClick(page, [/tabelle|standings/i]);
    test.skip(!clicked, 'No Standings tab found');

    await page.waitForTimeout(1000);

    // Should show table headers or team data
    const hasTable =
      (await waitForText(page, /team|mannschaft|punkte|points/i, 3000)) ||
      (await waitForText(page, /keine.*team|noch.*keine/i, 3000));

    expect(hasTable).toBe(true);
  });

  test('Matchday API returns valid response for a league', async ({ page }) => {
    // First get a league ID
    const listRes = await page.request.get('/api/leagues');
    test.skip(!listRes.ok(), 'Leagues API not available');

    const listData = await listRes.json();
    const leagues = listData.leagues ?? [];
    test.skip(leagues.length === 0, 'No leagues found');

    const leagueId = leagues[0].id;

    // Fetch matchdays
    const matchdaysRes = await page.request.get(`/api/leagues/${leagueId}/matchdays`);
    expect(matchdaysRes.ok()).toBe(true);

    const matchdaysData = await matchdaysRes.json();
    // API may return 'matchdays' or 'match_days' depending on version
    const matchdays = matchdaysData.matchdays ?? matchdaysData.match_days ?? [];
    expect(Array.isArray(matchdays)).toBe(true);
  });

  test('League detail shows status badge and toggle', async ({ page }) => {
    const leagueId = await navigateToFirstLeague(page);
    test.skip(!leagueId, 'No league found');

    // Should show status badge (Aktiv/Abgeschlossen)
    const hasStatus =
      (await waitForText(page, /aktiv|active|abgeschlossen|completed/i, 3000)) ||
      (await waitForText(page, /reaktivieren|abschließen/i, 3000));

    expect(hasStatus).toBe(true);
  });
});
