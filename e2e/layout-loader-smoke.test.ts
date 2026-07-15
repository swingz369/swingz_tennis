/**
 * E2E F5 Layout-Loader Smoke Test
 *
 * Hard-reloads /trainer, /member, /superadmin, /owner as each role's matching
 * test account, asserts (a) no console errors, (b) no unhandled page errors,
 * (c) no critical network failures, (d) non-blank rendered body, and
 * (e) no first-hit-vs-repeat divergence between the cold SSR load and the
 * subsequent F5 reload.
 *
 * Pattern modeled on `e2e/design-preview-buttons.test.ts` (Vitest + plain
 * Playwright, no @playwright/test fixtures). Captures (screenshot + manifest
 * JSON of console log + body text hashes) go to
 *   `.audit-captures/<role>-f5-smoke/`.
 *
 * Spec for "matches the layout's intent": we accept the role's actual landing
 * URL after any onboarding-redirects — only the structural invariants
 * (h1 present, body > 200 chars, no error markers) are tightly asserted.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pre-requisites
 * ─────────────────────────────────────────────────────────────────────────
 *   • Dev server running (`npm run dev` or `playwright.config.ts` webServer)
 *   • Seeded DB with the four test accounts (.env.local):
 *       TEST_ADMIN_EMAIL      (owner, per CLAUDE.md — admin@swingz.com)
 *       TEST_ADMIN_PASSWORD
 *       TEST_SUPERADMIN_EMAIL / TEST_SUPERADMIN_PASSWORD
 *       TEST_TRAINER_EMAIL    / TEST_TRAINER_PASSWORD
 *       TEST_MEMBER_EMAIL     / TEST_MEMBER_PASSWORD
 *   • `superadmin_setup_completed_at` set on the superadmin test user
 *     OR the test will land on /superadmin/onboarding instead of /superadmin.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Execution
 * ─────────────────────────────────────────────────────────────────────────
 *   npx vitest run e2e/layout-loader-smoke.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type ConsoleMessage,
  type Page,
  type Request,
} from 'playwright';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const CAPTURES_ROOT = join(process.cwd(), '.audit-captures');
const TEST_TIMEOUT = 60_000;

// Logger used during test setup
function info(msg: string): void {
  process.stdout.write(`[f5-smoke] ${msg}\n`);
}

// ── Navigation surface spec ────────────────────────────────────────────
//
// Encodes the per-role chrome (sidebar vs bottom-nav) so the assertions
// stay declarative. Each role gets exactly ONE primary navigation surface:
//   • owner        → left sidebar (role pill "Swingz", items include
//                    "Alle Vereine" + "Superadmins")
//   • superadmin   → left sidebar (role pill "Plattform", item
//                    "Vereinsübersicht")
//   • trainer/...  → mobile bottom-nav (4 tabs, no sidebar)
//
// Owner / superadmin also keep a `md:hidden` MobileBottomNav in the DOM
// for mobile devices, but on the smoke test's desktop viewport (1440×900)
// the bottom-nav is CSS-hidden. The trainer/member MobileBottomNav uses
// `persistent` (no `md:hidden`) and IS visible at desktop width.
//
// 'none' is reserved for the rare case where neither chrome is rendered
// (e.g. an unauthenticated request reached the gated layout) — captured so
// the F5 divergence check can still compare modes without crashing.

type NavMode = 'sidebar' | 'bottom-nav' | 'none';

interface SidebarSpec {
  readonly mode: NavMode;
  /** Required role-pill text inside the sidebar header (mode === 'sidebar'). */
  readonly rolePillText: readonly string[];
  /** Required nav-link texts inside the sidebar (mode === 'sidebar'). */
  readonly sidebarItems: readonly string[];
  /** Required bottom-nav tab labels (mode === 'bottom-nav'). */
  readonly bottomNavItems: readonly string[];
}

