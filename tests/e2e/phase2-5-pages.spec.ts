import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

/**
 * Phase 2-5 Page Render Tests
 * Verifies that the new pages from Phase 2-5 load correctly.
 */

test.describe('Public Registration Page', () => {
  test('registration page loads without auth', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    // /register ist heute ein Zugangs-Anfrage-Formular (kein Self-Signup)
    await expect(page.getByText('Zugang anfragen')).toBeVisible({ timeout: 8000 });
  });

  test('registration form has required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded' });
    // Zugangs-Anfrage: Name, Vereinsname, E-Mail
    await expect(page.locator('input#name')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input#clubName')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="email"], input#email').first()).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe('Admin Approvals Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  test('approvals page loads for admin', async ({ page }) => {
    await page.goto('/admin/approvals', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    // Should show approvals list or empty state
    await expect(page.locator('body')).toContainText(/genehmigung|anfrage|registrierung|keine/i, {
      timeout: 8000,
    });
  });

  test('approvals accessible from sidebar', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Seitennavigation"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Expand "Mitglieder" section
    const mitgliederButton = sidebar.getByRole('button', { name: /Mitglieder/i });
    await expect(mitgliederButton).toBeVisible({ timeout: 5000 });
    await mitgliederButton.click();

    // Click "Genehmigungen"
    const approvalsLink = sidebar.getByRole('link', { name: /Genehmigungen/i });
    await expect(approvalsLink).toBeVisible({ timeout: 5000 });
    await approvalsLink.click();
    await expect(page).toHaveURL(/\/admin\/approvals/, { timeout: 8000 });
  });
});

test.describe('Admin Reports Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  test('reports page loads for admin', async ({ page }) => {
    await page.goto('/admin/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/bericht|report|export|statistik/i, {
      timeout: 8000,
    });
  });

  test('reports accessible from sidebar', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Seitennavigation"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Expand "Finanzen" section
    const finanzenButton = sidebar.getByRole('button', { name: /Finanzen/i });
    await expect(finanzenButton).toBeVisible({ timeout: 5000 });
    await finanzenButton.click();

    // Click "Berichte"
    const reportsLink = sidebar.getByRole('link', { name: /Berichte/i });
    await expect(reportsLink).toBeVisible({ timeout: 5000 });
    await reportsLink.click();
    await expect(page).toHaveURL(/\/admin\/reports/, { timeout: 8000 });
  });
});

test.describe('Shop Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  test('shop page loads', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    // Shop might show products or empty state
    await expect(page.locator('body')).toContainText(/shop|produkt|product|artikel|keine/i, {
      timeout: 8000,
    });
  });

  test('shop accessible from sidebar settings', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Seitennavigation"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Expand "Einstellungen" section
    const settingsButton = sidebar.getByRole('button', { name: /Einstellungen/i });
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    // Click "Shop"
    const shopLink = sidebar.getByRole('link', { name: /^Shop$/i });
    await expect(shopLink).toBeVisible({ timeout: 5000 });
    await shopLink.click();
    await expect(page).toHaveURL(/\/shop/, { timeout: 8000 });
  });
});

test.describe('Gamification Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  test('gamification page loads', async ({ page }) => {
    await page.goto('/gamification', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    // Gamification might show dashboard or loading state
    await expect(page.locator('body')).toContainText(
      /gamification|punkte|badge|rangliste|leaderboard/i,
      { timeout: 8000 }
    );
  });

  test('gamification accessible from member sidebar', async ({ page }) => {
    await loginAs(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
    await page.goto('/member', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    // Sidebar-Sektion "Spielen" (standardmäßig offen) → "Erfolge & Ranglisten"
    const sidebar = page.locator('aside[aria-label="Seitennavigation"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    const gamificationLink = sidebar.getByRole('link', { name: /Erfolge/i });
    await expect(gamificationLink).toBeVisible({ timeout: 5000 });
    await gamificationLink.click();
    await expect(page).toHaveURL(/\/gamification/, { timeout: 8000 });
  });
});

test.describe('Attendance History Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
  });

  test('attendance history loads for member', async ({ page }) => {
    await page.goto('/attendance-history', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/anwesenheit|attendance|teilnahme/i, {
      timeout: 8000,
    });
  });
});

test.describe('Trainer Availability Page', () => {
  test('trainer availability page loads', async ({ page }) => {
    await loginAs(page, process.env.TEST_TRAINER_EMAIL!, process.env.TEST_TRAINER_PASSWORD!);
    await page.goto('/trainer/availability', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/verfügbarkeit|availability|kalender|zeit/i, {
      timeout: 8000,
    });
  });

  test('trainer availability accessible from bottom nav', async ({ page }) => {
    await loginAs(page, process.env.TEST_TRAINER_EMAIL!, process.env.TEST_TRAINER_PASSWORD!);
    // Bottom-Nav ist md:hidden — nur im Mobile-Viewport sichtbar
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/trainer', { waitUntil: 'domcontentloaded' });
    const bottomNav = page.locator('nav[aria-label="Navigation"]');
    await expect(bottomNav).toBeVisible({ timeout: 10000 });
    const availabilityLink = bottomNav.getByRole('link', { name: /Verfügbarkeit/i });
    await expect(availabilityLink).toBeVisible({ timeout: 5000 });
    await availabilityLink.click();
    await expect(page).toHaveURL(/\/trainer\/availability/, { timeout: 8000 });
  });
});

test.describe('Role-Based Access Control for New Pages', () => {
  test('non-admin cannot access admin/approvals', async ({ page }) => {
    await loginAs(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
    await page.goto('/admin/approvals', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => !url.pathname.includes('/admin/approvals'), { timeout: 15000 });
    expect(page.url()).not.toContain('/admin/approvals');
  });

  test('non-admin cannot access admin/reports', async ({ page }) => {
    await loginAs(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
    await page.goto('/admin/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => !url.pathname.includes('/admin/reports'), { timeout: 15000 });
    expect(page.url()).not.toContain('/admin/reports');
  });

  test('unauthenticated redirects from /shop', async ({ page }) => {
    await page.goto('/shop');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('unauthenticated redirects from /gamification', async ({ page }) => {
    await page.goto('/gamification');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
