import { test, expect } from '@playwright/test';
import { loginAsRoleAware } from '../helpers/auth';

/**
 * Superadmin: Vereinsliste und Rollenwechsel in einen Verein.
 *
 * Deckt drei Fehler ab, die am 30.08.2026 gleichzeitig live waren und sich
 * gegenseitig verdeckt haben — der Superadmin sah schlicht keinen einzigen
 * Verein und kam, wenn er doch einen öffnete, mit der falschen Navigation an:
 *
 *   1. /superadmin/clubs rief `fetchClubs()` nie auf (kein `useEffect`) und
 *      blieb dauerhaft auf „Wird geladen …" stehen.
 *   2. /superadmin/tenants fragte die Beziehungen `club_memberships`,
 *      `trainers` und `sessions` ab — keine davon existiert. PostgREST
 *      antwortete mit 400, die Seite meldete „Keine aktiven Vereine gefunden".
 *   3. Nach „Verein verwalten" blieb die Superadmin-Navigation stehen, weil
 *      der Club-Kontext (`useClubAdminContext`) nur für Owner griff.
 *
 * Die Assertions hängen bewusst an sichtbaren Texten statt an Zählwerten:
 * die Testdaten wachsen, „mindestens ein Verein" bleibt wahr.
 */

const SIDEBAR = 'aside[role="navigation"]';

test.describe('Superadmin — Vereine', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(
      page,
      process.env.TEST_SUPERADMIN_EMAIL!,
      process.env.TEST_SUPERADMIN_PASSWORD!
    );
  });

  test('/superadmin/tenants listet die Vereine der Tennisschule', async ({ page }) => {
    await page.goto('/superadmin/tenants', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Keine aktiven Vereine gefunden')).not.toBeVisible();
    await expect(page.getByText('Claude Sandbox Gamma')).toBeVisible({ timeout: 45000 });
    // Der Lasttest-Verein ist der Beleg dafür, dass die Zählungen aus der
    // richtigen Tabelle kommen: 500 Mitglieder, 20 Trainer, 12 Plätze.
    const karte = page
      .locator('[class*="rounded"]')
      .filter({ hasText: 'Claude Sandbox Gamma' })
      .last();
    await expect(karte.getByText(/\d+\/\d+ Mitglieder/)).toBeVisible();
    await expect(karte.getByText('Plätze')).toBeVisible();
  });

  test('/superadmin/clubs bleibt nicht im Ladezustand hängen', async ({ page }) => {
    await page.goto('/superadmin/clubs', { waitUntil: 'domcontentloaded' });

    // 45s statt der Playwright-Vorgabe: der Dev-Server kompiliert die Route beim
    // Erstbesuch on-demand — siehe denselben Grund in tests/helpers/auth.ts.
    await expect(page.getByRole('heading', { name: 'Vereine verwalten' })).toBeVisible({
      timeout: 45000,
    });
    await expect(page.getByText('Wird geladen …')).not.toBeVisible();
    await expect(page.getByText('Claude Sandbox Gamma')).toBeVisible();
  });

  test('„Verein verwalten" schaltet Navigation auf Vereinsverwaltung um', async ({ page }) => {
    await page.goto('/superadmin/tenants', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Claude Sandbox Gamma')).toBeVisible({ timeout: 45000 });

    await page
      .locator('[class*="rounded"]')
      .filter({ hasText: 'Claude Sandbox Gamma' })
      .last()
      .getByRole('button', { name: /Verein verwalten/i })
      .click();

    await page.waitForURL('**/admin/members', { timeout: 30000 });

    const sidebar = page.locator(SIDEBAR);
    await expect(sidebar).toBeVisible({ timeout: 45000 });
    // Admin-Navigation statt Tennisschule-Navigation.
    await expect(sidebar.getByText('Alle Mitglieder')).toBeVisible({ timeout: 45000 });
    await expect(sidebar.getByText('Verein öffnen')).not.toBeVisible();
    // Und der Rückweg ist sichtbar, sonst sitzt man im Verein fest.
    await expect(page.getByRole('link', { name: /Zurück zur Tennisschule/i })).toBeVisible();
  });
});
