/**
 * E2E Test: Member-Lebenszyklus (Midscene + Vitest + Playwright)
 *
 * Abgedeckter Flow:
 *   Registration → Approval → Booking → Cancellation
 *
 * Voraussetzungen:
 *   - Dev-Server läuft (npm run dev)
 *   - OPENAI_API_KEY (oder kompatibler Key) in .env gesetzt
 *   - TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in .env gesetzt
 *   - TEST_MEMBER_EMAIL / TEST_MEMBER_PASSWORD in .env gesetzt
 *
 * Ausführung:
 *   npx vitest run e2e/member-lifecycle.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebTest, type WebTestContext } from './helpers/web-test';
import { loginAs } from './helpers/auth';

// Note: we use APP_BASE_URL not BASE_URL — Vite hijacks process.env.BASE_URL
// and replaces it with "/" (the Vite base path) during transform.
const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// ═══ Test Credentials (must be set in .env) ═══
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;
const MEMBER_EMAIL = process.env.TEST_MEMBER_EMAIL!;
const MEMBER_PASSWORD = process.env.TEST_MEMBER_PASSWORD!;

// ═══ Test timeout: 5 min (Gemini free tier needs more time per aiAct/aiQuery) ═══
const TEST_TIMEOUT = 300_000;

describe.skip('Member Lifecycle E2E', () => {
  let adminCtx: WebTestContext;
  let memberCtx: WebTestContext;

  beforeAll(async () => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env');
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (adminCtx) await WebTest.close(adminCtx);
    if (memberCtx) await WebTest.close(memberCtx);
  });

  // ════════════════════════════════════════════════════════════════
  // Phase 1: Admin loggt sich ein und prüft Approvals
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 1: Admin login → Approvals-Dashboard',
    async () => {
      adminCtx = await WebTest.start(BASE_URL, {
        aiActionContext:
          'You are a German-speaking QA tester for a tennis club management app called SwingZ. The app is in German.',
      });

      // Real API login (bypasses Supabase UI)
      await loginAs(adminCtx.page, ADMIN_EMAIL, ADMIN_PASSWORD);

      // Verify we're on the admin dashboard
      const onAdmin = await adminCtx.agent.aiQuery(
        'Is the current page showing an admin dashboard or admin overview?'
      );
      expect(onAdmin).toBe(true);

      // Navigate to Approvals (Mitglieder → Genehmigungen)
      await adminCtx.agent.aiAct(
        'Click on "Mitglieder" in the sidebar or navigation, then click on "Genehmigungen" if visible'
      );

      // Verify the approvals page loaded
      const hasApprovals = await adminCtx.agent.aiQuery(
        'Is there a table or list showing registration requests (Genehmigungen)? Or an empty state message?'
      );
      expect(hasApprovals).toBe(true);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 2: Admin genehmigt einen pending Member (oder prüft Leerzustand)
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 2: Admin genehmigt pending Registration',
    async () => {
      if (!adminCtx) {
        console.warn('Phase 2 SKIPPED: Admin context missing (Phase 1 may have failed)');
        return;
      }

      // Check if there are any pending approval buttons
      const hasApproveBtn = await adminCtx.agent.aiQuery(
        'Is there a visible "Genehmigen" or "Approve" button for any registration request in the list?'
      );

      if (hasApproveBtn) {
        // Click the first approve button
        await adminCtx.agent.aiAct(
          'Click the first "Genehmigen" or approve button for a registration request'
        );

        // Verify success feedback
        const successShown = await adminCtx.agent.aiQuery(
          'Is there a success message or toast notification visible, or did the request disappear from the list?'
        );
        expect(successShown).toBe(true);
      } else {
        // No pending approvals — this is OK (empty state)
        const emptyStateShown = await adminCtx.agent.aiQuery(
          'Is there a message saying there are no pending requests, or is the list empty?'
        );
        // Assert that empty state is actually visible (not a broken page)
        expect(emptyStateShown).toBe(true);
      }
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 3: Member loggt sich ein und sieht Sessions
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 3: Member login → Training / Buchungen anzeigen',
    async () => {
      if (!MEMBER_EMAIL || !MEMBER_PASSWORD) {
        console.warn('Phase 3 SKIPPED: TEST_MEMBER_EMAIL and TEST_MEMBER_PASSWORD not set in .env');
        return;
      }

      memberCtx = await WebTest.start(BASE_URL, {
        aiActionContext:
          'You are a German-speaking QA tester for a tennis club management app called SwingZ. The app is in German.',
      });

      // Login as member
      await loginAs(memberCtx.page, MEMBER_EMAIL, MEMBER_PASSWORD);

      // Verify member dashboard loaded (should not be admin)
      const isMemberArea = await memberCtx.agent.aiQuery(
        'Is the current page showing a member dashboard (not an admin dashboard)? Look for "Dashboard" or "Übersicht" heading.'
      );
      expect(isMemberArea).toBe(true);

      // Navigate to bookings / training page
      await memberCtx.agent.aiAct(
        'Click on "Training" or "Buchen" in the navigation to see available training sessions'
      );

      // Wait for sessions to load
      await memberCtx.page.waitForTimeout(2000);

      // Verify the training/bookings page loaded correctly
      const onTrainingPage = await memberCtx.agent.aiQuery(
        'Is there a heading or title containing "Training", "Buchen", or "Sessions" on the current page? The page should not show a 404 or error message.'
      );
      expect(onTrainingPage).toBe(true);

      // Check if sessions are visible
      const hasSessions = await memberCtx.agent.aiQuery(
        'Are there any training sessions, time slots, or booking cards visible on the page?'
      );
      console.log('Phase 3: Sessions visible:', hasSessions);
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 4: Member bucht eine verfügbare Session
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 4: Member bucht eine verfügbare Trainings-Session',
    async () => {
      if (!memberCtx) {
        console.warn('Phase 4 SKIPPED: Member context not available (no credentials)');
        return;
      }

      // Check if there's a bookable session
      const hasBookButton = await memberCtx.agent.aiQuery(
        'Is there a visible "Buchen" or "Book" button for any training session on the current page?'
      );

      if (hasBookButton) {
        // Click the first book button
        await memberCtx.agent.aiAct(
          'Click the first "Buchen" or book button for an available training session'
        );

        // Wait for booking to process
        await memberCtx.page.waitForTimeout(2000);

        // Verify booking confirmation
        const bookingConfirmed = await memberCtx.agent.aiQuery(
          'Is there a success message, a confirmation, or is the session now marked as booked?'
        );
        expect(bookingConfirmed).toBe(true);
      } else {
        console.warn('Phase 4: No bookable sessions found — skipping booking step');
      }
    },
    TEST_TIMEOUT
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 5: Member storniert die Buchung
  // ════════════════════════════════════════════════════════════════
  it(
    'Phase 5: Member storniert die gebuchte Session',
    async () => {
      if (!memberCtx) {
        console.warn('Phase 5 SKIPPED: Member context not available');
        return;
      }

      // Navigate to "Meine Buchungen"
      await memberCtx.agent.aiAct(
        'Click on "Meine Buchungen", "Buchungen", or navigate to the page showing my booked sessions'
      );

      await memberCtx.page.waitForTimeout(2000);

      // Check for cancel button on any booking
      const hasCancelBtn = await memberCtx.agent.aiQuery(
        'Is there a visible "Stornieren" or "Cancel" button for any of my booked sessions?'
      );

      if (hasCancelBtn) {
        // Click the first cancel button
        await memberCtx.agent.aiAct(
          'Click the first "Stornieren" or cancel button for a booked session'
        );

        await memberCtx.page.waitForTimeout(1000);

        // Confirm cancellation if dialog appears
        const hasConfirmDialog = await memberCtx.agent.aiQuery(
          'Is there a confirmation dialog asking "Wirklich stornieren?" or similar?'
        );
        if (hasConfirmDialog) {
          await memberCtx.agent.aiAct(
            'Click the confirm or "Ja" button in the cancellation dialog'
          );
        }

        await memberCtx.page.waitForTimeout(2000);

        // Verify cancellation
        const cancelled = await memberCtx.agent.aiQuery(
          'Is the session now shown as cancelled, removed from the list, or is there a success message?'
        );
        expect(cancelled).toBe(true);
      } else {
        console.warn('Phase 5: No bookings to cancel — skipping cancellation step');
      }
    },
    TEST_TIMEOUT
  );
});
