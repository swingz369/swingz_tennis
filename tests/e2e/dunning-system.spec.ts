import { test, expect } from '@playwright/test';

test.describe('Dunning System E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should create overdue invoice and trigger dunning level 1', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Abrechnung');
    await page.waitForURL('http://localhost:3000/admin/billing');

    await page.click('text=Rechnung erstellen');

    await page.selectOption('select[name="member"]', '1');
    await page.fill('input[name="dueDate"]', '2026-04-01');

    await page.fill('input[placeholder="z.B. Mitgliedsbeitrag Mai 2026"]', 'Test Rechnung');
    await page.fill('input[placeholder="Preis (€)"]', '100');
    await page.fill('input[placeholder="Menge"]', '1');

    await page.click('text=Rechnung erstellen');

    await expect(page.locator('text=Rechnung erfolgreich erstellt')).toBeVisible();

    await page.goto('http://localhost:3000/admin/billing');

    await page.click('text=Rechnungen');

    const invoiceRow = page.locator('tr').filter({ hasText: 'Test Rechnung' });
    await expect(invoiceRow).toBeVisible();

    await page.click('text=Mahnläufe ausführen');

    await expect(page.locator('text=Mahnstufe 1 erstellt')).toBeVisible();
  });

  test('should escalate dunning level after 28 days', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Abrechnung');
    await page.waitForURL('http://localhost:3000/admin/billing');

    await page.click('text=Rechnungen');

    const overdueInvoice = page.locator('tr').filter({ hasText: 'Überfällig' }).first();
    await expect(overdueInvoice).toBeVisible();

    await page.click('text=Mahnläufe ausführen');

    await expect(page.locator('text=Mahnstufe 2 erstellt')).toBeVisible();
  });

  test('should escalate to dunning level 3 after 42 days', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Abrechnung');
    await page.waitForURL('http://localhost:3000/admin/billing');

    await page.click('text=Rechnungen');

    const longOverdueInvoice = page.locator('tr').filter({ hasText: 'Mahnstufe 2' }).first();
    await expect(longOverdueInvoice).toBeVisible();

    await page.click('text=Mahnläufe ausführen');

    await expect(page.locator('text=Mahnstufe 3 erstellt')).toBeVisible();
  });

  test('should calculate correct dunning fees', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Abrechnung');
    await page.waitForURL('http://localhost:3000/admin/billing');

    await page.click('text=Rechnungen');

    await page.click('text=Mahnläufe anzeigen');

    const dunningLevel1 = page.locator('text=Mahngebühr: 5,00 €');
    const dunningLevel2 = page.locator('text=Mahngebühr: 10,00 €');
    const dunningLevel3 = page.locator('text=Mahngebühr: 20,00 €');

    await expect(dunningLevel1).toBeVisible();
    await expect(dunningLevel2).toBeVisible();
    await expect(dunningLevel3).toBeVisible();
  });

  test('should send dunning notification to member', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Abrechnung');
    await page.waitForURL('http://localhost:3000/admin/billing');

    await page.click('text=Rechnungen');

    const overdueInvoice = page.locator('tr').filter({ hasText: 'Überfällig' }).first();
    await overdueInvoice.click();

    await page.click('text=Mahnung senden');

    await expect(page.locator('text=Mahnung erfolgreich gesendet')).toBeVisible();
  });

  test('should update invoice status when dunning is created', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Abrechnung');
    await page.waitForURL('http://localhost:3000/admin/billing');

    await page.click('text=Rechnungen');

    const invoiceRow = page.locator('tr').filter({ hasText: 'Mahnstufe 1' }).first();
    await expect(invoiceRow).toBeVisible();

    const statusBadge = invoiceRow.locator('text=Mahnung');
    await expect(statusBadge).toBeVisible();
  });

  test('should show dunning history for invoice', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Abrechnung');
    await page.waitForURL('http://localhost:3000/admin/billing');

    await page.click('text=Rechnungen');

    const dunningInvoice = page.locator('tr').filter({ hasText: 'Mahnstufe' }).first();
    await dunningInvoice.click();

    await page.click('text=Mahnhistorie');

    await expect(page.locator('text=Mahnstufe 1')).toBeVisible();
    await expect(page.locator('text=Mahnstufe 2')).toBeVisible();
    await expect(page.locator('text=Mahnstufe 3')).toBeVisible();
  });

  test('should cancel dunning when payment is received', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Abrechnung');
    await page.waitForURL('http://localhost:3000/admin/billing');

    await page.click('text=Rechnungen');

    const dunningInvoice = page.locator('tr').filter({ hasText: 'Mahnstufe' }).first();
    await dunningInvoice.click();

    await page.click('text=Zahlung erfassen');

    await page.fill('input[name="amount"]', '100');
    await page.selectOption('select[name="payment_method"]', 'stripe');
    await page.click('text=Zahlung speichern');

    await expect(page.locator('text=Zahlung erfolgreich erfasst')).toBeVisible();

    await page.click('text=Rechnungen');

    const updatedInvoice = page.locator('tr').filter({ hasText: 'Bezahlt' }).first();
    await expect(updatedInvoice).toBeVisible();
  });

  test('should show dunning statistics in dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Abrechnung');
    await page.waitForURL('http://localhost:3000/admin/billing');

    await expect(page.locator('text=Mahnstufe 1:')).toBeVisible();
    await expect(page.locator('text=Mahnstufe 2:')).toBeVisible();
    await expect(page.locator('text=Mahnstufe 3:')).toBeVisible();
  });

  test('should export dunning report', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Abrechnung');
    await page.waitForURL('http://localhost:3000/admin/billing');

    await page.click('text=Berichte');

    await page.click('text=Mahnbericht exportieren');

    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Exportieren');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('mahnbericht');
  });

  test('should handle automatic dunning runs', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Abrechnung');
    await page.waitForURL('http://localhost:3000/admin/billing');

    await page.click('text=Einstellungen');

    await page.click('text=Automatische Mahnläufe');

    await page.check('input[name="auto_dunning_enabled"]');
    await page.fill('input[name="dunning_level_1_days"]', '14');
    await page.fill('input[name="dunning_level_2_days"]', '28');
    await page.fill('input[name="dunning_level_3_days"]', '42');

    await page.click('text=Einstellungen speichern');

    await expect(page.locator('text=Einstellungen gespeichert')).toBeVisible();
  });

  test('should show member dunning status in member profile', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Mitglieder');

    const memberRow = page.locator('tr').filter({ hasText: 'Max Mustermann' }).first();
    await memberRow.click();

    await expect(page.locator('text=Mahnstatus')).toBeVisible();
    await expect(page.locator('text=Offene Mahnungen')).toBeVisible();
  });

  test('should allow manual dunning level override', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'admin@swingz.de');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/dashboard');

    await page.click('text=Abrechnung');
    await page.waitForURL('http://localhost:3000/admin/billing');

    await page.click('text=Rechnungen');

    const overdueInvoice = page.locator('tr').filter({ hasText: 'Überfällig' }).first();
    await overdueInvoice.click();

    await page.click('text=Mahnstufe ändern');

    await page.selectOption('select[name="dunning_level"]', '3');
    await page.fill('input[name="override_reason"]', 'Sonderfall');

    await page.click('text=Speichern');

    await expect(page.locator('text=Mahnstufe erfolgreich geändert')).toBeVisible();
  });
});
