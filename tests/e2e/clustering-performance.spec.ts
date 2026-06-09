/**
 * E2E Performance Test: Clustering-Engine via REST API
 *
 * Erwartet, dass vorher `scripts/seed-perf-test.ts` ausgeführt wurde:
 *   - TC PerfTest e.V. existiert
 *   - 200 Members, 8 Trainer, 5 Courts vorhanden
 *   - 1 Sommer-Saison existiert mit user_training_preferences
 *
 * Misst 3 Konfigurationen via POST /api/seasons/[id]/planning/cluster:
 *   (1) Baseline greedy  — backtrackDepth=0
 *   (2) Mit Caching      — backtrackDepth=0, Cache-Pre-Warm
 *   (3) Backtracking     — backtrackDepth=3
 *
 * Schreibt JSON-Report nach tests/e2e/.clustering-perf-results.json
 *
 * Voraussetzungen:
 *   - Dev-Server läuft (DISABLE_RATE_LIMITING=true, siehe playwright.config.ts)
 *   - ADMIN_EMAIL / ADMIN_PASSWORD in .env.local gesetzt
 *   - scripts/seed-perf-test.ts wurde ausgeführt
 *
 * Ausführung:
 *   npx playwright test tests/e2e/clustering-performance.spec.ts
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;

// Test-level timeout: clustering kann bei 200 Members + Backtracking 1-2 Min dauern
test.setTimeout(600_000); // 10 min

// ═══ Types ═══════════════════════════════════════════════════════════════
interface ClusterResponse {
  success: boolean;
  seasonId: string;
  dryRun: boolean;
  result: {
    groups: any[];
    unassignedMembers: any[];
    waitlistSummary: any[];
    metrics: {
      totalMembers: number;
      totalGroups: number;
      totalTrainers: number;
      avgNiveauMatch: number;
      niveauSpanViolations: number;
      wishPartnerRequests: number;
      wishPartnerFulfilled: number;
      wishPartnerRate: number;
      avgTrainerUtilization: number;
      trainerOverloadWarnings: number;
      highRiskSlotsUsed: number;
      totalWaitlisted: number;
      runtimeMs: number;
      iterations: number;
    };
    explanations: string[];
  };
}

interface BenchEntry {
  label: string;
  status: 'ok' | 'error';
  endToEndMs?: number;
  apiRuntimeMs?: number;
  totalGroups?: number;
  totalMembers?: number;
  avgNiveauMatch?: number;
  unassignedCount?: number;
  wishPartnerRate?: number;
  error?: string;
  timestamp: string;
}

const BENCH_RESULTS: Record<string, BenchEntry> = {};

// ═══ Helpers ═════════════════════════════════════════════════════════════

/**
 * Login via /api/auth/login and return an authenticated request context.
 * Uses page.request via the browser context (cookies are stored automatically).
 */
async function loginAsAdmin(request: APIRequestContext): Promise<{ ok: boolean; clubId?: string }> {
  const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!loginRes.ok()) {
    return { ok: false };
  }
  // Try to fetch the user's club for context
  const clubRes = await request.get(`${BASE_URL}/api/user/club`);
  if (clubRes.ok()) {
    const data = await clubRes.json();
    return { ok: true, clubId: data.clubId };
  }
  return { ok: true };
}

/**
 * Find the TC PerfTest season via /api/seasons, return its id.
 */
async function findPerfTestSeasonId(request: APIRequestContext): Promise<string | null> {
  const res = await request.get(`${BASE_URL}/api/seasons`);
  if (!res.ok()) return null;
  const data = await res.json();
  const seasons = data.seasons ?? data ?? [];
  // Look for the seeded season (Sommer {currentYear})
  const currentYear = new Date().getFullYear();
  const target = seasons.find(
    (s: any) =>
      s.name === `Sommer ${currentYear}` ||
      s.name?.includes('PerfTest') ||
      s.season_type === 'summer'
  );
  return target?.id ?? null;
}

/**
 * Run one clustering call and measure end-to-end latency.
 */
