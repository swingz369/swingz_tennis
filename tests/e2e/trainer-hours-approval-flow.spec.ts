import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

/**
 * Real Trainer-Stunden → Genehmigung flow (not just "page renders"):
 * trainer logs hours, admin approves them in the hours-logs review queue.
 *
 * Scope note: this only covers submission + approval, the part of the
 * chain that is deterministically UI-driven. Whether an approved entry
 * turns into a correctly-priced trainer payout is a separate, currently
 * incomplete mechanism (see hours-logs approve route: the auto-created
 * invoice line uses unit_price: 0, and the unrelated
 * /api/billing/trainers endpoint that DOES take an hourly rate has no
 * UI caller) — out of scope here, flagged separately.
 */
test.describe('Trainer & Admin: hours log approval flow', () => {
  test('trainer submits hours → admin approves → status updates', async ({ browser }) => {
    const unique = Date.now();
    const note = `E2E Testeintrag ${unique}`;

    const trainerContext = await browser.newContext();
    const trainerPage = await trainerContext.newPage();
    await loginAs(trainerPage, process.env.TEST_TRAINER_EMAIL!, process.env.TEST_TRAINER_PASSWORD!);

    await trainerPage.goto('/trainer/hours-logs', { waitUntil: 'networkidle', timeout: 20000 });
    await trainerPage.getByRole('button', { name: /Neue Stunden/i }).click();
    await trainerPage.locator('#trainer-hl-notes').fill(note);
    await trainerPage.getByRole('button', { name: /Stunden eintragen/i }).click();

    // This page renders entries as cards (div.space-y-2 > div per entry), not
    // a <table> — unlike /admin/hours-logs below, which is a real table. A
    // 'tr' locator here never matches anything, even though the entry really
    // is created and visible (confirmed via the page's own accessibility
    // snapshot at the point this assertion used to fail).
    const trainerRow = trainerPage.locator('div.space-y-2 > div', { hasText: note });
    await expect(trainerRow).toBeVisible({ timeout: 10000 });
    await expect(trainerRow.getByText('Ausstehend', { exact: true })).toBeVisible();
    await trainerContext.close();

    // TEST_ADMIN_EMAIL (TSV Dortmund) and TEST_TRAINER_EMAIL (TC Rheinland) are
    // different clubs — an admin can never see another club's hours logs. Use
    // superadmin (now also a member of TC Rheinland) + admin_club_id cookie
    // instead, same pattern as billing-flow.spec.ts's club-scoped admin views.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(
      adminPage,
      process.env.TEST_SUPERADMIN_EMAIL!,
      process.env.TEST_SUPERADMIN_PASSWORD!
    );
    await adminContext.addCookies([
      {
        name: 'admin_club_id',
        value: 'a1000000-0000-0000-0000-000000000001', // TC Rheinland e.V.
        url: process.env.BASE_URL ?? 'http://localhost:3000',
      },
    ]);

    await adminPage.goto('/admin/hours-logs', { waitUntil: 'networkidle', timeout: 20000 });
    const adminRow = adminPage.locator('tr', { hasText: note });
    await expect(adminRow).toBeVisible({ timeout: 10000 });
    await adminRow.getByTitle('Genehmigen').click();
    await expect(adminRow.getByText('Genehmigt', { exact: true })).toBeVisible({ timeout: 15000 });
    await adminContext.close();
  });
});
