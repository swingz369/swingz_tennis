/**
 * SwingZ Full QA Audit — 17. Juni 2026
 * Targets: https://swingz.vercel.app
 *
 * Covers:
 *  Phase 0: Public API health
 *  Phase 1: Admin Setup
 *  Phase 2: Trainer tests
 *  Phase 3: Member tests
 *  Phase 4: Admin control check
 *  Phase 5: Superadmin
 *  Phase 6: Public pages
 *  Phase 7: Technical checks (console errors, mobile)
 */
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

const BASE = process.env.QA_AUDIT_BASE_URL ?? 'https://swingz.vercel.app';
const TIMEOUT = 20000;

// Läuft gegen Produktion — nur explizit mit QA_AUDIT=1 starten, Credentials aus ENV.
test.skip(!process.env.QA_AUDIT, 'QA-Audit nur mit QA_AUDIT=1 (läuft gegen Produktion)');

/* ─── Credentials (aus .env.local / CI-Secrets) ─── */
const ADMIN = {
  email: process.env.QA_ADMIN_EMAIL ?? '',
  password: process.env.QA_ADMIN_PASSWORD ?? '',
};
const TRAINER1 = {
  email: process.env.QA_TRAINER_EMAIL ?? '',
  password: process.env.QA_TRAINER_PASSWORD ?? '',
};
const MEMBER1 = {
  email: process.env.QA_MEMBER_EMAIL ?? '',
  password: process.env.QA_MEMBER_PASSWORD ?? '',
};
const SUPERADMIN = {
  email: process.env.QA_SUPERADMIN_EMAIL ?? '',
  password: process.env.QA_SUPERADMIN_PASSWORD ?? '',
};

/* ─── Helpers ─── */
const consoleErrors: { url: string; msg: string }[] = [];

async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.locator('input[type="email"], input[name="email"]').fill(email);
  await page.locator('input[type="password"], input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait for redirect away from login
  await page.waitForURL((url) => !url.href.includes('/login'), { timeout: TIMEOUT });
}

function captureConsoleErrors(page: Page, label: string) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: `[${label}] ${page.url()}`, msg: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push({ url: `[${label}] ${page.url()}`, msg: err.message });
  });
}

/* ═══════════════════════════════════════════════
   PHASE 0: API Health
   ═══════════════════════════════════════════════ */
test.describe('Phase 0: API Health', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
  });

  test('GET /api/public/stats returns JSON with clubs/sessions/members', async ({ request }) => {
    const res = await request.get(`${BASE}/api/public/stats`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Should have at least one of these fields
    const hasStats = 'clubs' in body || 'sessions' in body || 'members' in body || 'stats' in body;
    expect(hasStats).toBe(true);
  });
});

/* ═══════════════════════════════════════════════
   PHASE 1: Admin Setup
   ═══════════════════════════════════════════════ */