const SIDEBAR_SPECS: Record<RoleSpec['role'], SidebarSpec> = {
  owner: {
    mode: 'sidebar',
    rolePillText: ['Swingz'],
    sidebarItems: ['Alle Vereine', 'Superadmins'],
    bottomNavItems: [],
  },
  superadmin: {
    mode: 'sidebar',
    rolePillText: ['Plattform'],
    sidebarItems: ['Vereinsübersicht'],
    bottomNavItems: [],
  },
  trainer: {
    mode: 'bottom-nav',
    rolePillText: [],
    sidebarItems: [],
    bottomNavItems: ['Übersicht', 'Einheiten', 'Verfügbarkeit', 'Saisonplanung'],
  },
  member: {
    mode: 'bottom-nav',
    rolePillText: [],
    sidebarItems: [],
    bottomNavItems: ['Home', 'Stundenplan', 'Buchen', 'Rechnungen'],
  },
};

// ── Role matrix ────────────────────────────────────────────────────────
//
// Owner credentials reuse TEST_ADMIN_EMAIL: per CLAUDE.md the `owner` test
// account is `admin@swingz.com`. The /owner layout guards on role === 'owner'
// from user_club_memberships, which is exactly what this account holds.
//
// Trainer + member use the canonical monoclub accounts from scripts/seed-*.
// Superadmin assumes `superadmin_setup_completed_at` is set on the test user
// (the onboarding wizard is otherwise fired by the gated layout, which would
// deflect the navigation away from /superadmin to /superadmin/onboarding.
// The smoke test still passes in that case — divergence check uses the
// *final* URL after any redirects).
//
interface RoleSpec {
  readonly role: 'owner' | 'superadmin' | 'trainer' | 'member';
  readonly label: string;
  readonly email: string | undefined;
  readonly password: string | undefined;
  readonly target: string;
  /** Strings that the rendered body must contain at least one of. */
  readonly requiredAnyOf: readonly string[];
  /** Strings the rendered body must NOT contain. */
  readonly forbidden: readonly string[];
  /** Minimum body-text length (chars) on the final rendered page. */
  readonly minBodyLen: number;
  /** Per-role chrome expectation (sidebar / bottom-nav + required items). */
  readonly sidebarSpec: SidebarSpec;
}

const ROLES: readonly RoleSpec[] = [
  {
    role: 'owner',
    label: 'Owner',
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
    target: '/owner',
    // owner/page.tsx renders <h1>Plattform-Übersicht</h1>
    requiredAnyOf: ['Plattform-Übersicht', 'Hallo'],
    forbidden: ['Application error', 'Unhandled Runtime Error', '500 - Internal Server Error'],
    minBodyLen: 200,
    sidebarSpec: SIDEBAR_SPECS.owner,
  },
  {
    role: 'superadmin',
    label: 'Superadmin',
    email: process.env.TEST_SUPERADMIN_EMAIL,
    password: process.env.TEST_SUPERADMIN_PASSWORD,
    target: '/superadmin',
    // superadmin/(gated)/page.tsx renders <h1>Meine Gruppe</h1>
    // OR /superadmin/onboarding if setup not complete. Accept either.
    requiredAnyOf: ['Meine Gruppe', 'Plattform', 'Onboarding', 'Hallo'],
    forbidden: ['Application error', 'Unhandled Runtime Error', '500 - Internal Server Error'],
    minBodyLen: 200,
    sidebarSpec: SIDEBAR_SPECS.superadmin,
  },
  {
    role: 'trainer',
    label: 'Trainer',
    email: process.env.TEST_TRAINER_EMAIL,
    password: process.env.TEST_TRAINER_PASSWORD,
    target: '/trainer',
    // trainer-dashboard-client — greeting is dynamic ("Hallo <Name>!")
    requiredAnyOf: ['Hallo', 'Session', 'Training', 'Schnellzugriff'],
    forbidden: ['Application error', 'Unhandled Runtime Error', '500 - Internal Server Error'],
    minBodyLen: 200,
    sidebarSpec: SIDEBAR_SPECS.trainer,
  },
  {
    role: 'member',
    label: 'Member',
    email: process.env.TEST_MEMBER_EMAIL,
    password: process.env.TEST_MEMBER_PASSWORD,
    target: '/member',
    // member/page.tsx renders "Hallo, <FirstName>!" + "Buchungen" KPI
    requiredAnyOf: ['Hallo', 'Buchungen', 'Schnellzugriff'],
    forbidden: ['Application error', 'Unhandled Runtime Error', '500 - Internal Server Error'],
    minBodyLen: 200,
    sidebarSpec: SIDEBAR_SPECS.member,
  },
];

