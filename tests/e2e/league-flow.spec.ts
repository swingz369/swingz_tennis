/**
 * Ligen & Teams — durchgehender Klickweg durch die Oberfläche.
 *
 * Deckt genau die Stellen ab, die beim Aufräumen des Moduls kaputt waren:
 *   1. Liga anlegen (inkl. eigener Mannschaft)
 *   2. Alle fünf Tabs erreichbar, Kader-Tab vorhanden
 *   3. Heimspieltag anlegen → Plätze sperren → Sperre aufheben
 *   4. Sync mit einer Nicht-nuLiga-URL scheitert mit deutscher Meldung
 *   5. Liga löschen — und sie ist nach dem Neuladen wirklich weg
 *      (vorher meldete die API Erfolg, ohne etwas zu löschen)
 *
 * Läuft in der Agent-Lane (TEST_ADMIN_* zeigt auf *.claude.test) und räumt
 * die angelegte Liga am Ende selbst wieder ab.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? '';

/** Eindeutiger Name, damit parallele Läufe sich nicht in die Quere kommen. */
const leagueName = `E2E Liga ${Date.now()}`;
const ownTeamName = 'E2E Testmannschaft I';

test.describe('Ligen & Teams — Klickweg', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'TEST_ADMIN_* nicht gesetzt');

  test.describe.configure({ mode: 'serial' });

  let leagueUrl = '';

  async function gotoLeagues(page: Page) {
    await page.goto('/admin/leagues', { waitUntil: 'domcontentloaded' });
    // Die Seite rendert clientseitig und der Dev-Server kompiliert on demand —
    // der Default von 5 s reicht dafür nicht verlässlich (siehe playwright.config.ts).
    await expect(page.getByRole('heading', { name: /ligen/i }).first()).toBeVisible({
      timeout: 30000,
    });
  }

  test('Reste früherer Läufe aufräumen', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Bricht ein Lauf in der Mitte ab, bleibt eine "E2E Liga …" stehen. Ohne
    // dieses Aufräumen sammeln sich sie in der Agent-Lane an.
    const csrf = (await page.context().cookies()).find((c) => c.name === 'csrf-token')?.value;
    const list = await (await page.request.get('/api/leagues')).json();
    for (const l of list.leagues ?? []) {
      if (typeof l.name === 'string' && l.name.startsWith('E2E Liga')) {
        await page.request.delete(`/api/leagues/${l.id}`, {
          headers: { 'x-csrf-token': csrf as string },
        });
      }
    }
  });

  test('Liga anlegen', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoLeagues(page);

    await page.getByRole('button', { name: /neue liga/i }).click();
    await page.getByLabel(/liganame/i).fill(leagueName);
    await page.getByLabel(/eigene mannschaft/i).fill(ownTeamName);
    await page.getByRole('button', { name: /liga erstellen/i }).click();

    await expect(page.getByText(leagueName)).toBeVisible({ timeout: 15000 });
  });

  test('Detailseite zeigt alle Tabs inklusive Kader', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoLeagues(page);

    await page.getByText(leagueName).click();
    await page.waitForURL(/\/admin\/leagues\/[0-9a-f-]{36}/, { timeout: 20000 });
    leagueUrl = page.url();

    for (const tab of ['Teams', 'Spieltage', 'Kader', 'Tabelle', 'Bewirtung']) {
      await expect(page.getByRole('tab', { name: new RegExp(tab, 'i') })).toBeVisible();
    }

    // Kader-Tab: Eingabefeld für die Mannschaftsseite ist da, Liste noch leer.
    await page.getByRole('tab', { name: /kader/i }).click();
    await expect(page.getByLabel(/url der mannschaftsseite/i)).toBeVisible();
    await expect(page.getByText(/noch kein kader übernommen/i)).toBeVisible();
  });

  test('Heimspieltag anlegen, Plätze sperren und wieder freigeben', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(leagueUrl, { waitUntil: 'domcontentloaded' });

    await page.getByRole('tab', { name: /spieltage/i }).click();
    await page.getByRole('button', { name: /neuer spieltag/i }).click();

    await page.getByLabel(/gegner/i).fill('E2E Gegner');
    // Datum in der Zukunft, damit die Sperre nicht in der Vergangenheit landet.
    const inTwoWeeks = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel(/datum/i).fill(inTwoWeeks);
    await page.getByRole('button', { name: /spieltag erstellen/i }).click();

    await expect(page.getByText('E2E Gegner')).toBeVisible({ timeout: 15000 });

    // Heimspiel ⇒ Platzsperre-Button ist da.
    const blockButton = page.getByRole('button', { name: /^Plätze$/ });
    await expect(blockButton).toBeVisible();
    await blockButton.click();

    // Nach dem Sperren zeigt der Button die Anzahl (Alpha hat 4 aktive Plätze).
    await expect(page.getByRole('button', { name: /\d+ Plätze/ })).toBeVisible({ timeout: 15000 });

    // Und wieder aufheben.
    await page.getByRole('button', { name: /\d+ Plätze/ }).click();
    await expect(page.getByRole('button', { name: /^Plätze$/ })).toBeVisible({ timeout: 15000 });
  });

  test('Sync mit fremder Domain wird abgelehnt', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(leagueUrl, { waitUntil: 'domcontentloaded' });
    const leagueId = leagueUrl.split('/').pop();

    // proxy.ts verlangt bei mutierenden Requests den CSRF-Header — ohne ihn
    // antwortet die Route mit 403, bevor sie die URL überhaupt prüft.
    const csrf = (await page.context().cookies()).find((c) => c.name === 'csrf-token')?.value;
    expect(csrf, 'CSRF-Cookie muss gesetzt sein').toBeTruthy();

    const res = await page.request.post(`/api/leagues/${leagueId}/sync`, {
      headers: { 'x-csrf-token': csrf as string },
      data: { nuliga_url: 'https://example.com/nicht-nuliga' },
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/liga\.nu/i);
  });

  test('Liga löschen — und sie bleibt weg', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoLeagues(page);

    page.on('dialog', (d) => d.accept()); // confirm()
    await page.getByRole('button', { name: new RegExp(`Liga ${leagueName} löschen`) }).click();

    await expect(page.getByText(leagueName)).toBeHidden({ timeout: 15000 });

    // Der eigentliche Test: nach einem echten Neuladen ist sie immer noch weg.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText(leagueName)).toHaveCount(0);
  });
});
