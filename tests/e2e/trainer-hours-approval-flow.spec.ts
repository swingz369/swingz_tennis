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

    const trainerRow = trainerPage.locator('tr', { hasText: note });
    await expect(trainerRow).toBeVisible({ timeout: 10000 });
    await expect(trainerRow.getByText('Ausstehend', { exact: true })).toBeVisible();
    await trainerContext.close();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);

    await adminPage.goto('/admin/hours-logs', { waitUntil: 'networkidle', timeout: 20000 });
    const adminRow = adminPage.locator('tr', { hasText: note });
    await expect(adminRow).toBeVisible({ timeout: 10000 });
    await adminRow.getByTitle('Genehmigen').click();
    await expect(adminRow.getByText('Genehmigt', { exact: true })).toBeVisible({ timeout: 10000 });
    await adminContext.close();
  });
});