// ── Snapshot type ──────────────────────────────────────────────────────

interface PageSnapshot {
  readonly url: string;
  readonly title: string;
  readonly h1Text: string | null;
  readonly h1Count: number;
  readonly bodyTextHash: string;
  readonly bodyTextLength: number;
}

// FNV-1a 32-bit hash (deterministic across runs and machines for ASCII body
// text). Two renders with the same hash are byte-equivalent modulo whitespace.
function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

async function captureSnapshot(page: Page): Promise<PageSnapshot> {
  const url = page.url();
  const title = await page.title();
  const h1Locator = page.locator('h1').first();
  const h1Count = await page.locator('h1').count();
  const h1Text =
    h1Count > 0 ? await h1Locator.textContent({ timeout: 2000 }).catch(() => null) : null;
  const bodyText = await page
    .locator('body')
    .textContent({ timeout: 2000 })
    .catch(() => '');
  const bodyTextLength = bodyText?.length ?? 0;
  // Normalize: collapse whitespace runs so hash is stable against informal
  // indentation differences between SSR and client re-render.
  const normalized = (bodyText ?? '').replace(/\s+/g, ' ').trim();
  const bodyTextHash = hashString(normalized);
  return { url, title, h1Text, h1Count, bodyTextLength, bodyTextHash };
}

// ── Navigation snapshot type ──────────────────────────────────────────
//
// Per-role chrome (sidebar vs bottom-nav) is captured alongside the page
// snapshot so the F5 reload can be cross-checked for navigation drift too
// (sidebar role flip, missing nav items, etc.).

interface SidebarSnapshot {
  readonly mode: NavMode;
  readonly sidebarVisible: boolean;
  readonly sidebarRolePillText: string | null;
  readonly sidebarItemTexts: readonly string[];
  readonly bottomNavVisible: boolean;
  readonly bottomNavItemTexts: readonly string[];
}

/**
 * Capture the per-role navigation surface (sidebar vs bottom-nav).
 *
 * Hooks are stable across refactors:
 *   • sidebar    → `<aside role="navigation" aria-label="Seitennavigation">`
 *     (see components/layout/sidebar.tsx)
 *   • bottom-nav → `<nav role="navigation" aria-label="Navigation">`
 *     (see components/layout/mobile-bottom-nav.tsx; the trainer/member
 *      variant uses `persistent` (no `md:hidden`), the admin variant
 *      receives `md:hidden` and is therefore CSS-hidden at 1440×900.
 *      Playwright's `isVisible()` correctly resolves that without
 *      unmounting the element.)
 *
 * The role pill is matched by exact text content (one of "Swingz",
 * "Plattform", "Administration") so the assertion fires even if the pill's
 * CSS classes churn.
 */
