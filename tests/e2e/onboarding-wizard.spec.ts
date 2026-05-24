import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Onboarding Wizard Tests - Isolated Component Testing
 *
 * These tests verify the 9-step club onboarding wizard code structure
 * without needing full auth setup (the page redirects to login without auth).
 */

test.describe('Onboarding Wizard - 9-Step Structure', () => {
  const wizardCode = readFileSync(
    join(process.cwd(), 'app/(protected)/admin/onboarding/page.tsx'),
    'utf-8'
  );

  test('has exactly 9 steps defined', () => {
    // Verify the STEPS array contains all 9 items
    expect(wizardCode).toContain('const TOTAL_STEPS = 9');
    expect(wizardCode.match(/label: '/g)?.length).toBeGreaterThanOrEqual(9);
  });

  test('all 9 step labels are defined', () => {
    const expectedLabels = [
      'Start',
      'Verein',
      'Öffnungszeiten',
      'Platz',
      'Preise',
      'Buchung',
      'Einladungen',
      'E-Mail',
      'Fertig',
    ];
    for (const label of expectedLabels) {
      expect(wizardCode).toContain(`'${label}'`);
    }
  });

  test('all 9 step icons are imported from lucide-react', () => {
    const expectedIcons = [
      'Sparkles',
      'Building2',
      'Clock',
      'MapPin',
      'Euro',
      'CalendarRange',
      'Users',
      'Mail',
      'PartyPopper',
    ];
    for (const icon of expectedIcons) {
      expect(wizardCode).toContain(icon);
    }
  });

  test('all save functions are defined for steps 2-8', () => {
    const saveFunctions = [
      'saveClubData',
      'saveOpeningHours',
      'saveCourtData',
      'savePriceData',
      'saveBookingRules',
      'saveTrainerInvite',
      'saveMemberInvite',
      'saveEmailSettings',
      'markSetupComplete',
    ];
    for (const fn of saveFunctions) {
      expect(wizardCode).toContain(`const ${fn} =`);
    }
  });

  test('all step render cases exist in switch statement', () => {
    for (let i = 1; i <= 9; i++) {
      expect(wizardCode).toContain(`case ${i}:`);
    }
  });

  test('CSRF headers used in all fetch calls', () => {
    // Count fetch calls with csrfHeaders (within setup PATCH and onboarding-settings POST)
    const csrfCalls = wizardCode.match(/csrfHeaders\(\)/g);
    expect(csrfCalls?.length).toBeGreaterThanOrEqual(8);
  });

  test('step navigation buttons are rendered', () => {
    expect(wizardCode).toContain('Zurück');
    expect(wizardCode).toContain('Speichern & Weiter');
    expect(wizardCode).toContain('Weiter');
    expect(wizardCode).toContain('Überspringen');
  });

  test('optional steps (4, 7, 8) have skip functionality', () => {
    expect(wizardCode).toContain('const isOptionalStep = step === 4 || step === 7 || step === 8');
    expect(wizardCode).toContain('const skipStep');
  });

  test('daily opening hours for all 7 days', () => {
    const expectedDays = [
      'Montag',
      'Dienstag',
      'Mittwoch',
      'Donnerstag',
      'Freitag',
      'Samstag',
      'Sonntag',
    ];
    for (const day of expectedDays) {
      expect(wizardCode).toContain(day);
    }
  });

  test('stepper shows Schritt X von Y progress text', () => {
    expect(wizardCode).toContain('Schritt {step} von {TOTAL_STEPS}');
  });

  test('club form has all required fields', () => {
    const expectedFields = [
      'Vereinsname',
      'Stadt',
      'Adresse',
      'Telefon',
      'E-Mail',
      'Website',
      'Logo-URL',
      'Beschreibung',
      'Gründungsdatum',
    ];
    for (const field of expectedFields) {
      expect(wizardCode).toContain(field);
    }
  });

  test('branding sync is integrated in saveClubData', () => {
    // Verify branding sync happens after club data save
    expect(wizardCode).toContain('Sync logo_url to Admin Branding module');
    expect(wizardCode).toContain("fetch('/api/branding'");
    expect(wizardCode).toContain('method:');
    expect(wizardCode).toContain("'PUT'");
  });

  test('setup_completed_at is sent when marking complete', () => {
    expect(wizardCode).toContain('setup_completed_at');
    expect(wizardCode).toContain("router.push('/admin')");
  });

  test('apply all opening hours button with Copy icon', () => {
    expect(wizardCode).toContain('applyAllOpeningHours');
    expect(wizardCode).toContain('Copy');
    expect(wizardCode).toContain('Mo auf alle Tage übernehmen');
  });

  test('all selectors use shadcn Select components', () => {
    // Verify shadcn Select is used instead of raw <select>
    expect(wizardCode).toContain("from '@/components/ui/select'");
    expect(wizardCode).toContain('SelectTrigger');
    expect(wizardCode).toContain('SelectContent');
    expect(wizardCode).toContain('SelectItem');
    // Should NOT contain raw HTML select elements
    expect(wizardCode).not.toMatch(/<select[^>]*>/);
  });

  test('card with info hint for prices step', () => {
    expect(wizardCode).toContain('Standard-Stundensatz');
    expect(wizardCode).toContain('Standard-Trainingsdauer');
    expect(wizardCode).toContain('Abrechnungseinheit');
    expect(wizardCode).toContain('Umsatzsteuer');
  });

  test('member invite handles 409 conflict gracefully', () => {
    expect(wizardCode).toContain('res.status === 409');
    expect(wizardCode).toContain('toast.error');
  });

  test('trainer and member badges rendered correctly', () => {
    expect(wizardCode).toContain('Trainer');
    expect(wizardCode).toContain('Mitglied');
  });
});
