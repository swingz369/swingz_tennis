/**
 * E2E Nav-Link Smoke Test — jeder Navigations-Link, jede Rolle.
 *
 * Zieht die zu prüfenden URLs direkt aus `lib/navigation.ts` (der einzigen
 * Quelle für Sidebar, Mobile-Bottom-Nav und Command-Palette). Kommt ein
 * Nav-Eintrag dazu, wird er automatisch mitgeprüft — der Test kann nicht
 * veralten.
 *
 * Scope: Zustand eines frisch angelegten Vereins — nur die vier Kernmodule
 * (members/trainers/seasons/finance) sind aktiv, alle optionalen Module aus.
 * Genau die Links, die ein Admin beim Erstlogin sieht.
 *
 * Pro Seite wird geprüft:
 *   (a) HTTP-Status < 400
 *   (b) keine unhandled page errors
 *   (c) keine Console-Errors
 *   (d) keine 5xx-Antworten auf /api/*
 *   (e) Body gerendert (> 200 Zeichen, kein Error-Boundary-Marker)
 *
 * Bericht: `.audit-captures/nav-links-smoke.json`
 *
 * Ausführung:
 *   npx vitest run tests/browser/nav-links-smoke.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';

import { OPTIONAL_FEATURE_KEYS } from '../../lib/features';
import {
  adminSidebarSections,
  memberSidebarSections,
  trainerSidebarSections,
  mobileNavItems,
  paletteNavItems,
  paletteAdminNavItems,
} from '../../lib/navigation';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const OUT_DIR = '.audit-captures';

/** Frisch angelegter Verein: Kernmodule an, alle optionalen aus. */
const FRESH_CLUB_HIDDEN = new Set<string>(OPTIONAL_FEATURE_KEYS);

type Role = 'admin' | 'trainer' | 'member';

/** Alle Nav-Oberflächen einer Rolle zu einer deduplizierten URL-Liste. */
function navUrlsFor(role: Role): string[] {
  const hrefs: string[] = [];
  const push = (items: { href: string }[]) => items.forEach((i) => hrefs.push(i.href));

  if (role === 'admin') {
    adminSidebarSections(FRESH_CLUB_HIDDEN, false).forEach((s) => push(s.items));
    push(paletteAdminNavItems(FRESH_CLUB_HIDDEN));
  } else {
    // Trainer sieht zusätzlich die Member-Sektionen (siehe sidebar.tsx:318ff).
    const includeMemberOnly = role === 'member';
    memberSidebarSections(FRESH_CLUB_HIDDEN, includeMemberOnly).forEach((s) => push(s.items));
    if (role === 'trainer') trainerSidebarSections().forEach((s) => push(s.items));
  }

  push(mobileNavItems(role));
  push(paletteNavItems(FRESH_CLUB_HIDDEN));

  return [...new Set(hrefs)];
}

const CREDS: Record<Role, { email: string; password: string }> = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL ?? '',
    password: process.env.TEST_ADMIN_PASSWORD ?? '',
  },
  trainer: {
    email: process.env.TEST_TRAINER_EMAIL ?? '',
    password: process.env.TEST_TRAINER_PASSWORD ?? '',
  },
  member: {
    email: process.env.TEST_MEMBER_EMAIL ?? '',
    password: process.env.TEST_MEMBER_PASSWORD ?? '',
  },
};

/** Console-Rauschen, das kein Produktfehler ist. */
const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /Warning: Extra attributes from the server/i,
  /favicon/i,
];

