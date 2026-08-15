import { NextResponse, type NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { requireAdminClub } from '@/lib/admin-context';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const BENCH_DIR = resolve(process.cwd(), 'tests', 'bench');
const FIXED_RESULTS_PATH = resolve(BENCH_DIR, '.bench-results.json');
const SCALING_RESULTS_PATH = resolve(BENCH_DIR, '.scaling-results.json');

/**
 * Unified schema for both bench sources. The chart component renders a single
 * timeline of `meanMs` (or other metrics) per (source, numMembers, config).
 */
export interface PerfHistoryPoint {
  source: 'local-bench' | 'local-scaling' | 'github';
  runId: string;
  label: string;
  timestamp: string;
  numMembers: number | null;
  numTrainers: number | null;
  numCourts: number | null;
  meanMs: number;
  minMs: number | null;
  maxMs: number | null;
  totalGroups: number | null;
  unassignedCount: number | null;
  wishPartnerRate: number | null;
}

export interface PerfHistoryPayload {
  generatedAt: string;
  sources: {
    fixedBench: { path: string; available: boolean; error?: string };
    scalingBench: { path: string; available: boolean; error?: string };
  };
  points: PerfHistoryPoint[];
}

/**
 * Convert an unknown caught error into a short string for the API response.
 */
function _errToMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Read a JSON file, returning `null` if it doesn't exist (ENOENT) and the raw
 * parsed object otherwise. Errors other than ENOENT are re-thrown so we can
 * surface them in the response.
 */
async function readJsonOrNull(path: string): Promise<unknown | null> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

function toPointsFromFixedBench(raw: unknown): PerfHistoryPoint[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as {
    generatedAt?: unknown;
    runs?: Record<string, unknown>;
  };
  const runs = obj.runs ?? {};
  const points: PerfHistoryPoint[] = [];
  for (const [runId, run] of Object.entries(runs)) {
    if (!run || typeof run !== 'object') continue;
    const r = run as {
      label?: unknown;
      timestamp?: unknown;
      meanMs?: unknown;
      minMs?: unknown;
      maxMs?: unknown;
      totalGroups?: unknown;
      unassignedCount?: unknown;
      wishPartnerRate?: unknown;
      config?: { NUM_MEMBERS?: unknown; NUM_TRAINERS?: unknown; NUM_COURTS?: unknown };
    };
    points.push({
      source: 'local-bench',
      runId,
      label: typeof r.label === 'string' ? r.label : runId,
      timestamp:
        typeof r.timestamp === 'string'
          ? r.timestamp
          : typeof obj.generatedAt === 'string'
            ? obj.generatedAt
            : new Date(0).toISOString(),
      numMembers: typeof r.config?.NUM_MEMBERS === 'number' ? r.config.NUM_MEMBERS : null,
      numTrainers: typeof r.config?.NUM_TRAINERS === 'number' ? r.config.NUM_TRAINERS : null,
      numCourts: typeof r.config?.NUM_COURTS === 'number' ? r.config.NUM_COURTS : null,
      meanMs: typeof r.meanMs === 'number' ? r.meanMs : 0,
      minMs: typeof r.minMs === 'number' ? r.minMs : null,
      maxMs: typeof r.maxMs === 'number' ? r.maxMs : null,
      totalGroups: typeof r.totalGroups === 'number' ? r.totalGroups : null,
      unassignedCount: typeof r.unassignedCount === 'number' ? r.unassignedCount : null,
      wishPartnerRate: typeof r.wishPartnerRate === 'number' ? r.wishPartnerRate : null,
    });
  }
  return points;
}

function toPointsFromScalingBench(raw: unknown): PerfHistoryPoint[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as {
    generatedAt?: unknown;
    runs?: Record<string, unknown>;
    config?: { DATASET_SIZES?: unknown; NUM_TRAINERS?: unknown; NUM_COURTS?: unknown };
  };
  const runs = obj.runs ?? {};
  const points: PerfHistoryPoint[] = [];
  for (const [runId, run] of Object.entries(runs)) {
    if (!run || typeof run !== 'object') continue;
    const r = run as {
      label?: unknown;
      numMembers?: unknown;
      timestamp?: unknown;
      meanMs?: unknown;
      totalGroups?: unknown;
      unassignedCount?: unknown;
      wishPartnerRate?: unknown;
    };
    points.push({
      source: 'local-scaling',
      runId,
      label: typeof r.label === 'string' ? r.label : runId,
      timestamp:
        typeof r.timestamp === 'string'
          ? r.timestamp
          : typeof obj.generatedAt === 'string'
            ? obj.generatedAt
            : new Date(0).toISOString(),
      numMembers: typeof r.numMembers === 'number' ? r.numMembers : null,
      numTrainers: typeof obj.config?.NUM_TRAINERS === 'number' ? obj.config.NUM_TRAINERS : null,
      numCourts: typeof obj.config?.NUM_COURTS === 'number' ? obj.config.NUM_COURTS : null,
      meanMs: typeof r.meanMs === 'number' ? r.meanMs : 0,
      minMs: null,
      maxMs: null,
      totalGroups: typeof r.totalGroups === 'number' ? r.totalGroups : null,
      unassignedCount: typeof r.unassignedCount === 'number' ? r.unassignedCount : null,
      wishPartnerRate: typeof r.wishPartnerRate === 'number' ? r.wishPartnerRate : null,
    });
  }
  return points;
}

/**
 * GET /api/admin/perf-history/local
 *
 * Reads both local bench JSON files and returns a unified, chronologically
 * sorted array of `PerfHistoryPoint`. Each point carries a `source` field so
 * the chart component can color-code local vs. CI runs.
 *
 * Admin-only (requireAdminClub guard). Rate-limited per the standard
 * `checkRateLimitOrFail` middleware to prevent abuse if the file size grows.
 */
export async function GET(_req: NextRequest) {
  try {
    await requireAdminClub();
  } catch {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
  }

  const rateLimitResponse = await checkRateLimitOrFail(_req, RATE_LIMITS.STANDARD);
  if (rateLimitResponse) return rateLimitResponse;

  const payload: PerfHistoryPayload = {
    generatedAt: new Date().toISOString(),
    sources: {
      fixedBench: { path: FIXED_RESULTS_PATH, available: false },
      scalingBench: { path: SCALING_RESULTS_PATH, available: false },
    },
    points: [],
  };

  try {
    const fixedRaw = await readJsonOrNull(FIXED_RESULTS_PATH);
    if (fixedRaw === null) {
      payload.sources.fixedBench.error = 'File not found';
    } else {
      payload.sources.fixedBench.available = true;
      payload.points.push(...toPointsFromFixedBench(fixedRaw));
    }
  } catch (err) {
    payload.sources.fixedBench.error = err instanceof Error ? err.message : String(err);
  }

  try {
    const scalingRaw = await readJsonOrNull(SCALING_RESULTS_PATH);
    if (scalingRaw === null) {
      payload.sources.scalingBench.error = 'File not found';
    } else {
      payload.sources.scalingBench.available = true;
      payload.points.push(...toPointsFromScalingBench(scalingRaw));
    }
  } catch (err) {
    payload.sources.scalingBench.error = _errToMessage(err);
  }

  // Chronological order (oldest first) — chart plots left → right by time
  payload.points.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return NextResponse.json(payload);
}
