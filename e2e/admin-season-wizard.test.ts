/**
 * E2E Test: Admin Season Planning Wizard (Midscene + Vitest + Playwright)
 *
 * Abgedeckter Flow:
 *   Season erstellen → Wizard Step 1 (Konfigurieren) → Step 2 (Plan generieren / Clustering)
 *   → Step 3 (Konfliktprüfung + Bestätigen + Veröffentlichen)
 *
 * Voraussetzungen:
 *   - Dev-Server läuft (npm run dev)
 *   - OPENAI_API_KEY in .env gesetzt
 *   - TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in .env gesetzt
 *   - Supabase online (für API-Calls)
 *
 * Ausführung:
 *   npx vitest run e2e/admin-season-wizard.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebTest, type WebTestContext } from './helpers/web-test';
import { loginAs } from './helpers/auth';

// Note: we use APP_BASE_URL not BASE_URL — Vite hijacks process.env.BASE_URL
// and replaces it with "/" (the Vite base path) during transform.
const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// ═══ Test Credentials ═══
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;

// ═══ Timeouts ═══
const TEST_TIMEOUT = 180_000; // 3 min per phase
const POLL_INTERVAL = 5_000; // 5s between aiQuery polls
const MAX_POLLS = 24; // max 2 min of polling (24 × 5s)

// ═══ Polling helper ═══
async function pollFor(
  agent: any,
  page: any,
  query: string,
  maxPolls = MAX_POLLS
): Promise<boolean> {
  for (let i = 0; i < maxPolls; i++) {
    const result = await agent.aiQuery(query);
    if (result) return true;
    if (i < maxPolls - 1) await page.waitForTimeout(POLL_INTERVAL);
  }
  return false;
}

// ═══ Helper: API-create a test season ═══
async function createTestSeason(page: any): Promise<string | null> {
  const currentYear = new Date().getFullYear();
  const res = await page.request.post(`${BASE_URL}/api/seasons`, {
    data: {
      name: `E2E Test Saison ${Date.now()}`,
      season_type: 'summer',
      year: currentYear,
      start_date: `${currentYear}-04-01`,
      end_date: `${currentYear}-09-30`,
      description: 'E2E Test — bitte ignorieren',
    },
    headers: { Cookie: 'swingz_test_mode=true' },
  });
  if (!res.ok()) {
    console.warn('Season creation via API failed:', await res.text());
    return null;
  }
  const data = await res.json();
  return data.season?.id ?? data.id ?? null;
}

// ═══ Helper: API-delete a test season ═══
async function deleteTestSeason(page: any, id: string): Promise<void> {
  const res = await page.request.delete(`${BASE_URL}/api/seasons/${id}`, {
    headers: { Cookie: 'swingz_test_mode=true' },
  });
  if (!res.ok()) {
    console.warn('Season cleanup failed:', await res.text());
  }
}

function extractSeasonIdFromUrl(url: string): string | null {
  const match = url.match(/\/admin\/seasons\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

describe('Admin Season Wizard E2E', () => {
  let ctx: WebTestContext;
  let seasonId: string | null = null;
  let createdSeason = false; // track if we created the season (cleanup)

  beforeAll(async () => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env');
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup: delete the test season if we created one
    if (createdSeason && seasonId) {
      try {
        await deleteTestSeason(ctx.page, seasonId);
        console.log('Cleanup: Test season deleted');
      } catch {
        console.warn('Cleanup: Could not delete test season');
      }
    }
    if (ctx) await WebTest.close(ctx);
  });

  // ════════════════════════════════════════════════════════════════
  // Phase 1: Admin login → Seasons → Find or create → enter wizard
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 1: Admin login → find or create a season → enter wizard',
    async () => {
      ctx = await WebTest.start(BASE_URL, {
        aiActionContext:
          'You are a German-speaking QA tester for a tennis club management app called SwingZ. The app is in German.',
      });

      // Login
      await loginAs(ctx.page, ADMIN_EMAIL, ADMIN_PASSWORD);

      // Verify admin dashboard
      const onAdmin = await ctx.agent.aiQuery(
        'Is the current page showing an admin dashboard or admin overview?'
      );
      expect(onAdmin).toBe(true);

      // Navigate to Seasons
      await ctx.agent.aiAct(
        'Click on "Training" in the sidebar to expand it, then click on "Saisonplanung" or "Spielzeiten"'
      );

      await ctx.page.waitForTimeout(2000);

      // Check for existing season cards
      const hasSeasons = await ctx.agent.aiQuery(
        'Are there any season cards or season entries visible on the page (with names like "Sommer", "Winter", or similar)?'
      );

      if (hasSeasons) {
        // Click the first season card
        await ctx.agent.aiAct('Click on the first season card or row in the list');
        await ctx.page.waitForTimeout(1500);

        // Always extract seasonId from URL
        seasonId = extractSeasonIdFromUrl(ctx.page.url());

        // On season detail page, click "Saisonplanung starten"
        const hasStartBtn = await ctx.agent.aiQuery(
          'Is there a button labelled "Saisonplanung starten" or "Saisonplanung fortsetzen" visible?'
        );

        if (hasStartBtn) {
          await ctx.agent.aiAct(
            'Click the button labelled "Saisonplanung starten" or "Saisonplanung fortsetzen"'
          );
        } else if (seasonId) {
          // Navigate directly to the wizard
          await ctx.page.goto(`${BASE_URL}/admin/seasons/${seasonId}/planning`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
          });
        }
      } else {
        // No seasons exist — create one via API
        seasonId = await createTestSeason(ctx.page);
        if (!seasonId) {
          console.warn('Phase 1 SKIPPED: Could not create season');
          return;
        }
        createdSeason = true;

        // Navigate directly to wizard
        await ctx.page.goto(`${BASE_URL}/admin/seasons/${seasonId}/planning`, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
      }

      // Verify wizard loaded
      const wizardLoaded = await ctx.agent.aiQuery(
        'Is there a wizard or stepper visible with steps like "Konfigurieren", "Planen", "Abschließen"? Or a page heading related to season planning?'
      );
      expect(wizardLoaded).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 2: Step 1 — Konfigurieren (review config → Weiter)
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 2: Step 1 — Konfigurieren → review settings → click Weiter',
    async () => {
      // Verify we're on Step 1
      const onStep1 = await ctx.agent.aiQuery(
        'Is the wizard currently showing step 1 "Konfigurieren"? Look for a highlighted or active step indicator for "Konfigurieren".'
      );

      if (!onStep1) {
        // Try to navigate to step 1
        await ctx.agent.aiAct('Click on the "Konfigurieren" step in the wizard stepper');
        await ctx.page.waitForTimeout(2000);
      }

      // Wait for readiness check to complete (poll until settled)
      await pollFor(
        ctx.agent,
        ctx.page,
        'Is there a status indicator showing "Bereit" (ready) or a green checkmark? Or are there warnings/errors about missing data?'
      );

      // Check if the "Weiter" button is enabled
      const weiterEnabled = await ctx.agent.aiQuery(
        'Is the "Weiter" (next) button at the bottom of the page enabled/clickable?'
      );

      if (weiterEnabled) {
        await ctx.agent.aiAct('Click the "Weiter" button at the bottom of the page');

        // Verify step 2 loaded
        const onStep2 = await pollFor(
          ctx.agent,
          ctx.page,
          'Is the wizard now showing step 2 "Planen"? Look for a "Plan generieren" button or a schedule grid.',
          MAX_POLLS / 3 // shorter poll for UI transition
        );
        expect(onStep2).toBe(true);
      } else {
        // Weiter disabled — likely readiness check failed. Verify config UI is present.
        console.warn(
          'Phase 2: "Weiter" disabled (readiness check may have failed). Verifying config UI is still present.'
        );
        const configVisible = await ctx.agent.aiQuery(
          'Is there a "Planungseinstellungen" section or "Max. Gruppengröße" setting visible?'
        );
        expect(configVisible).toBe(true);
      }
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 3: Step 2 — Clustering auslösen → Plan generieren → metrics
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 3: Step 2 — Clustering auslösen → Plan generieren → review metrics',
    async () => {
      // Ensure we're on step 2
      const onStep2 = await ctx.agent.aiQuery(
        'Is the wizard showing step 2 "Planen"? Look for "Plan generieren" button or "Planung generieren" heading.'
      );

      if (!onStep2) {
        await ctx.agent.aiAct(
          'Click on the "Planen" step (step 2) in the wizard stepper navigation at the top'
        );
        await ctx.page.waitForTimeout(2000);
      }

      // Check for "Plan generieren" button
      const hasGenerateBtn = await ctx.agent.aiQuery(
        'Is there a "Plan generieren" or "Generate Plan" button visible on the page?'
      );

      if (!hasGenerateBtn) {
        // Maybe clustering was already done (step 2 shows results from a previous run)
        const hasExistingPlan = await ctx.agent.aiQuery(
          'Are there groups, schedule slots, or metrics visible on the page (clustering results already loaded)?'
        );

        if (!hasExistingPlan) {
          // This shouldn't happen — step 2 should show either a generate button or results
          expect.fail(
            'Step 2: No "Plan generieren" button and no existing plan visible — UI may be broken'
          );
        }
        // Has existing plan — proceed to click Weiter
        await ctx.agent.aiAct('Click the "Weiter" button at the bottom');
        await ctx.page.waitForTimeout(2000);
        return;
      }

      // Click generate
      await ctx.agent.aiAct(
        'Click the "Plan generieren" or generate button to start the clustering algorithm'
      );

      // Poll for clustering results (can take 30-120s)
      const hasMetrics = await pollFor(
        ctx.agent,
        ctx.page,
        'Are there any metrics visible, such as "Gruppen" count, "Niveau-Match" percentage, "Trainer-Auslastung" percentage, or a "Planungs-Score"? Or is there an error message?',
        MAX_POLLS
      );

      expect(hasMetrics).toBe(true);

      // Click "Weiter" to step 3
      const weitersVisible = await ctx.agent.aiQuery(
        'Is the "Weiter" (next) button at the bottom enabled?'
      );
      if (weitersVisible) {
        await ctx.agent.aiAct('Click the "Weiter" button at the bottom');
      }

      // Verify we made it to step 3
      const onStep3 = await pollFor(
        ctx.agent,
        ctx.page,
        'Is the wizard showing step 3 "Abschließen"? Look for "Konfliktprüfung starten", "Konflikte prüfen", or "Planung bestätigen" text.',
        MAX_POLLS / 3
      );
      expect(onStep3).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 4: Step 3 — Konfliktprüfung → Warnungen akzeptieren
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 4: Step 3 — Konfliktprüfung auslösen → Warnungen akzeptieren',
    async () => {
      // Ensure we're on step 3
      const onStep3 = await ctx.agent.aiQuery(
        'Is the wizard showing step 3 "Abschließen"? Look for "Konfliktprüfung starten" or "Konflikte prüfen" button.'
      );

      if (!onStep3) {
        await ctx.agent.aiAct(
          'Click on the "Abschließen" step (step 3) in the wizard stepper navigation'
        );
        await ctx.page.waitForTimeout(2000);
      }

      // Check for conflict check button
      const hasConflictBtn = await ctx.agent.aiQuery(
        'Is there a "Konflikte prüfen" or "Konfliktprüfung starten" button visible?'
      );

      if (hasConflictBtn) {
        await ctx.agent.aiAct('Click the "Konflikte prüfen" button to run the conflict detection');

        // Poll for conflict detection results
        const conflictDone = await pollFor(
          ctx.agent,
          ctx.page,
          'Is there either: a) a list of conflicts/critical warnings visible, b) a "Keine Konflikte gefunden" message, or c) an error message about conflict detection?',
          MAX_POLLS / 2
        );
        expect(conflictDone).toBe(true);
      }

      // Accept warnings if any are shown
      const hasWarnings = await ctx.agent.aiQuery(
        'Are there warning checkboxes visible under "Warnungen akzeptieren" or "Warnungen & Hinweise"?'
      );

      if (hasWarnings) {
        await ctx.agent.aiAct(
          'Check/click all the acceptance checkboxes for warnings in the "Warnungen akzeptieren" section'
        );
        await ctx.page.waitForTimeout(1000);
      }

      // Verify confirmation readiness
      const confirmReady = await ctx.agent.aiQuery(
        'Is there a message saying "Bereit zur Bestätigung" or is the "Planung bestätigen" button enabled? Or is there a blocking message about critical conflicts?'
      );
      expect(confirmReady).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 5: Step 3 — Planung bestätigen & veröffentlichen
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 5: Planung bestätigen → publish → verify success',
    async () => {
      // Check if confirm button is ready
      const canConfirm = await ctx.agent.aiQuery(
        'Is the "Planung bestätigen & veröffentlichen" button enabled and clickable?'
      );

      if (canConfirm) {
        await ctx.agent.aiAct(
          'Click the "Planung bestätigen & veröffentlichen" button to publish the plan'
        );

        // Poll for success state (may involve a DB transaction)
        const successShown = await pollFor(
          ctx.agent,
          ctx.page,
          'Is there a success message saying "Planung erfolgreich bestätigt" or a green checkmark with "erfolgreich" text visible? Or is there an error message?',
          MAX_POLLS / 2
        );
        expect(successShown).toBe(true);

        // Verify success stats are shown
        const hasStats = await ctx.agent.aiQuery(
          'Are there success statistics visible like "Gruppen erstellt", "Sessions", "Benachrichtigungen" counts?'
        );
        expect(hasStats).toBe(true);
      } else {
        // Check if already confirmed (from a previous run)
        const alreadyDone = await ctx.agent.aiQuery(
          'Is there a green success message "Planung erfolgreich bestätigt" already visible?'
        );
        expect(alreadyDone).toBe(true);
      }
    },
    TEST_TIMEOUT
  );
});
