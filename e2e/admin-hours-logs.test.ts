/**
 * E2E Test: Admin Hours-Logs Flow (Midscene + Vitest + Playwright)
 *
 * Covered flow:
 *   Seed pending hours-logs → Verify KPIs → Approve one → Reject one with reason → Delete one
 *
 * Prerequisites:
 *   - Dev-Server running (npm run dev)
 *   - OPENAI_API_KEY (or compatible key) in .env
 *   - TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in .env
 *   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env (for seeding)
 *
 * Run:
 *   npx vitest run e2e/admin-hours-logs.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebTest, type WebTestContext } from './helpers/web-test';
import { loginAs } from './helpers/auth';

// Note: we use APP_BASE_URL not BASE_URL — Vite hijacks process.env.BASE_URL
const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// ═══ Test Credentials ═══
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CLUB_ID = process.env.TEST_CLUB_ID || 'e3d5e862-04e1-4214-a793-4ab2cbdeb785';

// ═══ Timeouts ═══
const TEST_TIMEOUT = 300_000; // 5 min per phase

// ═══ Test Data (seeded in beforeAll, cleaned in afterAll) ═══
let seededLogIds: string[] = [];
const SEED_TRAINER_ID = '00000000-0000-0000-0000-000000000001';
const SEED_TRAINER_NAME = 'E2E Test Trainer';

// ────────────────────────────────────────────────────────────────
// Helpers: seed / cleanup via Supabase REST API (service role)
// ────────────────────────────────────────────────────────────────
async function supabaseQuery(
  table: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: Record<string, unknown> | Record<string, unknown>[],
  query?: string
) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : undefined,
    } as Record<string, string>,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table} failed (${res.status}): ${text}`);
  }
  if (method === 'DELETE') return null;
  return res.json();
}

async function seedHoursLogs() {
  const today = new Date().toISOString().substring(0, 10);

  // Seed 3 pending logs, 1 approved log
  const rows = [
    {
      trainer_id: SEED_TRAINER_ID,
      trainer_name: SEED_TRAINER_NAME,
      date: today,
      start_time: '09:00',
      end_time: '11:00',
      duration: 120,
      type: 'training',
      status: 'pending',
      notes: 'E2E Test Stunde 1 (zum Genehmigen)',
      club_id: CLUB_ID,
    },
    {
      trainer_id: SEED_TRAINER_ID,
      trainer_name: SEED_TRAINER_NAME,
      date: today,
      start_time: '12:00',
      end_time: '14:00',
      duration: 120,
      type: 'training',
      status: 'pending',
      notes: 'E2E Test Stunde 2 (zum Ablehnen)',
      club_id: CLUB_ID,
    },
    {
      trainer_id: SEED_TRAINER_ID,
      trainer_name: SEED_TRAINER_NAME,
      date: today,
      start_time: '15:00',
      end_time: '17:00',
      duration: 120,
      type: 'training',
      status: 'pending',
      notes: 'E2E Test Stunde 3 (zum Löschen)',
      club_id: CLUB_ID,
    },
    {
      trainer_id: SEED_TRAINER_ID,
      trainer_name: SEED_TRAINER_NAME,
      date: today,
      start_time: '08:00',
      end_time: '09:00',
      duration: 60,
      type: 'training',
      status: 'approved',
      notes: 'E2E Test bereits genehmigt',
      club_id: CLUB_ID,
    },
  ];

  const inserted = await supabaseQuery('hours_logs', 'POST', rows, 'select=id,status');
  seededLogIds = inserted.map((r: { id: string }) => r.id);
  console.log(`[seed] Created ${seededLogIds.length} hours_logs:`, seededLogIds);
}

async function cleanupHoursLogs() {
  if (seededLogIds.length === 0) return;
  for (const id of seededLogIds) {
    try {
      await supabaseQuery('hours_logs', 'DELETE', undefined, `id=eq.${id}`);
    } catch {
      // ignore cleanup errors
    }
  }
  console.log(`[cleanup] Deleted ${seededLogIds.length} hours_logs`);
}

// ────────────────────────────────────────────────────────────────
// Test Suite
// ────────────────────────────────────────────────────────────────
describe('Admin Hours-Logs E2E', () => {
  let ctx: WebTestContext;

  beforeAll(async () => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env');
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    }
    await seedHoursLogs();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (ctx) await WebTest.close(ctx);
    await cleanupHoursLogs();
  });

  // ════════════════════════════════════════════════════════════════
  // Phase 1: Admin navigiert zur Stundennachweise-Seite
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 1: Admin Login → Stundennachweise-Seite laden',
    async () => {
      ctx = await WebTest.start(BASE_URL, {
        aiActionContext:
          'You are a German-speaking QA tester for a tennis club management app called SwingZ. The app is in German. You are testing the admin hours-logs (Stundennachweise) management page.',
      });

      await loginAs(ctx.page, ADMIN_EMAIL, ADMIN_PASSWORD);

      // Navigate to Stundennachweise
      await ctx.agent.aiAct(
        'Click on "Stunden-Logs" or "Stundennachweise" in the sidebar navigation under the "Training" section'
      );

      await ctx.page.waitForTimeout(2000);

      // Verify the page loaded
      const pageLoaded = await ctx.agent.aiQuery(
        'Is the current page showing a heading "Stundennachweise" and a table or list of hours log entries?'
      );
      expect(pageLoaded).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 2: KPI-Karten und Alert-Banner prüfen
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 2: KPI-Karten und Pending-Alert anzeigen',
    async () => {
      if (!ctx) {
        console.warn('Phase 2 SKIPPED: context missing');
        return;
      }

      // Verify KPI cards are visible
      const hasKpis = await ctx.agent.aiQuery(
        'Are there KPI cards showing numbers for "Gesamt", "Ausstehend", "Genehmigt", and "Stunden gesamt"?'
      );
      expect(hasKpis).toBe(true);

      // Verify pending alert banner
      const hasPendingAlert = await ctx.agent.aiQuery(
        'Is there an amber/yellow alert banner mentioning "ausstehende Stundennachweise" and showing pending hours?'
      );
      expect(hasPendingAlert).toBe(true);

      // Verify test entries are visible in the table
      const hasEntries = await ctx.agent.aiQuery(
        'Does the table contain entries with the trainer name "E2E Test Trainer"?'
      );
      expect(hasEntries).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 3: Einen ausstehenden Eintrag genehmigen
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 3: Ausstehenden Stundennachweis genehmigen',
    async () => {
      if (!ctx) {
        console.warn('Phase 3 SKIPPED: context missing');
        return;
      }

      // Count current pending entries
      const pendingBefore = await ctx.agent.aiQuery(
        'How many entries with status "Ausstehend" (amber/yellow badge) are visible in the table? Return the number.'
      );
      console.log('Phase 3: Pending before approve:', pendingBefore);

      // Click the green approve (checkmark) button on the first pending entry
      await ctx.agent.aiAct(
        'Click the green checkmark (Genehmigen) button on the first row that has an "Ausstehend" status badge'
      );

      // Wait for the API call to complete and UI to refresh
      await ctx.page.waitForTimeout(3000);

      // Verify success toast
      const toastShown = await ctx.agent.aiQuery(
        'Is there a success toast or notification saying the Stundennachweis was "genehmigt"?'
      );
      expect(toastShown).toBe(true);

      // Verify the entry now shows "Genehmigt" badge
      const hasApprovedBadge = await ctx.agent.aiQuery(
        'Is there now at least one entry with a green "Genehmigt" status badge for "E2E Test Trainer"?'
      );
      expect(hasApprovedBadge).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 4: Einen ausstehenden Eintrag ablehnen (mit Ablehnungsgrund)
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 4: Ausstehenden Stundennachweis ablehnen mit Grund',
    async () => {
      if (!ctx) {
        console.warn('Phase 4 SKIPPED: context missing');
        return;
      }

      // Click the amber/red reject (X) button on the first remaining pending entry
      await ctx.agent.aiAct(
        'Click the amber or orange X-circle (Ablehnen) button on the first row that still has an "Ausstehend" status badge'
      );

      // Wait for the reject dialog to appear
      await ctx.page.waitForTimeout(1000);

      // Verify the reject dialog opened
      const dialogVisible = await ctx.agent.aiQuery(
        'Is there a dialog or modal titled "Stundennachweis ablehnen" with an input field for "Ablehnungsgrund"?'
      );
      expect(dialogVisible).toBe(true);

      // Type a rejection reason
      await ctx.agent.aiAct(
        'In the "Ablehnungsgrund" input field, type "Falsche Stunden angegeben - nur 1h gearbeitet"'
      );

      // Click the "Ablehnen" button in the dialog
      await ctx.agent.aiAct(
        'Click the red "Ablehnen" button in the rejection dialog (not the "Abbrechen" button)'
      );

      // Wait for the API call to complete
      await ctx.page.waitForTimeout(3000);

      // Verify success toast
      const rejectToast = await ctx.agent.aiQuery(
        'Is there a success toast or notification saying the Stundennachweis was "abgelehnt"?'
      );
      expect(rejectToast).toBe(true);

      // Verify the entry now shows "Abgelehnt" badge
      const hasRejectedBadge = await ctx.agent.aiQuery(
        'Is there now at least one entry with a red "Abgelehnt" status badge for "E2E Test Trainer"?'
      );
      expect(hasRejectedBadge).toBe(true);

      // Verify rejection reason is displayed as an extra row
      const reasonShown = await ctx.agent.aiQuery(
        'Is there a row below the rejected entry showing "Ablehnungsgrund: Falsche Stunden angegeben"?'
      );
      expect(reasonShown).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 5: Filter nach Status prüfen
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 5: Status-Filter funktioniert',
    async () => {
      if (!ctx) {
        console.warn('Phase 5 SKIPPED: context missing');
        return;
      }

      // Filter by "Ausstehend"
      await ctx.agent.aiAct(
        'Click on the Status filter dropdown (labeled "Status") and select "Ausstehend"'
      );

      await ctx.page.waitForTimeout(2000);

      // Verify only pending entries are shown
      const onlyPending = await ctx.agent.aiQuery(
        'Are all visible entries in the table showing an "Ausstehend" status badge? There should be no "Genehmigt" or "Abgelehnt" entries.'
      );
      expect(onlyPending).toBe(true);

      // Reset filter to "Alle"
      await ctx.agent.aiAct('Click on the Status filter dropdown and select "Alle"');

      await ctx.page.waitForTimeout(2000);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 6: Einen Eintrag löschen (mit Bestätigungsdialog)
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 6: Stundennachweis löschen mit Bestätigungsdialog',
    async () => {
      if (!ctx) {
        console.warn('Phase 6 SKIPPED: context missing');
        return;
      }

      // Remember how many entries we have
      const entriesBefore = await ctx.agent.aiQuery(
        'How many entries are visible in the table? Return the number.'
      );
      console.log('Phase 6: Entries before delete:', entriesBefore);

      // Click the red trash/delete button on the first entry that is still pending
      await ctx.agent.aiAct(
        'Click the red trash (Löschen) button on the first entry that has an "Ausstehend" status badge'
      );

      // Wait for confirmation dialog
      await ctx.page.waitForTimeout(1000);

      // Verify delete confirmation dialog
      const deleteDialog = await ctx.agent.aiQuery(
        'Is there a confirmation dialog asking "Stundennachweis löschen?" with "Abbrechen" and "Löschen" buttons?'
      );
      expect(deleteDialog).toBe(true);

      // Click the red "Löschen" button in the dialog
      await ctx.agent.aiAct('Click the red "Löschen" button in the delete confirmation dialog');

      // Wait for the API call
      await ctx.page.waitForTimeout(3000);

      // Verify success toast
      const deleteToast = await ctx.agent.aiQuery(
        'Is there a success toast or notification saying the Stundennachweis was "gelöscht"?'
      );
      expect(deleteToast).toBe(true);
    },
    TEST_TIMEOUT
  );
});
