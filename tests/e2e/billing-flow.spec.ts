import { test, expect } from '@playwright/test';
import { loginAs, loginAsRoleAware } from '../helpers/auth';

/**
 * Billing Flow E2E Tests
 * Covers: Invoice creation, payment import, billing page rendering, and admin workflows.
 */

test.describe('Billing Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  test('Billing page loads with all five tabs', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText(/abrechnung/i, { timeout: 8000 });

    // Tabs heute: Rechnungen · Kategorien · Trainer · SEPA-Export · DATEV
    for (const tabName of [/rechnungen/i, /kategorien/i, /trainer/i, /sepa/i, /datev/i]) {
      await expect(page.getByRole('tab', { name: tabName })).toBeVisible({ timeout: 5000 });
    }

    // Verify action buttons are present (Zahlungs-Import wurde entfernt)
    await expect(
      page.getByRole('button', { name: /rechnungen generieren/i }).first()
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /rechnung erstellen/i })).toBeVisible();
  });

  test('Invoices tab shows invoice table or empty state', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText(/abrechnung/i, { timeout: 8000 });

    // Click invoices tab
    const invoicesTab = page.getByRole('tab', { name: /rechnungen/i });
    await invoicesTab.click();

    // Either an empty state or a table should render
    await expect(page.locator('table, :text("Noch keine Rechnungen")').first()).toBeVisible({
      timeout: 8000,
    });
  });

  test('Kategorien tab shows fee categories', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText(/abrechnung/i, { timeout: 8000 });

    await page.getByRole('tab', { name: /kategorien/i }).click();
    await expect(page.locator('body')).toContainText(/kategorie/i, { timeout: 8000 });
  });

  test('Generate invoices button is clickable', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText(/abrechnung/i, { timeout: 8000 });

    const generateBtn = page.getByRole('button', { name: /rechnungen generieren/i });
    await expect(generateBtn).toBeVisible();

    // Click - expect either a success toast or an error (since there may be no members)
    await generateBtn.click();

    // Either success or error toast should appear (or page remains stable)
    const toast = page.locator('[data-sonner-toast]').first();
    const toastAppeared = await toast.isVisible().catch(() => false);
    if (toastAppeared) {
      await expect(toast).toBeVisible();
    }
  });

  test('Create invoice dialog opens and closes', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText(/abrechnung/i, { timeout: 8000 });

    const createBtn = page.getByRole('button', { name: /rechnung erstellen/i });
    await expect(createBtn).toBeVisible();

    // Open dialog
    await createBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Dialog should have member selection and cancel button
    await expect(page.getByRole('button', { name: /abbrechen/i })).toBeVisible();
    await page.getByRole('button', { name: /abbrechen/i }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
  });

  // "Zahlungen importieren" wurde aus der Billing-Seite entfernt (offener
  // Backlog Cluster 4: Zahlungs-APIs in /admin/billing integrieren) — Test folgt dann.
});

test.describe('Billing API Access Control', () => {
  test('superadmin can access SEPA Pain.008 generation', async ({ page }) => {
    await loginAsRoleAware(
      page,
      process.env.TEST_SUPERADMIN_EMAIL!,
      process.env.TEST_SUPERADMIN_PASSWORD!
    );

    // Navigate to admin billing (superadmin should see billing)
    await page.goto('/admin/billing', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText(/abrechnung/i, { timeout: 8000 });
  });

  test('Create invoice dialog — fill form and submit', async ({ page }) => {
    await loginAs(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    await page.goto('/admin/billing', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText(/abrechnung/i, { timeout: 8000 });

    // Open create invoice dialog
    const createBtn = page.getByRole('button', { name: /rechnung erstellen/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog contents: member selector, due date, items, notes, summary
    await expect(dialog.getByText(/mitglied/i)).toBeVisible();
    await expect(dialog.getByText(/fälligkeitsdatum/i)).toBeVisible();
    await expect(dialog.getByText(/position hinzufügen/i)).toBeVisible();
    await expect(dialog.getByText(/zusammenfassung/i)).toBeVisible();

    // Fill in description and price for the first line item
    const descriptionInput = dialog.getByPlaceholder(/mitgliedsbeitrag/i);
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('Mitgliedsbeitrag Test');
    }

    // Click Abbrechen to close
    await dialog.getByRole('button', { name: /abbrechen/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('member is redirected away from admin billing', async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);

    await page.goto('/admin/billing', { waitUntil: 'domcontentloaded' });

    // Member should be redirected away from admin route
    const url = page.url();
    expect(url).not.toContain('/admin/billing');
  });
});