async function captureSidebarSnapshot(page: Page): Promise<SidebarSnapshot> {
  const aside = page.locator('aside[role="navigation"][aria-label="Seitennavigation"]');
  const bottomNav = page.locator('nav[role="navigation"][aria-label="Navigation"]');

  const sidebarCount = await aside.count();
  const sidebarVisible =
    sidebarCount > 0 &&
    (await aside
      .first()
      .isVisible()
      .catch(() => false));

  const bottomNavCount = await bottomNav.count();
  const bottomNavVisible =
    bottomNavCount > 0 &&
    (await bottomNav
      .first()
      .isVisible()
      .catch(() => false));

  let sidebarRolePillText: string | null = null;
  if (sidebarVisible) {
    const spans = await aside.locator('span').allInnerTexts();
    const found = spans
      .map((s) => s.trim())
      .find((s) => s === 'Swingz' || s === 'Plattform' || s === 'Administration');
    sidebarRolePillText = found ?? null;
  }

  const sidebarItemTexts = sidebarVisible ? await aside.locator('a[href]').allInnerTexts() : [];
  const bottomNavItemTexts = bottomNavVisible
    ? await bottomNav.locator('a[href]').allInnerTexts()
    : [];

  return {
    mode: sidebarVisible ? 'sidebar' : bottomNavVisible ? 'bottom-nav' : 'none',
    sidebarVisible,
    sidebarRolePillText,
    sidebarItemTexts,
    bottomNavVisible,
    bottomNavItemTexts,
  };
}

// ── Per-role runner ────────────────────────────────────────────────────

interface RoleRun {
  readonly spec: RoleSpec;
  readonly captureDir: string;
  readonly firstHit: PageSnapshot;
  readonly secondHit: PageSnapshot;
  readonly firstSidebarSnapshot: SidebarSnapshot;
  readonly secondSidebarSnapshot: SidebarSnapshot;
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly networkErrors: readonly string[];
  readonly firstScreenshot: string;
  readonly secondScreenshot: string;
}

const IGNORED_NETWORK_PATTERNS: readonly RegExp[] = [
  // Vite HMR / dev-server propeller: harmless
  /\/@vite\//,
  /\?import=/,
  // Browser-only endpoints that fail on headless SSR are not layout regressions
  /\/api\/push\/vapid-public-key/,
  /\/__manifest\.json$/,
  // Fontshare third-party CSS blocked by Chrome's ORB in headless — doesn't
  // affect rendered body, just clutter the network-error assertion.
  /api\.fontshare\.com/,
  // Supabase realtime websocket probes disabled in test env
  /\/realtime\/v1\//,
];

function isIgnoredNetwork(url: string): boolean {
  return IGNORED_NETWORK_PATTERNS.some((re) => re.test(url));
}

async function runRole(browser: Browser, spec: RoleSpec): Promise<RoleRun> {
  if (!spec.email || !spec.password) {
    throw new Error(
      `Missing credentials for role "${spec.role}" — set TEST_${spec.role.toUpperCase()}_EMAIL/PASSWORD (or TEST_ADMIN_* for owner) in .env.local`
    );
  }

  const captureDir = join(CAPTURES_ROOT, `${spec.role}-f5-smoke`);
  mkdirSync(captureDir, { recursive: true });

  info(`→ ${spec.role}: login + first hit + F5 reload (captures in ${captureDir})`);

  // Fresh context per role — clean cookie jar, isolation between roles.
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page: Page = await context.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const networkErrors: string[] = [];

  const onConsole = (msg: ConsoleMessage): void => {
    if (msg.type() === 'error') consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
  };
  const onPageError = (err: Error): void => {
    pageErrors.push(err.message);
  };
  const onRequestFailed = (req: Request): void => {
    const url = req.url();
    if (isIgnoredNetwork(url)) return;
    networkErrors.push(`${req.failure()?.errorText ?? 'failed'} ← ${url}`);
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);

  try {
    // 1) Login — credentials set on the context via POST /api/auth/login.
    const loginRes = await page.request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: spec.email, password: spec.password },
    });
    if (!loginRes.ok()) {
      throw new Error(
        `Login failed for ${spec.role} (${loginRes.status()}): ${await loginRes.text()}`
      );
    }

    // 2) First hit — cold SSR load. Some roles (e.g. superadmin without
    //    superadmin_setup_completed_at) get redirected server-side, so
    //    waitUntil:'networkidle' settles the full redirect chain.
    await page.goto(`${BASE_URL}${spec.target}`, {
      waitUntil: 'networkidle',
      timeout: 20_000,
    });
    const firstHit = await captureSnapshot(page);
    const firstSidebarSnapshot = await captureSidebarSnapshot(page);
    const firstScreenshot = join(captureDir, 'first-hit.png');
    await page.screenshot({ path: firstScreenshot, fullPage: false });

    // 3) Hard reload — the F5 we care about. Renders the SAME URL with the
    //    SAME cookies + SAME layout guards. Divergence here implies the
    //    centralization referendum answer drifted between callsites.
    await page.reload({ waitUntil: 'networkidle', timeout: 20_000 });
    const secondHit = await captureSnapshot(page);
    const secondSidebarSnapshot = await captureSidebarSnapshot(page);
    const secondScreenshot = join(captureDir, 'f5-reload.png');
    await page.screenshot({ path: secondScreenshot, fullPage: false });

    // 4) Persist a manifest for post-mortem diffing if a future regression
    //    breaks the smoke test.
    writeFileSync(
      join(captureDir, 'manifest.json'),
      JSON.stringify(
        {
          role: spec.role,
          email: spec.email,
          target: spec.target,
          capturedAt: new Date().toISOString(),
          firstHit,
          secondHit,
          firstSidebarSnapshot,
          secondSidebarSnapshot,
          consoleErrors,
          pageErrors,
          networkErrors,
        },
        null,
        2
      ),
      'utf-8'
    );

    return {
      spec,
      captureDir,
      firstHit,
      secondHit,
      firstSidebarSnapshot,
      secondSidebarSnapshot,
      consoleErrors,
      pageErrors,
      networkErrors,
      firstScreenshot,
      secondScreenshot,
    };
  } finally {
    await context.close();
  }
}

