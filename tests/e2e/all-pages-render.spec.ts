import { test, expect, type Page } from '@playwright/test';
import { loginAsRoleAware } from '../helpers/auth';

/**
 * Comprehensive Page Rendering Tests
 *
 * Tests that every page in the application loads without errors for each role.
 * Nutzt ECHTE Logins (TEST_*-Accounts aus .env.local) — client-seitiges
 * API-Mocking kommt an der server-seitigen Auth (proxy.ts) nicht vorbei.
 */

interface RouteTest {
  path: string;
  expectedContent: string | RegExp;
  timeout?: number;
}

// Role-specific pages that SHOULD be accessible
const MEMBER_ROUTES: RouteTest[] = [
  { path: '/dashboard', expectedContent: /dashboard|SWINGZ/i },
  // /dashboard/bookings/new ist nur noch ein Redirect auf /bookings?tab=courts
  { path: '/dashboard/bookings/new', expectedContent: /buchung|platz/i },
  { path: '/bookings', expectedContent: /buchung|platz/i },
  { path: '/bookings-unified', expectedContent: /buchung|platz/i },
  { path: '/my-bookings', expectedContent: /buchung|meine/i },
  { path: '/scheduler', expectedContent: /stundenplan|scheduler/i },
  { path: '/courts', expectedContent: /platz|court/i },
  { path: '/courts/daily', expectedContent: /platz|täglich/i },
  // /training-schedule redirected auf /scheduler — Nav zeigt "Stundenplan", nicht "training"
  { path: '/training-schedule', expectedContent: /stundenplan|platz/i },
  { path: '/member', expectedContent: /mitglied|member/i },
  { path: '/member/preferences', expectedContent: /präferenz|einstellung|verfügbar/i },
  { path: '/member/profile', expectedContent: /profil/i },
  { path: '/member/tournaments', expectedContent: /turnier|tournament/i },
  { path: '/member/trainer-booking', expectedContent: /trainer|buch/i },
  { path: '/member/trial-training', expectedContent: /probetraining|trial/i },
  { path: '/member/work-duties', expectedContent: /arbeitsdienst|dienst/i },
  { path: '/search', expectedContent: /suche|search/i },
  { path: '/notifications', expectedContent: /benachrichtigung|notification/i },
  { path: '/news', expectedContent: /news|nachricht/i },
  { path: '/profile', expectedContent: /profil|profile/i },
  { path: '/billing', expectedContent: /rechnung|billing|zahlung/i },
  { path: '/attendance-history', expectedContent: /anwesenheit|attendance/i },
  { path: '/trial-training', expectedContent: /probetraining|trial/i },
  { path: '/decisions', expectedContent: /beschl|abstimm/i },
  { path: '/documents', expectedContent: /dokument/i },
  { path: '/gamification', expectedContent: /gamification|punkte|rangliste|erfolg/i },
  { path: '/matches', expectedContent: /match|spiel/i },
  // Feature-Flag partner_finder kann pro Verein deaktiviert sein — dann zeigt die Seite
  // nur den Hinweistext ("Spielpartner-Suche ... nicht aktiviert") statt des vollen Panels.
  { path: '/partner-finder', expectedContent: /matchmaking|partner|gegner|spielpartner/i },
  { path: '/meine-bestellungen', expectedContent: /bestellung|order/i },
  { path: '/messages', expectedContent: /nachricht|posteingang|message/i },
  { path: '/shop', expectedContent: /shop|produkt|artikel/i },
  { path: '/bookings/payment-success', expectedContent: /erfolg|bestätigt|zahlung|buchung/i },
];

