import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminClub } from '@/lib/admin-context';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { getGithubWorkflowPerfHistory } from '@/lib/perf-history/github-source';
import type { PerfHistoryPoint } from './local/route';

export const dynamic = 'force-dynamic';

export interface GithubPerfRun {
  runId: string;
  name: string;
  branch: string;
  headSha: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  points: PerfHistoryPoint[];
}

export interface GithubPerfPayload {
  generatedAt: string;
  source: 'github';
  runs: GithubPerfRun[];
  error?: string;
}

/**
 * GET /api/admin/perf-history/github
 *
 * Fetches recent `perf-bench.yml` runs from GitHub Actions, downloads the
 * `scaling-results` artifact, and returns each run as a list of
 * `PerfHistoryPoint` rows.
 *
 * Admin-only (requireAdminClub guard). Rate-limited. If no
 * `GITHUB_TOKEN` / `GITHUB_REPOSITORY` env is configured, returns 200 with
 * an empty `runs` array and a descriptive `error` field — the page UI then
 * shows a friendly "no data" state.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminClub();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rateLimitResponse = await checkRateLimitOrFail(req, 'admin-perf-history-github');
  if (rateLimitResponse) return rateLimitResponse;

  const payload: GithubPerfPayload = {
    generatedAt: new Date().toISOString(),
    source: 'github',
    runs: [],
  };

  try {
    const runs = await getGithubWorkflowPerfHistory({
      workflowFile: 'perf-bench.yml',
      perRun: 10,
    });
    payload.runs = runs;
  } catch (err) {
    payload.error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(payload);
}