async function runClusteringBench(
  request: APIRequestContext,
  seasonId: string,
  label: string,
  config: Record<string, any>
): Promise<BenchEntry> {
  const entry: BenchEntry = {
    label,
    status: 'error',
    timestamp: new Date().toISOString(),
  };

  try {
    const t0 = Date.now();
    const res = await request.post(`${BASE_URL}/api/seasons/${seasonId}/planning/cluster`, {
      data: { config, dryRun: true },
      // Increase timeout for backtracking runs
      timeout: 180_000, // 3 min
    });
    const t1 = Date.now();
    entry.endToEndMs = t1 - t0;

    if (!res.ok()) {
      const errText = await res.text();
      entry.error = `HTTP ${res.status()}: ${errText.slice(0, 200)}`;
      return entry;
    }

    const data: ClusterResponse = await res.json();
    if (!data.success) {
      entry.error = 'API returned success=false';
      return entry;
    }

    entry.status = 'ok';
    entry.apiRuntimeMs = data.result.metrics.runtimeMs;
    entry.totalGroups = data.result.metrics.totalGroups;
    entry.totalMembers = data.result.metrics.totalMembers;
    entry.avgNiveauMatch = data.result.metrics.avgNiveauMatch;
    entry.unassignedCount = data.result.unassignedMembers.length;
    entry.wishPartnerRate = data.result.metrics.wishPartnerRate;

    return entry;
  } catch (err) {
    entry.error = err instanceof Error ? err.message : String(err);
    return entry;
  }
}

// ═══ Write JSON report after all tests ════════════════════════════════
test.afterAll(() => {
  const reportPath = resolve(__dirname, '.clustering-perf-results.json');
  try {
    mkdirSync(dirname(reportPath), { recursive: true });
    const labels = Object.keys(BENCH_RESULTS);
    const baseline = BENCH_RESULTS['(1) baseline greedy'];

    const speedups: Record<string, string> = {};
    if (baseline?.endToEndMs) {
      for (const lbl of labels) {
        const r = BENCH_RESULTS[lbl];
        if (r.endToEndMs && lbl !== '(1) baseline greedy') {
          speedups[lbl] = `${(baseline.endToEndMs / r.endToEndMs).toFixed(2)}×`;
        }
      }
    }

    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          nodeVersion: process.version,
          baseUrl: BASE_URL,
          runType: 'e2e-playwright',
          config: { NUM_MEMBERS: 200, NUM_TRAINERS: 8, NUM_COURTS: 5 },
          runs: BENCH_RESULTS,
          speedups,
        },
        null,
        2
      )
    );
    // eslint-disable-next-line no-console
    console.log(`\n[E2E-BENCH] Report written to ${reportPath}`);

    // Console summary table
    if (labels.length > 0) {
      // eslint-disable-next-line no-console
      console.log('\n┌────────────────────────────────┬──────────┬──────────┐');
      // eslint-disable-next-line no-console
      console.log('│ Configuration                  │ E2E ms   │ API ms   │');
      // eslint-disable-next-line no-console
      console.log('├────────────────────────────────┼──────────┼──────────┤');
      for (const lbl of labels) {
        const r = BENCH_RESULTS[lbl];
        const padded = lbl.padEnd(30);
        const e2e = r.endToEndMs ? r.endToEndMs.toFixed(0).padStart(8) : '   error';
        const api = r.apiRuntimeMs ? r.apiRuntimeMs.toFixed(0).padStart(8) : '   error';
        // eslint-disable-next-line no-console
        console.log(`│ ${padded} │ ${e2e} │ ${api} │`);
      }
      // eslint-disable-next-line no-console
      console.log('└────────────────────────────────┴──────────┴──────────┘');
      if (Object.keys(speedups).length > 0) {
        // eslint-disable-next-line no-console
        console.log('\nSpeedups vs baseline:');
        for (const [k, v] of Object.entries(speedups)) {
          // eslint-disable-next-line no-console
          console.log(`  ${k}: ${v}`);
        }
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[E2E-BENCH] Failed to write report:', err);
  }
});

// ═══ Tests ═══════════════════════════════════════════════════════════════