// /admin/dashboard, /admin/schedules, /admin/courts/manage, /admin/branding,
// /admin/clubs wurden entfernt — nicht mehr testen.
// /admin/court-types und /admin/newsletters sind reine Redirect-Stubs auf
// /admin/courts bzw. /admin/email-campaigns — beide Ziele stehen unten drin.
const ADMIN_ROUTES: RouteTest[] = [
  { path: '/admin', expectedContent: /admin|dashboard|mitglied/i },
  { path: '/admin/members', expectedContent: /mitglied|member/i },
  { path: '/admin/members/family', expectedContent: /familie|mitglied/i },
  { path: '/admin/seasons', expectedContent: /saison|season/i },
  { path: '/admin/seasons/new', expectedContent: /saison|season|erstellen/i },
  { path: '/admin/courts', expectedContent: /platz|court/i },
  { path: '/admin/trainers', expectedContent: /trainer/i },
  { path: '/admin/approvals', expectedContent: /genehmigung|approval|probetraining/i },
  { path: '/admin/billing', expectedContent: /rechnung|billing|abrechnung/i },
  { path: '/admin/analytics', expectedContent: /analytics|statistik|auswertung/i },
  { path: '/admin/settings', expectedContent: /einstellung|setting/i },
  { path: '/admin/hours-logs', expectedContent: /stunden|hours/i },
  { path: '/admin/events', expectedContent: /turnier|veranstaltung|event/i },
  // Alt-Einstiege — leiten auf /admin/events?tab=… um
  { path: '/admin/tournaments', expectedContent: /turnier|tournament/i },
  { path: '/admin/tournaments/new', expectedContent: /turnier|tournament|erstellen/i },
  { path: '/admin/onboarding', expectedContent: /Schritt|Verein|onboarding/i },
  { path: '/admin/partner-finder', expectedContent: /spielpartner|niveau|mitglied/i },
  { path: '/admin/audit-logs', expectedContent: /audit|protokoll|log/i },
  { path: '/admin/documents', expectedContent: /dokument/i },
  { path: '/admin/email-campaigns', expectedContent: /e-mail|kampagne|newsletter/i },
  { path: '/admin/leagues', expectedContent: /liga|league/i },
  { path: '/admin/perf-history', expectedContent: /performance|verlauf|historie/i },
  { path: '/admin/pricing', expectedContent: /preis|pricing|tarif/i },
  { path: '/admin/shop', expectedContent: /shop|produkt|artikel/i },
  { path: '/admin/special-events', expectedContent: /veranstaltung|event/i },
  { path: '/admin/subscription', expectedContent: /abo|subscription|plan/i },
  { path: '/admin/trial-training', expectedContent: /probetraining|trial/i },
  { path: '/admin/work-duties', expectedContent: /arbeitsdienst|dienst/i },
  { path: '/admin/work-duties/assignments', expectedContent: /zuweisung|arbeitsdienst|dienst/i },
];

const TRAINER_ROUTES: RouteTest[] = [
  { path: '/trainer', expectedContent: /trainer|dashboard/i },
  { path: '/trainer/availability', expectedContent: /verfügbar|availability/i },
  { path: '/trainer/absences', expectedContent: /abwesenheit|fehlzeit/i },
  { path: '/trainer/hours-logs', expectedContent: /stunden|hours/i },
  { path: '/trainer/planning-preferences', expectedContent: /präferenz|planung/i },
  { path: '/trainer/profile', expectedContent: /profil/i },
];

const SUPERADMIN_ROUTES: RouteTest[] = [
  { path: '/superadmin', expectedContent: /verein|dashboard|übersicht/i },
  { path: '/superadmin/dashboard', expectedContent: /statistik|übersicht|verein/i },
  { path: '/superadmin/tenants', expectedContent: /mandant|tenant|verein/i },
  { path: '/superadmin/clubs', expectedContent: /club|verein/i },
  { path: '/superadmin/admins', expectedContent: /admin/i },
  { path: '/superadmin/onboarding', expectedContent: /onboarding|schritt|verein/i },
  { path: '/superadmin/settings', expectedContent: /einstellung/i },
  { path: '/superadmin/subscription', expectedContent: /abo|subscription|plan/i },
];

const OWNER_ROUTES: RouteTest[] = [
  { path: '/owner', expectedContent: /verein|club|dashboard|swingz/i },
  { path: '/owner/access', expectedContent: /zugriff|access|berechtigung/i },
  { path: '/owner/admins', expectedContent: /admin/i },
  { path: '/owner/audit', expectedContent: /audit|protokoll/i },
  { path: '/owner/billing', expectedContent: /rechnung|billing/i },
  { path: '/owner/clubs', expectedContent: /verein|club/i },
  { path: '/owner/settings', expectedContent: /einstellung/i },
  { path: '/owner/superadmins', expectedContent: /superadmin/i },
];

// Routes that the given role should NOT be able to access
const RESTRICTED_ROUTES: Record<string, string[]> = {
  member: [
    '/admin',
    '/admin/members',
    '/admin/seasons',
    '/superadmin',
    '/superadmin/dashboard',
    '/trainer',
    '/owner',
  ],
  trainer: ['/admin', '/admin/members', '/superadmin', '/superadmin/dashboard', '/owner'],
  admin: [
    '/superadmin',
    '/superadmin/dashboard',
    '/superadmin/tenants',
    '/superadmin/clubs',
    '/owner',
  ],
  superadmin: ['/owner', '/owner/clubs', '/owner/admins'],
};