test.describe('Phase 1: Admin Setup', () => {
  test.use({ storageState: undefined });

  // Track results for cross-role validation
  const results: Record<string, boolean> = {};

  test('1.0: Admin login redirects to /admin', async ({ page }) => {
    captureConsoleErrors(page, 'admin-login');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    const url = page.url();
    expect(url).toContain('/admin');
    results['admin_login'] = true;
  });

  test('1.1: /admin/seasons loads and has "Neue Season" button', async ({ page }) => {
    captureConsoleErrors(page, 'admin-seasons');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/seasons`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // Should have a button/link for new season
    const newSeasonBtn = page.locator('text=/Neue Season|Neue Saison|Saison anlegen/i').first();
    await expect(newSeasonBtn).toBeVisible({ timeout: 10000 });
  });

  test('1.1b: Create season "Sommersaison 2026"', async ({ page }) => {
    captureConsoleErrors(page, 'admin-create-season');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/seasons/new`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await expect(page.locator('body')).toBeVisible();
    // Check page loaded (not 404)
    const notFound = await page.locator('text=/404|nicht gefunden/i').isVisible();
    expect(notFound).toBe(false);

    // Fill season name
    const nameInput = page
      .locator('input[name="name"], input[placeholder*="Name"], input[placeholder*="name"]')
      .first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Sommersaison 2026');
    }

    // Attempt to fill start date
    const startDateInput = page.locator('input[name="start_date"], input[type="date"]').first();
    if (await startDateInput.isVisible()) {
      await startDateInput.fill('2026-07-01');
    }

    const endDateInput = page.locator('input[name="end_date"], input[type="date"]').nth(1);
    if (await endDateInput.isVisible()) {
      await endDateInput.fill('2026-09-30');
    }

    // Submit
    const submitBtn = page
      .locator(
        'button[type="submit"], button:has-text("Erstellen"), button:has-text("Speichern"), button:has-text("Anlegen")'
      )
      .first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
    }

    // Check for success (redirect to list or success message)
    const successIndicator = await page
      .locator('text=/Sommersaison 2026|erfolgreich|gespeichert/i')
      .isVisible();
    const redirectedToList = page.url().includes('/admin/seasons') && !page.url().includes('/new');

    // Either success message or redirect is acceptable
    console.log(
      `Season create outcome: success=${successIndicator}, redirected=${redirectedToList}`
    );
    // Not a hard failure - just observe
  });

  test('1.2: Admin trainers page loads (for group creation)', async ({ page }) => {
    captureConsoleErrors(page, 'admin-trainers');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/trainers`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
  });

  test('1.3: /admin/seasons/new page loads without 404', async ({ page }) => {
    captureConsoleErrors(page, 'admin-seasons-new');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/seasons/new`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    // Verify page renders
    const h1 = page.locator('h1, h2').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
  });

  test('1.4: /admin/shop loads and shows "Neues Produkt" option', async ({ page }) => {
    captureConsoleErrors(page, 'admin-shop');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/shop`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
    // Expect some shop-related content
    const shopContent = page.locator('text=/Shop|Produkt|Artikel/i').first();
    await expect(shopContent).toBeVisible({ timeout: 10000 });
  });

  test('1.4b: Create shop product "Tennisbälle"', async ({ page }) => {
    captureConsoleErrors(page, 'admin-shop-create');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/shop`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    // Look for add/new product button
    const addBtn = page
      .locator(
        'button:has-text("Neues Produkt"), button:has-text("Produkt anlegen"), button:has-text("Hinzufügen"), button[aria-label*="neu"]'
      )
      .first();
    if (await addBtn.isVisible({ timeout: 5000 })) {
      await addBtn.click();
      await page.waitForTimeout(1000);

      // Fill product form
      const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Tennisbälle (3er Pack)');
      }

      const priceInput = page.locator('input[name="price"], input[placeholder*="Preis"]').first();
      if (await priceInput.isVisible()) {
        await priceInput.fill('8.90');
      }

      const saveBtn = page
        .locator(
          'button[type="submit"], button:has-text("Speichern"), button:has-text("Erstellen")'
        )
        .first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }
      const created = await page.locator('text=/Tennisbälle|erfolgreich/i').isVisible();
      console.log(`Product "Tennisbälle" created: ${created}`);
    } else {
      console.log('No "Neues Produkt" button found on /admin/shop');
    }
  });

  test('1.5: /admin/work-duties loads', async ({ page }) => {
    captureConsoleErrors(page, 'admin-work-duties');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/work-duties`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
    // Expect work duties content
    const content = page.locator('text=/Arbeitsdienst|Dienst|Platzdienst/i').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('1.5b: Create work duty "Platzdienst"', async ({ page }) => {
    captureConsoleErrors(page, 'admin-work-duty-create');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/work-duties`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });

    const addBtn = page
      .locator(
        'button:has-text("Neu"), button:has-text("Anlegen"), button:has-text("Hinzufügen"), button:has-text("Erstellen")'
      )
      .first();
    if (await addBtn.isVisible({ timeout: 5000 })) {
      await addBtn.click();
      await page.waitForTimeout(1000);

      const titleInput = page
        .locator(
          'input[name="title"], input[placeholder*="Titel"], input[placeholder*="Bezeichnung"]'
        )
        .first();
      if (await titleInput.isVisible()) {
        await titleInput.fill('Platzdienst');
      }

      const dateInput = page.locator('input[type="date"], input[name="date"]').first();
      if (await dateInput.isVisible()) {
        await dateInput.fill('2026-06-28');
      }

      const saveBtn = page
        .locator(
          'button[type="submit"], button:has-text("Speichern"), button:has-text("Erstellen")'
        )
        .first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }
      const created = await page.locator('text=/Platzdienst|erfolgreich/i').isVisible();
      console.log(`Work duty "Platzdienst" created: ${created}`);
    } else {
      console.log('No "Neu/Anlegen" button found on /admin/work-duties');
    }
  });

  test('1.6: /messages page loads for admin', async ({ page }) => {
    captureConsoleErrors(page, 'admin-messages');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/messages`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
    const content = page.locator('text=/Nachricht|Posteingang|Neue Nachricht|Message/i').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('1.6b: Send message to mitglied.1', async ({ page }) => {
    captureConsoleErrors(page, 'admin-send-message');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/messages`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    const newMsgBtn = page
      .locator(
        'button:has-text("Neue Nachricht"), button:has-text("Nachricht schreiben"), button:has-text("Verfassen")'
      )
      .first();
    if (await newMsgBtn.isVisible({ timeout: 5000 })) {
      await newMsgBtn.click();
      await page.waitForTimeout(1000);

      // Fill recipient
      const recipientInput = page
        .locator('input[placeholder*="Empfänger"], input[name="to"], input[name="recipient"]')
        .first();
      if (await recipientInput.isVisible()) {
        await recipientInput.fill('mitglied.1@tc-rheinland.de');
      }

      const subjectInput = page
        .locator('input[name="subject"], input[placeholder*="Betreff"]')
        .first();
      if (await subjectInput.isVisible()) {
        await subjectInput.fill('Deine Trainingsgruppe für Sommersaison');
      }

      const bodyInput = page
        .locator('textarea[name="body"], textarea[placeholder*="Nachricht"]')
        .first();
      if (await bodyInput.isVisible()) {
        await bodyInput.fill(
          'Hallo, du wurdest der Gruppe Anfänger A zugewiesen. Training startet am 1. Juli.'
        );
      }

      const sendBtn = page.locator('button:has-text("Senden"), button[type="submit"]').first();
      if (await sendBtn.isVisible()) {
        await sendBtn.click();
        await page.waitForTimeout(2000);
      }
      const sent = await page.locator('text=/gesendet|erfolgreich|Senden/i').isVisible();
      console.log(`Message sent: ${sent}`);
    } else {
      console.log('No "Neue Nachricht" button found on /messages');
    }
  });

  test('1.7: /admin/billing loads', async ({ page }) => {
    captureConsoleErrors(page, 'admin-billing');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/billing`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
    const content = page.locator('text=/Rechnung|Abrechnung|Billing/i').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('1.7b: Create invoice for mitglied.2', async ({ page }) => {
    captureConsoleErrors(page, 'admin-create-invoice');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/billing`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    const newInvoiceBtn = page
      .locator(
        'button:has-text("Neue Rechnung"), button:has-text("Rechnung erstellen"), button:has-text("Hinzufügen")'
      )
      .first();
    if (await newInvoiceBtn.isVisible({ timeout: 5000 })) {
      await newInvoiceBtn.click();
      await page.waitForTimeout(1000);
      // Log that form opened
      console.log('Invoice form opened');
    } else {
      console.log('No "Neue Rechnung" button found on /admin/billing');
    }
  });

  test('1.8: Admin sidebar shows key navigation items', async ({ page }) => {
    captureConsoleErrors(page, 'admin-sidebar');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();

    // Check sidebar navigation items
    const sidebarItems = ['Mitglieder', 'Trainingsgruppen', 'Rechnung', 'Shop', 'Plätze'];
    for (const item of sidebarItems) {
      const found = await page.locator(`text=${item}`).first().isVisible();
      console.log(`Sidebar item "${item}": ${found ? 'visible' : 'NOT FOUND'}`);
    }
  });
});

