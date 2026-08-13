import { readFileSync } from 'fs';
import { join } from 'path';
import { test, expect } from '@playwright/test';

/**
 * Onboarding-Wizard — verbleibender Struktur-Check.
 *
 * Die früheren Assertions verglichen Quelltext-Strings mit der damaligen
 * Schrittanzahl ("const TOTAL_STEPS = 4", `label: 'Platz'`). Sie schlugen fehl,
 * sobald jemand den Wizard änderte, und fingen nie einen Fehler — sie
 * beschrieben nur den Ist-Zustand doppelt. Der Wizard ist inzwischen auf
 * Vereinsdaten + Module gekürzt; alles Weitere steht als abgeleitete
 * Einrichtungs-Checkliste auf dem Dashboard (`lib/setup-checklist.ts`, dort
 * mit echten Unit-Tests).
 *
 * Übrig bleibt die eine Zusicherung, die eine echte Regression verhindert:
 * ein nacktes `fetch()` im Wizard würde die zentrale CSRF-Behandlung umgehen.
 */
const wizardCode = readFileSync(
  join(process.cwd(), 'app/(protected)/admin/onboarding/page.tsx'),
  'utf-8'
);

test.describe('Onboarding Wizard', () => {
  test('nutzt apiFetch (zentrale CSRF-Behandlung) statt nacktem fetch', () => {
    expect(wizardCode).toContain("import { apiFetch } from '@/lib/api-fetch'");
    expect(/[^a-zA-Z.]fetch\(/.test(wizardCode.replace(/apiFetch\(/g, ''))).toBe(false);
  });
});