function pageTest(route: RouteTest) {
  return async ({ page }: { page: Page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // domcontentloaded statt networkidle — Seiten mit Polling/Realtime werden nie "idle"
    await page.goto(route.path, {
      waitUntil: 'domcontentloaded',
      // ohne route.timeout gilt navigationTimeout aus playwright.config.ts (45s) —
      // Kaltkompilierung einer Route im Dev-Server sprengt 20s regelmäßig
      timeout: route.timeout,
    });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(route.expectedContent, {
      timeout: route.timeout || 10000,
    });
    // Keine unbehandelten JS-Exceptions (React-Dev-Profiling-Artefakte gefiltert)
    const critical = pageErrors.filter((e) => !e.includes('cannot have a negative time stamp'));
    expect(critical).toEqual([]);
  };
}

test.describe('Public Pages (no auth required)', () => {
  const PUBLIC_PAGES: RouteTest[] = [
    { path: '/', expectedContent: /swingz|tennis|sport/i, timeout: 10000 },
    { path: '/login', expectedContent: /anmelden|login/i },
    { path: '/register', expectedContent: /Zugang anfragen|registrier|Einloggen/i },
    { path: '/landing', expectedContent: /swingz|tennis|sport/i },
    { path: '/impressum', expectedContent: /impressum/i },
    { path: '/datenschutz', expectedContent: /datenschutz/i },
    { path: '/avv', expectedContent: /auftragsverarbeitung/i },
    { path: '/trial-training', expectedContent: /probetraining|trial/i },
  ];

  for (const pageDef of PUBLIC_PAGES) {
    test(`public page: ${pageDef.path} loads without errors`, pageTest(pageDef));
  }
});

test.describe('Member Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
  });

  for (const route of MEMBER_ROUTES) {
    test(`page ${route.path} loads without errors`, pageTest(route));
  }

  test('member CANNOT access admin routes', async ({ page }) => {
    for (const restricted of RESTRICTED_ROUTES.member) {
      await page.goto(restricted, { waitUntil: 'domcontentloaded' });
      await page.waitForURL((url) => !url.pathname.startsWith(restricted), { timeout: 15000 });
      expect(page.url()).not.toContain(restricted);
    }
  });
});

test.describe('Admin Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  });

  for (const route of ADMIN_ROUTES) {
    test(`page ${route.path} loads without errors`, pageTest(route));
  }

  test('admin CANNOT access superadmin routes', async ({ page }) => {
    for (const restricted of RESTRICTED_ROUTES.admin) {
      await page.goto(restricted, { waitUntil: 'domcontentloaded' });
      await page.waitForURL((url) => !url.pathname.startsWith(restricted), { timeout: 15000 });
      expect(page.url()).not.toContain(restricted);
    }
  });
});

test.describe('Trainer Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(
      page,
      process.env.TEST_TRAINER_EMAIL!,
      process.env.TEST_TRAINER_PASSWORD!
    );
  });

  for (const route of TRAINER_ROUTES) {
    test(`page ${route.path} loads without errors`, pageTest(route));
  }

  test('trainer CANNOT access admin or superadmin routes', async ({ page }) => {
    for (const restricted of RESTRICTED_ROUTES.trainer) {
      await page.goto(restricted, { waitUntil: 'domcontentloaded' });
      await page.waitForURL((url) => !url.pathname.startsWith(restricted), { timeout: 15000 });
      expect(page.url()).not.toContain(restricted);
    }
  });
});

test.describe('Superadmin Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(
      page,
      process.env.TEST_SUPERADMIN_EMAIL!,
      process.env.TEST_SUPERADMIN_PASSWORD!
    );
  });

  for (const route of SUPERADMIN_ROUTES) {
    test(`page ${route.path} loads without errors`, pageTest(route));
  }

  test('superadmin CANNOT access owner routes', async ({ page }) => {
    for (const restricted of RESTRICTED_ROUTES.superadmin) {
      await page.goto(restricted, { waitUntil: 'domcontentloaded' });
      await page.waitForURL((url) => !url.pathname.startsWith(restricted), { timeout: 15000 });
      expect(page.url()).not.toContain(restricted);
    }
  });
});

test.describe('Owner Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRoleAware(page, process.env.TEST_OWNER_EMAIL!, process.env.TEST_OWNER_PASSWORD!);
  });

  for (const route of OWNER_ROUTES) {
    test(`page ${route.path} loads without errors`, pageTest(route));
  }
});