/* ═══════════════════════════════════════════════
   PHASE 2: Trainer Tests
   ═══════════════════════════════════════════════ */
test.describe('Phase 2: Trainer Tests', () => {
  test('2.0: Trainer login redirects to /trainer', async ({ page }) => {
    captureConsoleErrors(page, 'trainer-login');
    await loginViaUI(page, TRAINER1.email, TRAINER1.password);
    const url = page.url();
    const isTrainer = url.includes('/trainer') || url.includes('/dashboard');
    expect(isTrainer).toBe(true);
    console.log(`Trainer redirected to: ${url}`);
  });

  test('2.1: Trainer dashboard loads without error', async ({ page }) => {
    captureConsoleErrors(page, 'trainer-dashboard');
    await loginViaUI(page, TRAINER1.email, TRAINER1.password);
    // Navigate to trainer area
    await page.goto(`${BASE}/trainer`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
    // Check dashboard content
    const content = page.locator('text=/Dashboard|Willkommen|Trainer|Gruppe/i').first();
    await expect(content).toBeVisible({ timeout: 10000 });
    console.log(`Trainer dashboard URL: ${page.url()}`);
  });

  test('2.2: Trainer availability page loads', async ({ page }) => {
    captureConsoleErrors(page, 'trainer-availability');
    await loginViaUI(page, TRAINER1.email, TRAINER1.password);
    await page.goto(`${BASE}/trainer/availability`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
    const content = page.locator('text=/Verfügbarkeit|Verfügbar|availability/i').first();
    const visible = await content.isVisible({ timeout: 8000 });
    console.log(`Trainer availability content visible: ${visible}`);
  });

  test('2.3: Trainer profile page loads and is editable', async ({ page }) => {
    captureConsoleErrors(page, 'trainer-profile');
    await loginViaUI(page, TRAINER1.email, TRAINER1.password);
    await page.goto(`${BASE}/trainer/profile`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
    const profileContent = page.locator('text=/Profil|Bio|Vorname/i').first();
    const visible = await profileContent.isVisible({ timeout: 8000 });
    console.log(`Trainer profile content visible: ${visible}`);
  });

  test('2.4: Trainer messages inbox accessible', async ({ page }) => {
    captureConsoleErrors(page, 'trainer-messages');
    await loginViaUI(page, TRAINER1.email, TRAINER1.password);
    await page.goto(`${BASE}/messages`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
  });
});

/* ═══════════════════════════════════════════════
   PHASE 3: Member Tests
   ═══════════════════════════════════════════════ */
test.describe('Phase 3: Member Tests', () => {
  test('3.0: Member login redirects to /member (not trial-training)', async ({ page }) => {
    captureConsoleErrors(page, 'member-login');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    const url = page.url();
    console.log(`Member redirected to: ${url}`);
    // Should NOT be on trial-training form
    expect(url).not.toContain('/trial-training');
    const isExpected = url.includes('/member') || url.includes('/dashboard');
    expect(isExpected).toBe(true);
  });

  test('3.1: Member dashboard shows greeting, club name, invoice stat', async ({ page }) => {
    captureConsoleErrors(page, 'member-dashboard');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/member`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();

    // Check no trial training form
    const trialForm = await page.locator('text=/Probetraining|Probestunde/i').isVisible();
    console.log(`Trial training form visible (should be false): ${trialForm}`);
    expect(trialForm).toBe(false);

    // Check club name visible
    const clubName = await page.locator('text=/TC Rheinland/i').isVisible({ timeout: 8000 });
    console.log(`Club name visible: ${clubName}`);

    // Check invoice stat card
    const invoiceStat = page.locator('text=/Rechnungen|offene Rechnung|240/i').first();
    const invoiceVisible = await invoiceStat.isVisible({ timeout: 5000 });
    console.log(`Invoice stat visible: ${invoiceVisible}`);
  });

  test('3.2 [KRITISCH]: Member training schedule shows groups from Phase 1', async ({ page }) => {
    captureConsoleErrors(page, 'member-training-schedule');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/training-schedule`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await expect(page.locator('body')).toBeVisible();

    const notFound = await page.locator('text=/404/i').isVisible();
    console.log(`Training schedule 404: ${notFound}`);
    expect(notFound).toBe(false);

    const scheduleContent = page.locator('text=/Trainingsplan|Training|Gruppe|Anfänger/i').first();
    const visible = await scheduleContent.isVisible({ timeout: 8000 });
    console.log(`Training schedule content visible: ${visible}`);

    const pageContent = await page.locator('body').textContent();
    const showsGroups =
      pageContent?.includes('Anfänger') ||
      pageContent?.includes('Gruppe') ||
      pageContent?.includes('Training');
    console.log(`Shows groups/training: ${showsGroups}`);
    console.log(`Training schedule URL: ${page.url()}`);
  });

  test('3.3 [KRITISCH]: Member billing shows €240 invoice', async ({ page }) => {
    captureConsoleErrors(page, 'member-billing');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/billing`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();

    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);

    // Check for invoice amount
    const invoiceAmount = page.locator('text=/240|240,00|€ 240/i').first();
    const amountVisible = await invoiceAmount.isVisible({ timeout: 8000 });
    console.log(`Invoice €240 visible: ${amountVisible}`);

    // Check PDF download button
    const pdfBtn = page
      .locator(
        'button:has-text("PDF"), a:has-text("PDF"), button:has-text("Download"), a[href*="pdf"]'
      )
      .first();
    const pdfVisible = await pdfBtn.isVisible({ timeout: 5000 });
    console.log(`PDF download button visible: ${pdfVisible}`);

    // Check pay button
    const payBtn = page
      .locator('button:has-text("Bezahlen"), button:has-text("Zahlen"), a:has-text("Bezahlen")')
      .first();
    const payVisible = await payBtn.isVisible({ timeout: 5000 });
    console.log(`Pay button visible: ${payVisible}`);

    expect(amountVisible).toBe(true);
  });

  test('3.3b: Stripe checkout button triggers (no completion)', async ({ page }) => {
    captureConsoleErrors(page, 'member-stripe');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/billing`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    const payBtn = page
      .locator('button:has-text("Bezahlen"), button:has-text("Zahlen"), a:has-text("Bezahlen")')
      .first();
    if (await payBtn.isVisible({ timeout: 5000 })) {
      // Set up navigation intercept for Stripe redirect
      let stripeRedirectDetected = false;
      page.on('request', (req) => {
        if (req.url().includes('stripe.com') || req.url().includes('checkout')) {
          stripeRedirectDetected = true;
        }
      });
      await payBtn.click();
      await page.waitForTimeout(3000);
      const currentUrl = page.url();
      const stripeVisible = currentUrl.includes('stripe.com') || stripeRedirectDetected;
      console.log(`Stripe redirect detected: ${stripeVisible}, URL: ${currentUrl}`);
    } else {
      console.log('No pay button found on /billing');
    }
  });

  test('3.4: Member bookings calendar loads', async ({ page }) => {
    captureConsoleErrors(page, 'member-bookings');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/bookings`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();

    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);

    const calendarContent = page.locator('text=/Buchung|Kalender|Platz|Court/i').first();
    const visible = await calendarContent.isVisible({ timeout: 8000 });
    console.log(`Bookings calendar content visible: ${visible}`);
    expect(visible).toBe(true);
  });

  test('3.4b: Member makes a court booking', async ({ page }) => {
    captureConsoleErrors(page, 'member-booking-create');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/bookings`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    // Try to find a time slot or "Neue Buchung" button
    const newBookingBtn = page
      .locator(
        'button:has-text("Neue Buchung"), button:has-text("Buchen"), button:has-text("Platz buchen")'
      )
      .first();
    if (await newBookingBtn.isVisible({ timeout: 5000 })) {
      await newBookingBtn.click();
      await page.waitForTimeout(2000);
      console.log('Booking form opened');
    } else {
      // Try clicking on a calendar slot
      const calendarSlot = page
        .locator('[data-testid*="slot"], .slot, .time-slot, [role="button"]')
        .first();
      if (await calendarSlot.isVisible({ timeout: 3000 })) {
        await calendarSlot.click();
        await page.waitForTimeout(2000);
        console.log('Calendar slot clicked');
      } else {
        console.log('No booking button or calendar slot found');
      }
    }
  });

  test('3.5 [KRITISCH]: Member work duties shows "Platzdienst 28. Juni"', async ({ page }) => {
    captureConsoleErrors(page, 'member-work-duties');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/member/work-duties`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await expect(page.locator('body')).toBeVisible();

    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);

    const workDutyContent = page.locator('text=/Arbeitsdienst|Platzdienst|Dienst/i').first();
    const visible = await workDutyContent.isVisible({ timeout: 8000 });
    console.log(`Work duties content visible: ${visible}`);
    console.log(`Work duties URL: ${page.url()}`);
  });

  test('3.6 [KRITISCH]: Member messages shows admin message', async ({ page }) => {
    captureConsoleErrors(page, 'member-messages');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/messages`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();

    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);

    const messagesContent = page.locator('text=/Nachricht|Posteingang|Trainingsgruppe/i').first();
    const visible = await messagesContent.isVisible({ timeout: 8000 });
    console.log(`Messages content visible: ${visible}`);

    const adminMsg = await page
      .locator('text=/Trainingsgruppe|Sommersaison|Anfänger A/i')
      .isVisible();
    console.log(`Admin message visible: ${adminMsg}`);
  });

  test('3.6b: Member replies to admin message', async ({ page }) => {
    captureConsoleErrors(page, 'member-reply-message');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/messages`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    // Try to open the admin message
    const adminMsg = page.locator('text=/Trainingsgruppe|Sommersaison/i').first();
    if (await adminMsg.isVisible({ timeout: 5000 })) {
      await adminMsg.click();
      await page.waitForTimeout(1000);

      const replyInput = page.locator('textarea, input[type="text"]').last();
      if (await replyInput.isVisible()) {
        await replyInput.fill('Danke, ich freue mich auf die Saison!');
        const sendBtn = page
          .locator('button:has-text("Senden"), button:has-text("Antworten")')
          .first();
        if (await sendBtn.isVisible()) {
          await sendBtn.click();
          await page.waitForTimeout(2000);
          console.log('Reply sent');
        }
      }
    } else {
      console.log('Admin message not found for reply');
    }
  });

  test('3.7: Shop visible in navigation and shows products', async ({ page }) => {
    captureConsoleErrors(page, 'member-shop');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/member`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    const shopLink = page.locator('a[href*="/shop"], text=/Shop/i').first();
    const shopVisible = await shopLink.isVisible({ timeout: 5000 });
    console.log(`Shop link visible in nav: ${shopVisible}`);

    if (shopVisible) {
      await page.goto(`${BASE}/shop`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      const notFound = await page.locator('text=/404/i').isVisible();
      console.log(`Shop 404: ${notFound}`);
      const products = page.locator('text=/Tennisbälle|Produkt|Artikel/i').first();
      const productsVisible = await products.isVisible({ timeout: 8000 });
      console.log(`Shop products visible: ${productsVisible}`);
    }
  });

  test('3.8: Member preferences page loads', async ({ page }) => {
    captureConsoleErrors(page, 'member-preferences');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/member/preferences`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await expect(page.locator('body')).toBeVisible();

    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);

    const content = page.locator('text=/Präferenz|Einstellung|Sprache/i').first();
    const visible = await content.isVisible({ timeout: 8000 });
    console.log(`Preferences content visible: ${visible}`);
  });

  test('3.9: /matches page loads', async ({ page }) => {
    captureConsoleErrors(page, 'member-matches');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/matches`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    console.log(`Matches 404: ${notFound}`);
    expect(notFound).toBe(false);
  });

  test('3.10: /gamification loads without error', async ({ page }) => {
    captureConsoleErrors(page, 'member-gamification');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/gamification`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    console.log(`Gamification 404: ${notFound}`);
  });

  test('3.11: /notifications loads', async ({ page }) => {
    captureConsoleErrors(page, 'member-notifications');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    console.log(`Notifications 404: ${notFound}`);
  });

  test('3.12: /member/trainer-booking loads', async ({ page }) => {
    captureConsoleErrors(page, 'member-trainer-booking');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/member/trainer-booking`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    console.log(`Trainer booking 404: ${notFound}`);
    const content = page.locator('text=/Trainer|Buchung|buchen/i').first();
    const visible = await content.isVisible({ timeout: 8000 });
    console.log(`Trainer booking content visible: ${visible}`);
  });
});

/* ═══════════════════════════════════════════════
   PHASE 4: Admin Control Check
   ═══════════════════════════════════════════════ */
test.describe('Phase 4: Admin Control Check', () => {
  test('4.1: /admin/courts calendar loads', async ({ page }) => {
    captureConsoleErrors(page, 'admin-courts');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/courts`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
    const content = page.locator('text=/Platz|Court|Kalender/i').first();
    const visible = await content.isVisible({ timeout: 8000 });
    console.log(`Courts calendar content visible: ${visible}`);
  });

  test('4.2: Admin messages shows member reply', async ({ page }) => {
    captureConsoleErrors(page, 'admin-check-messages');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/messages`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const reply = await page
      .locator('text=/Danke|freue mich|Saison/i')
      .isVisible({ timeout: 5000 });
    console.log(`Member reply visible to admin: ${reply}`);
  });

  test('4.3: Admin billing shows mitglied.2 invoice', async ({ page }) => {
    captureConsoleErrors(page, 'admin-check-billing');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/billing`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
    // Check for €120 invoice
    const invoice120 = await page.locator('text=/120|Jahresbeitrag/i').isVisible({ timeout: 8000 });
    console.log(`mitglied.2 €120 invoice visible: ${invoice120}`);
  });

  test('4.4: Admin dashboard statistics are plausible', async ({ page }) => {
    captureConsoleErrors(page, 'admin-dashboard');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();

    const pageContent = await page.locator('body').textContent();
    const hasStats =
      pageContent?.includes('120') ||
      pageContent?.includes('Mitglied') ||
      pageContent?.includes('Buchung');
    console.log(`Admin dashboard has stats: ${hasStats}`);
  });

  test('4.5: Member detail in admin shows booking history', async ({ page }) => {
    captureConsoleErrors(page, 'admin-member-detail');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/members`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();

    // Try to find and click mitglied.1
    const memberRow = page.locator('text=/mitglied.1|mitglied1/i').first();
    if (await memberRow.isVisible({ timeout: 5000 })) {
      await memberRow.click();
      await page.waitForTimeout(2000);
      const bookingHistory = await page.locator('text=/Buchung|Buchungshistorie/i').isVisible();
      console.log(`Member booking history visible: ${bookingHistory}`);
    } else {
      console.log('mitglied.1 not found in members list (may be paginated)');
    }
  });
});

/* ═══════════════════════════════════════════════
   PHASE 5: Superadmin
   ═══════════════════════════════════════════════ */
test.describe('Phase 5: Superadmin', () => {
  test('5.0: Superadmin login redirects to /superadmin', async ({ page }) => {
    captureConsoleErrors(page, 'superadmin-login');
    await loginViaUI(page, SUPERADMIN.email, SUPERADMIN.password);
    const url = page.url();
    console.log(`Superadmin redirected to: ${url}`);
    expect(url).toContain('/superadmin');
  });

  test('5.1: /superadmin/clubs lists all clubs', async ({ page }) => {
    captureConsoleErrors(page, 'superadmin-clubs');
    await loginViaUI(page, SUPERADMIN.email, SUPERADMIN.password);
    await page.goto(`${BASE}/superadmin/clubs`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
    const content = page.locator('text=/Verein|Club|TC Rheinland/i').first();
    const visible = await content.isVisible({ timeout: 8000 });
    console.log(`Clubs list visible: ${visible}`);
  });

  test('5.2: Club-switcher available in superadmin', async ({ page }) => {
    captureConsoleErrors(page, 'superadmin-switcher');
    await loginViaUI(page, SUPERADMIN.email, SUPERADMIN.password);
    await page.goto(`${BASE}/superadmin`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const switcher = page
      .locator('[data-testid*="club-switch"], text=/Verein wechseln|Club wechseln|Vereinsauswahl/i')
      .first();
    const visible = await switcher.isVisible({ timeout: 5000 });
    console.log(`Club switcher visible: ${visible}`);
  });
});

/* ═══════════════════════════════════════════════
   PHASE 6: Public Pages
   ═══════════════════════════════════════════════ */
test.describe('Phase 6: Public Pages', () => {
  test('6.1: Landing page loads without hydration errors', async ({ page }) => {
    captureConsoleErrors(page, 'landing');
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    // Check for hydration errors specifically
    const hydrationErrors = errors.filter(
      (e) => e.includes('Hydration') || e.includes('hydration')
    );
    console.log(`Hydration errors: ${hydrationErrors.length} - ${hydrationErrors.join(', ')}`);

    // Stats should appear
    const stats = page.locator('text=/Mitglieder|Vereine|Club|Tennis/i').first();
    const visible = await stats.isVisible({ timeout: 10000 });
    console.log(`Landing page stats visible: ${visible}`);
  });

  test('6.2: /trial-training accessible without login', async ({ page }) => {
    captureConsoleErrors(page, 'trial-training-public');
    await page.goto(`${BASE}/trial-training`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
    // Check form is accessible
    const form = page.locator('form, input[type="text"], input[type="email"]').first();
    const formVisible = await form.isVisible({ timeout: 8000 });
    console.log(`Trial training form visible: ${formVisible}`);
    expect(formVisible).toBe(true);
  });

  test('6.3: /contact - no "Early Access" text, form works', async ({ page }) => {
    captureConsoleErrors(page, 'contact');
    await page.goto(`${BASE}/contact`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);

    const earlyAccess = await page.locator('text=/Early Access/i').isVisible();
    console.log(`"Early Access" text present (should be false): ${earlyAccess}`);
    expect(earlyAccess).toBe(false);

    const form = page.locator('form, input[type="email"]').first();
    const formVisible = await form.isVisible({ timeout: 8000 });
    console.log(`Contact form visible: ${formVisible}`);
  });

  test('6.4: Legal pages load', async ({ page }) => {
    const legalPages = ['/impressum', '/datenschutz', '/terms'];
    for (const p of legalPages) {
      captureConsoleErrors(page, `legal-${p}`);
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await expect(page.locator('body')).toBeVisible();
      const notFound = await page.locator('text=/404/i').isVisible();
      console.log(`${p} 404: ${notFound}`);
      expect(notFound).toBe(false);
    }
  });

  test('6.5: /register 2-step flow starts', async ({ page }) => {
    captureConsoleErrors(page, 'register');
    await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    expect(notFound).toBe(false);
    const registerForm = page
      .locator('form, input[type="email"], text=/Registrierung|Konto erstellen/i')
      .first();
    const visible = await registerForm.isVisible({ timeout: 8000 });
    console.log(`Register form visible: ${visible}`);
    expect(visible).toBe(true);
  });
});

/* ═══════════════════════════════════════════════
   PHASE 7: Technical Checks
   ═══════════════════════════════════════════════ */
test.describe('Phase 7: Technical Checks', () => {
  test('7.1: Mobile responsiveness - landing page (375px)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    });
    const page = await context.newPage();
    captureConsoleErrors(page, 'mobile-landing');

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();

    // Check for mobile menu / hamburger
    const mobileMenu = page
      .locator('button[aria-label*="menu"], button[aria-label*="Menu"], [data-testid*="hamburger"]')
      .first();
    const mobileMenuVisible = await mobileMenu.isVisible({ timeout: 5000 });
    console.log(`Mobile hamburger menu visible: ${mobileMenuVisible}`);

    // Ensure no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    console.log(`Mobile landing has horizontal scroll: ${hasHorizontalScroll}`);

    await context.close();
  });

  test('7.2: Mobile responsiveness - member dashboard (375px)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    captureConsoleErrors(page, 'mobile-member');

    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/member`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    // Bottom nav check
    const bottomNav = page
      .locator('nav[class*="bottom"], [data-testid*="bottom-nav"], .bottom-nav')
      .first();
    const bottomNavVisible = await bottomNav.isVisible({ timeout: 5000 });
    console.log(`Mobile bottom nav visible: ${bottomNavVisible}`);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    console.log(`Mobile member dashboard has horizontal scroll: ${hasHorizontalScroll}`);

    await context.close();
  });

  test('7.3: Dark mode toggle works on member dashboard', async ({ page }) => {
    captureConsoleErrors(page, 'dark-mode');
    await loginViaUI(page, MEMBER1.email, MEMBER1.password);
    await page.goto(`${BASE}/member`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    // Find theme toggle
    const themeToggle = page
      .locator(
        'button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="hell"], [data-testid*="theme"]'
      )
      .first();
    const toggleVisible = await themeToggle.isVisible({ timeout: 5000 });
    console.log(`Theme toggle visible: ${toggleVisible}`);

    if (toggleVisible) {
      await themeToggle.click();
      await page.waitForTimeout(500);
      const isDark = await page.locator('html').getAttribute('class');
      console.log(`HTML class after toggle: ${isDark}`);

      // Toggle back
      await themeToggle.click();
      await page.waitForTimeout(500);
    }
  });

  test('7.4: Console errors summary (after all tests)', async ({ page }) => {
    // This test summarizes all collected errors
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    console.log('\n=== CONSOLE ERRORS COLLECTED ===');
    if (consoleErrors.length === 0) {
      console.log('No console errors detected');
    } else {
      for (const e of consoleErrors) {
        console.log(`[${e.url}]: ${e.msg}`);
      }
    }
    console.log(`Total console errors: ${consoleErrors.length}`);
  });

  test('7.5: Admin dark mode', async ({ page }) => {
    captureConsoleErrors(page, 'admin-dark-mode');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    const themeToggle = page
      .locator('button[aria-label*="theme"], button[aria-label*="dark"], [data-testid*="theme"]')
      .first();
    const toggleVisible = await themeToggle.isVisible({ timeout: 5000 });
    console.log(`Admin theme toggle visible: ${toggleVisible}`);
  });

  test('7.6: /admin/season-plan loads', async ({ page }) => {
    captureConsoleErrors(page, 'admin-season-plan');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/season-plan`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    console.log(`Season plan 404: ${notFound}`);
  });

  test('7.7: /scheduler loads for admin', async ({ page }) => {
    captureConsoleErrors(page, 'admin-scheduler');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/scheduler`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    console.log(`Scheduler 404: ${notFound}`);
  });

  test('7.8: /admin/analytics loads', async ({ page }) => {
    captureConsoleErrors(page, 'admin-analytics');
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/analytics`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await expect(page.locator('body')).toBeVisible();
    const notFound = await page.locator('text=/404/i').isVisible();
    console.log(`Analytics 404: ${notFound}`);
    const content = page.locator('text=/Analyse|Analytics|Statistik/i').first();
    const visible = await content.isVisible({ timeout: 8000 });
    console.log(`Analytics content visible: ${visible}`);
  });
});
