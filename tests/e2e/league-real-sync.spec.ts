/**
 * Ligen — Sync gegen eine ECHTE nuLiga-Mannschaftsseite.
 *
 * Prüft die Kette, die den eigentlichen Produktnutzen ausmacht:
 *   Mannschaftsseite → eigene Spieltermine + Kader mit LK
 *   → Zuordnung zum Vereinsmitglied über die DTB-ID
 *   → der Spieler sieht sein nächstes Medenspiel im eigenen Dashboard
 *
 * Läuft in der Agent-Lane. Die Testspielerin legt
 * `scripts/tmp-seed-league-tester.ts` an (Ann-Katrin Fries, DTB-ID 29100829) —
 * sie steht in der Meldeliste der abgerufenen Mannschaft.
 *
 * Der Test ruft eine fremde, öffentliche Seite ab. Fällt nuLiga aus oder ändert
 * sich die Meldung, wird er übersprungen statt rot — er sichert unsere Logik,
 * nicht die Verfügbarkeit des Verbandsportals.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? '';

const PORTRAIT_URL =
  'https://rlsw.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/teamPortrait?targetFed=RLSW&team=3550976&championship=RLSW+2026';
const TESTER_NAME = 'Ann-Katrin Fries';
const leagueName = `E2E Sync ${Date.now()}`;

test.describe('Liga-Sync gegen echte nuLiga-Daten', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'TEST_ADMIN_* nicht gesetzt');
  test.describe.configure({ mode: 'serial' });

  let leagueId = '';

  test('Mannschaftsseite verbinden und synchronisieren', async ({ page }) => {
    test.slow(); // zwei Seitenabrufe bei nuLiga (Portrait + Gruppentabelle)
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/leagues', { waitUntil: 'domcontentloaded' });

    const csrf = (await page.context().cookies()).find((c) => c.name === 'csrf-token')?.value;
    const headers = { 'x-csrf-token': csrf as string };

    const created = await page.request.post('/api/leagues', {
      headers,
      data: { name: leagueName, season_year: 2026, nuliga_url: PORTRAIT_URL },
    });
    expect(created.ok()).toBeTruthy();
    leagueId = (await created.json()).league.id;

    const syncRes = await page.request.post(`/api/leagues/${leagueId}/sync`, { headers });
    if (syncRes.status() === 502) {
      test.skip(true, 'nuLiga nicht erreichbar');
    }
    const rawBody = await syncRes.text();
    expect(syncRes.ok(), `Sync fehlgeschlagen (${syncRes.status()}): ${rawBody}`).toBeTruthy();
    const sync = JSON.parse(rawBody);

    // Die Seite nennt die eigene Mannschaft selbst — kein Raten mehr.
    expect(sync.source).toBe('portrait');
    expect(sync.ownTeam).toBeTruthy();

    // Nur eigene Begegnungen, kein fremdes Paar aus der Gruppe.
    expect(sync.matchesCreated).toBeGreaterThan(0);
    expect(sync.skippedForeign).toBe(0);

    // Meldeliste inklusive Zuordnung der Testspielerin über die DTB-ID.
    expect(sync.playersImported).toBeGreaterThan(0);
    expect(sync.playersLinked).toBeGreaterThanOrEqual(1);

    // Tabelle kommt über den Gruppenlink der Portrait-Seite.
    expect(sync.teamsCreated + sync.teamsUpdated).toBeGreaterThan(0);
  });

  test('Kader zeigt LK und die verknüpfte Spielerin', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/admin/leagues/${leagueId}`, { waitUntil: 'domcontentloaded' });

    await page.getByRole('tab', { name: /kader/i }).click();
    // Nicht getByText: der Name steht auch in den <option>s der Zuordnungs-
    // Auswahlfelder der übrigen Kaderzeilen (sie ist ja Vereinsmitglied).
    await expect(page.locator(`span:has-text("${TESTER_NAME}")`).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/^LK\d/).first()).toBeVisible();

    // Zuordnung sitzt: die Zeile bietet das Lösen an statt eines Auswahlfelds.
    await expect(page.getByLabel(`Zuordnung von ${TESTER_NAME} lösen`)).toBeVisible();
    await expect(page.getByLabel(`Mitglied für ${TESTER_NAME} zuordnen`)).toHaveCount(0);
  });

  test('Spieltage stehen mit Heim/Auswärts und Spielbericht', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/admin/leagues/${leagueId}`, { waitUntil: 'domcontentloaded' });

    await page.getByRole('tab', { name: /spieltage/i }).click();
    await expect(page.getByText(/🏠 Heim|✈️ Auswärts/).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: /spielbericht/i }).first()).toBeVisible();
  });

  test('Die Spielerin sieht ihr Medenspiel im eigenen Dashboard', async ({ page }) => {
    const testerPassword = process.env.SEED_PASSWORD ?? process.env.TEST_MEMBER_PASSWORD;
    test.skip(!testerPassword, 'Passwort der Testspielerin nicht gesetzt');

    await loginAs(page, 'ann-katrin.fries@alpha.claude.test', testerPassword as string);

    const res = await page.request.get('/api/member/leagues');
    expect(res.ok()).toBeTruthy();
    const { teams } = await res.json();

    // Genau das ist der Produktnutzen: aus der Meldeliste des Verbands wird
    // ein Eintrag im Dashboard des Spielers.
    expect(teams.length).toBeGreaterThan(0);
    const team = teams.find((t: { league_id: string }) => t.league_id === leagueId);
    expect(team, 'Spielerin muss die synchronisierte Liga sehen').toBeTruthy();
    expect(team.lk).toMatch(/^LK/);
    expect(team.position_number).toBeGreaterThan(0);

    // Und die Karte rendert auf dem Dashboard.
    await page.goto('/member', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Meine Mannschaften')).toBeVisible({ timeout: 20000 });
  });

  test('Aufräumen: Liga löschen', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/leagues', { waitUntil: 'domcontentloaded' });
    const csrf = (await page.context().cookies()).find((c) => c.name === 'csrf-token')?.value;

    const res = await page.request.delete(`/api/leagues/${leagueId}`, {
      headers: { 'x-csrf-token': csrf as string },
    });
    expect(res.ok()).toBeTruthy();
  });
});