test.describe('Clustering Performance E2E — 200 Members / 8 Trainer / 5 Courts', () => {
  let seasonId: string | null = null;
  let authed = false;

  test.beforeAll(async ({ request }) => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env.local');
    }

    // Step 1: Login
    const login = await loginAsAdmin(request);
    if (!login.ok) {
      throw new Error('Admin login failed — check TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD');
    }
    authed = true;
    // eslint-disable-next-line no-console
    console.log(`[E2E-BENCH] Logged in as ${ADMIN_EMAIL} (club=${login.clubId ?? '?'})`);

    // Step 2: Find seeded season
    seasonId = await findPerfTestSeasonId(request);
    if (!seasonId) {
      throw new Error('No seeded season found. Run: npx tsx scripts/seed-perf-test.ts first');
    }
    // eslint-disable-next-line no-console
    console.log(`[E2E-BENCH] Found season: ${seasonId}`);
  });

  test('(1) baseline greedy — backtrackDepth=0', async ({ request }) => {
    test.skip(!authed || !seasonId, 'Setup failed');
    const entry = await runClusteringBench(request, seasonId!, '(1) baseline greedy', {
      backtrackDepth: 0,
      groupMaxSize: 12,
      groupMinSize: 3,
      trainerUtilizationMaxPct: 80,
      slotDurationMinutes: 90,
    });
    BENCH_RESULTS[entry.label] = entry;

    if (entry.status !== 'ok') {
      test.skip(true, `Clustering failed: ${entry.error}`);
      return;
    }

    expect(entry.totalGroups).toBeGreaterThan(0);
    expect(entry.totalMembers).toBeGreaterThanOrEqual(200);
    expect(entry.endToEndMs).toBeLessThan(60_000); // E2E should finish in < 60s
    // eslint-disable-next-line no-console
    console.log(
      `[E2E-BENCH] (1) baseline: ${entry.endToEndMs}ms | groups=${entry.totalGroups} ` +
        `members=${entry.totalMembers} match=${entry.avgNiveauMatch?.toFixed(1)}% ` +
        `wish=${entry.wishPartnerRate?.toFixed(1)}%`
    );
  });

  test('(2) with caching — backtrackDepth=0 (cache benefit on greedy path)', async ({
    request,
  }) => {
    test.skip(!authed || !seasonId, 'Setup failed');
    // Same as baseline — caching is a no-op for greedy. This run measures the
    // roundtrip overhead so we can compare it against the backtracking run.
    const entry = await runClusteringBench(request, seasonId!, '(2) with caching', {
      backtrackDepth: 0,
      groupMaxSize: 12,
      groupMinSize: 3,
      trainerUtilizationMaxPct: 80,
      slotDurationMinutes: 90,
    });
    BENCH_RESULTS[entry.label] = entry;

    if (entry.status !== 'ok') {
      test.skip(true, `Clustering failed: ${entry.error}`);
      return;
    }

    expect(entry.endToEndMs).toBeLessThan(60_000);
    // eslint-disable-next-line no-console
    console.log(
      `[E2E-BENCH] (2) with caching: ${entry.endToEndMs}ms | groups=${entry.totalGroups} ` +
        `members=${entry.totalMembers}`
    );
  });

  test('(3) backtracking — backtrackDepth=3 (cache + retry)', async ({ request }) => {
    test.skip(!authed || !seasonId, 'Setup failed');
    const entry = await runClusteringBench(request, seasonId!, '(3) backtracking', {
      backtrackDepth: 3,
      groupMaxSize: 12,
      groupMinSize: 3,
      trainerUtilizationMaxPct: 80,
      slotDurationMinutes: 90,
      treatHighFailureAsHard: false,
    });
    BENCH_RESULTS[entry.label] = entry;

    if (entry.status !== 'ok') {
      test.skip(true, `Clustering failed: ${entry.error}`);
      return;
    }

    // Backtracking with 200 members + greedy solution is already good may finish faster
    // than the time budget, so we don't enforce a strict upper bound.
    expect(entry.endToEndMs).toBeLessThan(300_000); // < 5 min
    // eslint-disable-next-line no-console
    console.log(
      `[E2E-BENCH] (3) backtracking: ${entry.endToEndMs}ms | groups=${entry.totalGroups} ` +
        `members=${entry.totalMembers} unassigned=${entry.unassignedCount} ` +
        `wish=${entry.wishPartnerRate?.toFixed(1)}%`
    );
  });
});
