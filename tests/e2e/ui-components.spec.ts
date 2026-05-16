import { test, expect } from '@playwright/test';

test.describe('ConfirmDialog Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@swingz.com');
    await page.getByLabel('Passwort').fill('demo123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('ConfirmDialog opens on trainer booking slot click', async ({ page }) => {
    await page.goto('/member/trainer-booking');

    // Select first trainer
    await expect(page.getByText('Trainer buchen')).toBeVisible({ timeout: 10000 });
    const trainerCards = page.locator('.cursor-pointer').first();
    await expect(trainerCards).toBeVisible({ timeout: 10000 });
    await trainerCards.click();

    // Wait for calendar view and click an available slot
    // Available slots are buttons with time text (e.g. "09:00") inside a font-medium div
    // Use resilient structural selector: button that has a child div.font-medium (time display)
    const availableSlot = page.locator('button:has(div.font-medium)').first();
    await expect(availableSlot).toBeVisible({ timeout: 8000 });
    await availableSlot.click();

    // Verify ConfirmDialog appears
    await expect(page.getByText('Stunde buchen')).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /buchen/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /abbrechen/i })).toBeVisible();
  });

  test('ConfirmDialog can be cancelled', async ({ page }) => {
    await page.goto('/member/trainer-booking');

    // Select first trainer
    await expect(page.getByText('Trainer buchen')).toBeVisible({ timeout: 10000 });
    const trainerCards = page.locator('.cursor-pointer').first();
    await expect(trainerCards).toBeVisible({ timeout: 10000 });
    await trainerCards.click();

    // Click an available slot
    const availableSlot = page.locator('button:has(div.font-medium)').first();
    await expect(availableSlot).toBeVisible({ timeout: 8000 });
    await availableSlot.click();
    await expect(page.getByText('Stunde buchen')).toBeVisible({ timeout: 3000 });

    // Click cancel
    await page.getByRole('button', { name: /abbrechen/i }).click();

    // Dialog should close
    await expect(page.getByText('Stunde buchen')).not.toBeVisible({ timeout: 3000 });
  });

  test('ConfirmDialog renders with Calendar icon in title', async ({ page }) => {
    await page.goto('/member/trainer-booking');

    // Select first trainer
    await expect(page.getByText('Trainer buchen')).toBeVisible({ timeout: 10000 });
    const trainerCards = page.locator('.cursor-pointer').first();
    await expect(trainerCards).toBeVisible({ timeout: 10000 });
    await trainerCards.click();

    const availableSlot = page.locator('button:has(div.font-medium)').first();
    await expect(availableSlot).toBeVisible({ timeout: 8000 });
    await availableSlot.click();
    await expect(page.getByText('Stunde buchen')).toBeVisible({ timeout: 3000 });

    // Verify Calendar icon is rendered inside the dialog
    const dialogContent = page.locator('[role="dialog"]');
    await expect(dialogContent.locator('svg.lucide-calendar')).toBeVisible({ timeout: 3000 });
  });
});

test.describe('UI Components Barrel Exports', () => {
  test('page loads without hydration errors on component pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('hydrat')) {
        errors.push(msg.text());
      }
    });

    await page.goto('/login');
    await expect(page.getByText('Anmelden')).toBeVisible();

    // Navigate to pages that use IconBox, Badge, Button, Dialog variants
    await page.goto('/bookings');
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });
});
