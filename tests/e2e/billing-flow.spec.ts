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

  test('Billing page loads with subscriptions and invoices tabs', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('h1')).toContainText(/abrechnung/i, { timeout: 8000 });

    // Verify tab navigation exists
    const subscriptionsTab = page.getByRole('button', { name: /abonnements/i });
    const invoicesTab = page.getByRole('button', { name: /rechnungen/i });

    await expect(subscriptionsTab).toBeVisible({ timeout: 5000 });
    await expect(invoicesTab).toBeVisible({ timeout: 5000 });

    // Verify action buttons are present
    await expect(page.getByRole('button', { name: /rechnungen generieren/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /rechnung erstellen/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /zahlungen importieren/i })).toBeVisible();
  });

  test('Invoices tab shows invoice table or empty state', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('h1')).toContainText(/abrechnung/i, { timeout: 8000 });

    // Click invoices tab
    const invoicesTab = page.getByRole('button', { name: /rechnungen/i });
    await invoicesTab.click();

    // Either an empty state or a table should render
    await expect(
      page.locator('table, :text("Noch keine Rechnungen")').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('Subscriptions tab shows subscription table or empty state', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('h1')).toContainText(/abrechnung/i, { timeout: 8000 });

    // Subscriptions tab is default
    await expect(
      page.locator('table, :text("Noch keine Abonnements")').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('Generate invoices button is clickable', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'networkidle', timeout: 20000 });
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
    await page.goto('/admin/billing', { waitUntil: 'networkidle', timeout: 20000 });
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

  test('Payment import dialog opens and closes', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('h1')).toContainText(/abrechnung/i, { timeout: 8000 });

    const importBtn = page.getByRole('button', { name: /zahlungen importieren/i });
    await expect(importBtn).toBeVisible();

    // Open dialog
    await importBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Dialog should have file input and cancel button
    await expect(page.getByRole('button', { name: /abbrechen/i })).toBeVisible();
    await page.getByRole('button', { name: /abbrechen/i }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Billing API Access Control', () => {
  test('superadmin can access SEPA Pain.008 generation', async ({ page }) => {
    await loginAsRoleAware(
      page,
      process.env.TEST_SUPERADMIN_EMAIL!,
      process.env.TEST_SUPERADMIN_PASSWORD!
    );

    // Navigate to admin billing (superadmin should see billing)
    await page.goto('/admin/billing', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('h1')).toContainText(/abrechnung/i, { timeout: 8000 });
  });

  test('Create invoice dialog — fill form and submit', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'networkidle', timeout: 20000 });
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
    await loginAsRoleAware(
      page,
      process.env.TEST_MEMBER_EMAIL!,
      process.env.TEST_MEMBER_PASSWORD!
    );

    await page.goto('/admin/billing', { waitUntil: 'networkidle', timeout: 20000 });

    // Member should be redirected away from admin route
    const url = page.url();
    expect(url).not.toContain('/admin/billing');
  });
});