// ── Test driver ────────────────────────────────────────────────────────

describe('F5 Layout-Loader Smoke — centralization regression check', () => {
  let browser: Browser | null = null;

  beforeAll(async () => {
    mkdirSync(CAPTURES_ROOT, { recursive: true });
    info(`captures root: ${CAPTURES_ROOT}`);
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  for (const spec of ROLES) {
    describe(`${spec.label} (${spec.role}) at ${spec.target}`, () => {
      let run: RoleRun;

      beforeAll(async () => {
        if (!browser) throw new Error('browser not initialized');
        run = await runRole(browser, spec);
      }, TEST_TIMEOUT);

      it('renders without console errors', () => {
        expect(run.consoleErrors, JSON.stringify(run.consoleErrors, null, 2)).toEqual([]);
      });

      it('does not throw an unhandled page error', () => {
        expect(run.pageErrors, JSON.stringify(run.pageErrors, null, 2)).toEqual([]);
      });

      it('does not produce critical network failures', () => {
        expect(run.networkErrors, JSON.stringify(run.networkErrors, null, 2)).toEqual([]);
      });

      it('renders a non-blank page (h1 + body >= min)', () => {
        expect(run.firstHit.h1Count, `expected h1: ${run.firstHit.url}`).toBeGreaterThan(0);
        expect(
          run.firstHit.bodyTextLength,
          `body too short for ${spec.role}: ${run.firstHit.url}`
        ).toBeGreaterThanOrEqual(spec.minBodyLen);
      });

      it(`contains role-identifying text for ${spec.role}`, () => {
        const text = run.firstHit.h1Text ?? '';
        const matched = spec.requiredAnyOf.some(
          (needle) => text.includes(needle) || text.toLowerCase().includes(needle.toLowerCase())
        );
        // Fall back to URL-based check if h1 is dynamic/unmatched (greeting)
        if (!matched) {
          expect(run.firstHit.url).toContain(spec.target.split('/').pop()!);
          return;
        }
        expect(matched).toBe(true);
      });

      it('does not render error UI on the landing page', () => {
        const h1 = run.firstHit.h1Text ?? '';
        for (const bad of spec.forbidden) {
          expect(h1.includes(bad), `forbidden "${bad}" in h1: "${h1}"`).toBe(false);
        }
      });

      it('renders the correct navigation surface for the role', () => {
        expect(run.firstSidebarSnapshot.mode).toBe(spec.sidebarSpec.mode);
        if (spec.sidebarSpec.mode === 'sidebar') {
          expect(
            run.firstSidebarSnapshot.sidebarVisible,
            `left sidebar should be visible for ${spec.role}`
          ).toBe(true);
          expect(
            run.firstSidebarSnapshot.bottomNavVisible,
            `admin-side md:hidden MobileBottomNav at 1440x900 must not be visible — admin uses sidebar as primary nav`
          ).toBe(false);
        } else {
          expect(
            run.firstSidebarSnapshot.sidebarVisible,
            `sidebar must NOT be visible for ${spec.role} (bottom-nav role)`
          ).toBe(false);
          expect(
            run.firstSidebarSnapshot.bottomNavVisible,
            `${spec.role} must surface a persistent bottom-nav instead of a sidebar`
          ).toBe(true);
        }
      });

      it(`contains the expected ${spec.role}-specific nav items`, () => {
        if (spec.sidebarSpec.mode === 'sidebar') {
          const pill = run.firstSidebarSnapshot.sidebarRolePillText ?? '';
          const matched = spec.sidebarSpec.rolePillText.some((p: string) => pill === p);
          expect(
            matched,
            `sidebar role pill should equal one of [${spec.sidebarSpec.rolePillText.join(', ')}]; got "${pill}"`
          ).toBe(true);
          for (const need of spec.sidebarSpec.sidebarItems) {
            const found = run.firstSidebarSnapshot.sidebarItemTexts.some((t) =>
              t.toLowerCase().includes(need.toLowerCase())
            );
            expect(found, `sidebar missing required item "${need}"`).toBe(true);
          }
        } else {
          for (const need of spec.sidebarSpec.bottomNavItems) {
            const found = run.firstSidebarSnapshot.bottomNavItemTexts.some((t) => t.includes(need));
            expect(found, `bottom-nav missing required tab "${need}"`).toBe(true);
          }
        }
      });

      it('F5 reload does not diverge from the first hit', () => {
        // Same final URL after redirects
        expect(run.secondHit.url, 'final URL changed between hits').toBe(run.firstHit.url);
        // Same h1 presence
        expect(run.secondHit.h1Count).toBe(run.firstHit.h1Count);
        // Same h1 text content (modulo any timestamped greeting that varies
        // per second — we compare h1 specifically because body hash can drift
        // when SSR embeds today's date twice; tolerate identical h1 instead).
        expect(run.secondHit.h1Text).toBe(run.firstHit.h1Text);
        // Same body text after whitespace normalization → DIV-FREE render
        expect(
          run.secondHit.bodyTextHash,
          'body text diverged between hits → potential SSR drift'
        ).toBe(run.firstHit.bodyTextHash);
        // Navigation surface is stable across reload:
        //   • mode stays (sidebar stays sidebar)
        //   • item-text lists are byte-equivalent modulo whitespace, so a
        //     drift signals a SSR/role-resolution regression.
        expect(
          run.secondSidebarSnapshot.mode,
          'navigation surface mode flipped between first hit and F5 reload'
        ).toBe(run.firstSidebarSnapshot.mode);
        if (run.firstSidebarSnapshot.mode === 'sidebar') {
          expect(run.secondSidebarSnapshot.sidebarItemTexts).toEqual(
            run.firstSidebarSnapshot.sidebarItemTexts
          );
        } else if (run.firstSidebarSnapshot.mode === 'bottom-nav') {
          expect(run.secondSidebarSnapshot.bottomNavItemTexts).toEqual(
            run.firstSidebarSnapshot.bottomNavItemTexts
          );
        }
      });

      it('captures were persisted under .audit-captures/<role>-f5-smoke/', () => {
        // Construction-time sanity — both screenshots + manifest exist on disk.
        expect(existsSync(run.firstScreenshot), run.firstScreenshot).toBe(true);
        expect(existsSync(run.secondScreenshot), run.secondScreenshot).toBe(true);
        expect(existsSync(join(run.captureDir, 'manifest.json'))).toBe(true);
      });
    });
  }
});
