import { test, expect } from '@playwright/test';
import { loginAsRoleAware } from '../helpers/auth';
import { runAxe } from './helpers/axe';

/**
 * axe-core über die angemeldeten Kernseiten (Member-/Admin-/Trainer).
 *
 * Ergänzt `accessibility-smoke.spec.ts`, das nur die öffentlichen Seiten abdeckt.
 * Hier läuft bewusst **nur** axe-core (serious+critical), nicht der strukturelle
 * Smoke: dessen Regeln „genau eine <h1>" / „ein <main>-Landmark" sind für komplexe
 * App-Seiten zu streng und würden das Gate instabil machen. Motion bleibt separat
 * in `prefers-reduced-motion.spec.ts`.
 *
 * Voraussetzung: `TEST_MEMBER_*` / `TEST_ADMIN_*` / `TEST_TRAINER_*` in `.env.local`
 * (echte Supabase-Logins via `tests/helpers/auth.ts`).
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

type Role = 'member' | 'admin' | 'trainer';

interface AuthedPage {
  role: Role;
  path: string;
  label: string;
}

const AUTHD_PAGES: AuthedPage[] = [
  { role: 'member', path: '/member', label: 'Member-Dashboard' },
  { role: 'member', path: '/bookings', label: 'Buchungen' },
  { role: 'admin', path: '/admin', label: 'Admin-Dashboard' },
  { role: 'admin', path: '/admin/members', label: 'Mitgliederverwaltung' },
  { role: 'trainer', path: '/trainer', label: 'Trainer-Dashboard' },
];

function credentials(role: Role): { email: string; password: string } {
  switch (role) {
    case 'member':
      return {
        email: process.env.TEST_MEMBER_EMAIL!,
        password: process.env.TEST_MEMBER_PASSWORD!,
      };
    case 'admin':
      return {
        email: process.env.TEST_ADMIN_EMAIL!,
        password: process.env.TEST_ADMIN_PASSWORD!,
      };
    case 'trainer':
      return {
        email: process.env.TEST_TRAINER_EMAIL!,
        password: process.env.TEST_TRAINER_PASSWORD!,
      };
  }
}

for (const { role, path, label } of AUTHD_PAGES) {
  for (const theme of ['light', 'dark']) {
    for (const width of [1440, 390]) {
      test(`axe-core: ${label} (${role} → ${path}, ${theme}, ${width}px)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
        const { email, password } = credentials(role);
        await loginAsRoleAware(page, email, password);
        await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        // Wait for the actual page content, including cold client/API compilation.
        await expect(page.locator('main h1').first()).toBeVisible({ timeout: 30000 });
        await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));

        const violations = await runAxe(page);

        expect(
          violations.map((v) => `${v.id} [${v.impact}] (${v.nodes}×): ${v.description}`),
          `axe-core serious+critical auf ${label}`
        ).toEqual([]);
      });
    }
  }
}