/** Netzwerk-Rauschen (Dev-Server, Telemetrie). */
const IGNORED_NETWORK = [/_next\//, /favicon/, /\/__nextjs/, /hot-update/];

const ERROR_MARKERS = [
  'Application error',
  'Unhandled Runtime Error',
  'Ein unerwarteter Fehler ist aufgetreten',
  'This page could not be found',
  'Internal Server Error',
];

interface PageResult {
  href: string;
  status: number | null;
  finalUrl: string;
  bodyLength: number;
  consoleErrors: string[];
  pageErrors: string[];
  apiFailures: string[];
  errorMarkers: string[];
  ok: boolean;
}

async function checkPage(page: Page, href: string): Promise<PageResult> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const apiFailures: string[] = [];

  const onConsole = (msg: { type(): string; text(): string }) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    consoleErrors.push(text);
  };
  const onPageError = (err: Error) => pageErrors.push(err.message);
  const onResponse = (res: { url(): string; status(): number }) => {
    const url = res.url();
    if (IGNORED_NETWORK.some((re) => re.test(url))) return;
    if (res.status() >= 500) apiFailures.push(`${res.status()} ${url}`);
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  let status: number | null = null;
  try {
    const res = await page.goto(`${BASE_URL}${href}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    status = res?.status() ?? null;
    // `networkidle` feuert bei gestreamtem SSR, während die Suspense-Boundaries
    // noch auflösen — dann steht im Body nur der Skip-Link ("Skip to main
    // content", exakt 20 Zeichen) und intakte Seiten werden als leer gemeldet.
    await page
      .waitForFunction(() => (document.body.innerText || '').length > 200, null, {
        timeout: 15000,
      })
      .catch(() => {
        /* bleibt die Seite wirklich leer, meldet der bodyLength-Check sie unten */
      });
  } catch (err) {
    pageErrors.push(`Navigation fehlgeschlagen: ${(err as Error).message}`);
  }

  const body = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  const errorMarkers = ERROR_MARKERS.filter((m) => body.includes(m));

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('response', onResponse);

  return {
    href,
    status,
    finalUrl: page.url().replace(BASE_URL, ''),
    bodyLength: body.length,
    consoleErrors,
    pageErrors,
    apiFailures,
    errorMarkers,
    ok:
      status !== null &&
      status < 400 &&
      body.length > 200 &&
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      apiFailures.length === 0 &&
      errorMarkers.length === 0,
  };
}

let browser: Browser;
const report: Record<string, PageResult[]> = {};

beforeAll(async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  browser = await chromium.launch();
});

afterAll(async () => {
  writeFileSync(`${OUT_DIR}/nav-links-smoke.json`, JSON.stringify(report, null, 2));
  await browser?.close();
});

describe('Nav-Link Smoke — frisch angelegter Verein', () => {
  for (const role of ['admin', 'trainer', 'member'] as const) {
    it(
      `${role}: alle Nav-Links laden fehlerfrei`,
      async () => {
        const { email, password } = CREDS[role];
        expect(email, `TEST_${role.toUpperCase()}_EMAIL fehlt in .env.local`).toBeTruthy();

        const context = await browser.newContext();
        const page = await context.newPage();

        const loginRes = await page.request.post(`${BASE_URL}/api/auth/login`, {
          data: { email, password },
        });
        expect(loginRes.ok(), `Login als ${role} fehlgeschlagen`).toBe(true);

        const results: PageResult[] = [];
        for (const href of navUrlsFor(role)) {
          results.push(await checkPage(page, href));
        }
        report[role] = results;
        await context.close();

        // Ein Gate kann jede Seite auf dieselbe URL umleiten — ein Verein ohne
        // abgeschlossenes Onboarding schickt alle Admin-Routen nach
        // /admin/onboarding. Die Checks laufen dann durch, geprüft wurde aber
        // nur eine einzige Seite. Ohne diesen Alarm meldet der Test grün für
        // Links, die er nie gesehen hat.
        const byFinalUrl = new Map<string, number>();
        for (const r of results) byFinalUrl.set(r.finalUrl, (byFinalUrl.get(r.finalUrl) ?? 0) + 1);
        const [topUrl, topCount] = [...byFinalUrl.entries()].sort((a, b) => b[1] - a[1])[0] ?? [
          '',
          0,
        ];
        if (topCount > results.length / 2) {
          throw new Error(
            `${topCount}/${results.length} Links landen auf ${topUrl} — vermutlich ein Gate ` +
              `(Onboarding unvollständig, Abo überfällig). Die übrigen Seiten wurden nicht geprüft.`
          );
        }

        const broken = results.filter((r) => !r.ok);
        if (broken.length > 0) {
          const lines = broken.map(
            (r) =>
              `  ${r.href} → ${r.status} (${r.bodyLength} Zeichen)` +
              [
                ...r.errorMarkers.map((m) => `\n      Marker: ${m}`),
                ...r.pageErrors.map((m) => `\n      PageError: ${m}`),
                ...r.apiFailures.map((m) => `\n      API: ${m}`),
                ...r.consoleErrors.slice(0, 3).map((m) => `\n      Console: ${m.slice(0, 200)}`),
              ].join('')
          );
          throw new Error(
            `${broken.length}/${results.length} Nav-Links defekt für ${role}:\n${lines.join('\n')}`
          );
        }
      },
      15 * 60 * 1000
    );
  }
});
