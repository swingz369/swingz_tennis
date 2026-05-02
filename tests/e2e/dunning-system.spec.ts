import { test, expect } from '@playwright/test';

test.describe('Dunning System E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display overdue invoices in dunning section', async ({ page }) => {
    await page.goto('/billing');
    
    // Navigate to dunning section
    await page.click('text=Mahnwesen');
    
    // Check if overdue invoices are displayed
    await expect(page.locator('text=Überfällige Rechnungen')).toBeVisible();
    
    // Verify dunning level indicators
    const dunningLevel1 = page.locator('[data-testid="dunning-level-1"]');
    await expect(dunningLevel1).toBeVisible();
  });

  test('should create dunning record for overdue invoice', async ({ page }) => {
    await page.goto('/billing');
    
    // Find an overdue invoice
    await page.click('text=Überfällige Rechnungen');
    
    // Select first overdue invoice
    await page.click('[data-testid="overdue-invoice"]:first-child');
    
    // Click create dunning button
    await page.click('button:has-text("Mahnung erstellen")');
    
    // Verify dunning creation modal
    await expect(page.locator('text=Mahnung erstellen')).toBeVisible();
    
    // Select dunning level
    await page.click('select[name="dunning_level"]');
    await page.click('option[value="1"]');
    
    // Confirm dunning creation
    await page.click('button:has-text("Bestätigen")');
    
    // Verify success message
    await expect(page.locator('text=Mahnung erfolgreich erstellt')).toBeVisible();
  });

  test('should display dunning history for invoice', async ({ page }) => {
    await page.goto('/billing');
    
    // Navigate to invoices
    await page.click('text=Rechnungen');
    
    // Click on an invoice with dunning history
    await page.click('[data-testid="invoice-with-dunning"]');
    
    // Navigate to dunning history tab
    await page.click('text=Mahnverlauf');
    
    // Verify dunning history is displayed
    await expect(page.locator('[data-testid="dunning-history"]')).toBeVisible();
    
    // Check dunning records
    const dunningRecords = page.locator('[data-testid="dunning-record"]');
    await expect(dunningRecords).toHaveCountGreaterThan(0);
  });

  test('should calculate correct dunning fees', async ({ page }) => {
    await page.goto('/billing');
    
    // Create a new dunning record
    await page.click('text=Überfällige Rechnungen');
    await page.click('[data-testid="overdue-invoice"]:first-child');
    await page.click('button:has-text("Mahnung erstellen")');
    
    // Select level 1 dunning
    await page.selectOption('select[name="dunning_level"]', '1');
    
    // Verify fee calculation
    const feeDisplay = page.locator('[data-testid="dunning-fee"]');
    await expect(feeDisplay).toHaveText('5,00 €');
    
    // Select level 2 dunning
    await page.selectOption('select[name="dunning_level"]', '2');
    await expect(feeDisplay).toHaveText('10,00 €');
    
    // Select level 3 dunning
    await page.selectOption('select[name="dunning_level"]', '3');
    await expect(feeDisplay).toHaveText('20,00 €');
  });

  test('should send dunning notification to member', async ({ page }) => {
    await page.goto('/billing');
    
    // Create dunning record
    await page.click('text=Überfällige Rechnungen');
    await page.click('[data-testid="overdue-invoice"]:first-child');
    await page.click('button:has-text("Mahnung erstellen")');
    
    // Enable email notification
    await page.check('input[name="send_email_notification"]');
    
    // Create dunning
    await page.click('button:has-text("Bestätigen")');
    
    // Verify notification was sent
    await expect(page.locator('text=E-Mail-Benachrichtigung gesendet')).toBeVisible();
  });

  test('should process automatic dunning run', async ({ page }) => {
    await page.goto('/admin/settings');
    
    // Navigate to dunning settings
    await page.click('text=Mahnwesen');
    
    // Enable automatic dunning
    await page.check('input[name="automatic_dunning_enabled"]');
    
    // Set dunning schedule
    await page.selectOption('select[name="dunning_schedule"]', 'daily');
    
    // Save settings
    await page.click('button:has-text("Speichern")');
    
    // Verify settings were saved
    await expect(page.locator('text=Einstellungen gespeichert')).toBeVisible();
    
    // Trigger manual dunning run
    await page.click('button:has-text("Mahnlauf jetzt ausführen")');
    
    // Verify dunning run completed
    await expect(page.locator('text=Mahnlauf abgeschlossen')).toBeVisible();
  });

  test('should display dunning statistics', async ({ page }) => {
    await page.goto('/billing');
    
    // Navigate to dunning statistics
    await page.click('text=Statistiken');
    await page.click('text=Mahnwesen');
    
    // Verify statistics are displayed
    await expect(page.locator('[data-testid="dunning-stats"]')).toBeVisible();
    
    // Check specific statistics
    await expect(page.locator('text=Level 1 Mahnungen')).toBeVisible();
    await expect(page.locator('text=Level 2 Mahnungen')).toBeVisible();
    await expect(page.locator('text=Level 3 Mahnungen')).toBeVisible();
    await expect(page.locator('text=Gebühreneinnahmen')).toBeVisible();
  });

  test('should allow manual dunning fee override', async ({ page }) => {
    await page.goto('/billing');
    
    // Create dunning record
    await page.click('text=Überfällige Rechnungen');
    await page.click('[data-testid="overdue-invoice"]:first-child');
    await page.click('button:has-text("Mahnung erstellen")');
    
    // Enable custom fee
    await page.check('input[name="custom_fee_enabled"]');
    
    // Enter custom fee
    await page.fill('input[name="custom_fee"]', '15,00');
    
    // Verify total amount is updated
    const totalAmount = page.locator('[data-testid="total-amount"]');
    await expect(totalAmount).toContain('15,00 €');
    
    // Create dunning with custom fee
    await page.click('button:has-text("Bestätigen")');
    
    // Verify dunning was created with custom fee
    await expect(page.locator('text=Mahnung erfolgreich erstellt')).toBeVisible();
  });

  test('should handle dunning cancellation', async ({ page }) => {
    await page.goto('/billing');
    
    // Navigate to dunning history
    await page.click('text=Rechnungen');
    await page.click('[data-testid="invoice-with-dunning"]');
    await page.click('text=Mahnverlauf');
    
    // Cancel active dunning
    await page.click('[data-testid="dunning-record"]:first-child button:has-text("Stornieren")');
    
    // Confirm cancellation
    await page.click('button:has-text("Ja, stornieren")');
    
    // Verify dunning was cancelled
    await expect(page.locator('text=Mahnung storniert')).toBeVisible();
    
    // Check dunning status
    const dunningStatus = page.locator('[data-testid="dunning-status"]');
    await expect(dunningStatus).toHaveText('storniert');
  });

  test('should export dunning report', async ({ page }) => {
    await page.goto('/billing');
    
    // Navigate to dunning statistics
    await page.click('text=Statistiken');
    await page.click('text=Mahnwesen');
    
    // Click export button
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Exportieren")');
    
    // Verify download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('mahnbericht');
  });
});
