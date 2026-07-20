import { readFileSync } from 'fs';
import { join } from 'path';
import { test, expect } from '@playwright/test';

/**
 * Onboarding Wizard — Struktur-Checks (Quellcode-basiert, kein Login nötig).
 * Der Wizard wurde von 9 auf 4 Schritte gekürzt (Phase 2: Onboarding kürzen):
 * Verein → Platz → Einladen → Fertig, Schritte 2–3 optional (Skip).
 */

const wizardCode = readFileSync(
  join(process.cwd(), 'app/(protected)/admin/onboarding/page.tsx'),
  'utf-8'
);

test.describe('Onboarding Wizard - 4-Step Structure', () => {
  test('has exactly 4 steps defined', () => {
    expect(wizardCode).toContain('const TOTAL_STEPS = 4');
  });

  test('all 4 step labels are defined', () => {
    for (const label of ['Verein', 'Platz', 'Einladen', 'Fertig']) {
      expect(wizardCode).toContain(`label: '${label}'`);
    }
  });

  test('save functions are defined for steps 1-3', () => {
    expect(wizardCode).toContain('const saveClubData =');
    expect(wizardCode).toContain('const saveCourtData =');
    expect(wizardCode).toContain('const saveTrainerInvite =');
  });

  test('all step render cases exist', () => {
    for (const step of [1, 2, 3, 4]) {
      expect(wizardCode).toContain(`case ${step}:`);
    }
  });

  test('optional steps (2, 3) have skip functionality', () => {
    expect(wizardCode).toContain('const isOptionalStep = step === 2 || step === 3');
    expect(wizardCode).toContain('skipStep');
  });

  test('uses apiFetch (zentrale CSRF-Behandlung) statt nacktem fetch', () => {
    expect(wizardCode).toContain("import { apiFetch } from '@/lib/api-fetch'");
    // kein direkter fetch(-Aufruf im Wizard
    expect(/[^a-zA-Z.]fetch\(/.test(wizardCode.replace(/apiFetch\(/g, ''))).toBe(false);
  });
});
