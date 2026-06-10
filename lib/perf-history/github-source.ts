import { gunzipSync } from 'zlib';
import { Buffer } from 'buffer';
import type { PerfHistoryPoint } from '@/app/api/admin/perf-history/local/route';
import type { GithubPerfRun } from '@/app/api/admin/perf-history/github/route';

interface FetchOptions {
  workflowFile: string;
  perRun?: number;
  maxRuns?: number;
  artifactName?: string;
}

interface GithubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  artifacts_url: string;
}

interface GithubArtifact {
  id: number;
  name: string;
  archive_download_url: string;
  expired: boolean;
}

interface ScalingResultsJson {
  generatedAt?: string;
  runs?: Record<
    string,
    {
      label?: string;
      numMembers?: number;
      timestamp?: string;
      meanMs?: number;
      totalGroups?: number;
      unassignedCount?: number;
      wishPartnerRate?: number;
    }
  >;
  config?: { NUM_TRAINERS?: number; NUM_COURTS?: number };
}

const GITHUB_API = 'https://api.github.com';

/**
 * Fetch recent workflow runs + scaling-results artifacts from GitHub Actions.
 * Returns `[]` (without throwing) when env vars are not configured.
 */
export async function getGithubWorkflowPerfHistory(
  options: FetchOptions
): Promise<GithubPerfRun[]> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY ?? process.env.GITHUB_REPO;
  if (!token || !repo) {
    return [];
  }

  const perRun = options.perRun ?? 10;
  const maxRuns = options.maxRuns ?? 10;
  const artifactName = options.artifactName ?? 'scaling-results';

  const runs = await listWorkflowRuns(token, repo, options.workflowFile, maxRuns);
  if (runs.length === 0) return [];

  const out: GithubPerfRun[] = [];
  for (const run of runs) {
    try {
      const artifacts = await listArtifacts(token, repo, run.id);
      const scaling = artifacts.find((a) => a.name === artifactName && !a.expired);
      if (!scaling) continue;

      const json = await downloadAndExtractJson(token, repo, scaling);
      if (!json) continue;

      const points = normalizeScalingResults(run, json);
      if (points.length === 0) continue;

      out.push({
        runId: String(run.id),
        name: run.name,
        branch: run.head_branch,
        headSha: run.head_sha,
        status: run.status,
        conclusion: run.conclusion,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        htmlUrl: run.html_url,
        points,
      });

      if (out.length >= perRun) break;
    } catch {
      // Skip this run on per-run errors (404 on missing artifacts, etc.)
      continue;
    }
  }

  return out;
}

async function listWorkflowRuns(
  token: string,
  repo: string,
  workflowFile: string,
  limit: number
): Promise<GithubWorkflowRun[]> {
  const url = `${GITHUB_API}/repos/${repo}/actions/workflows/${encodeURIComponent(
    workflowFile
  )}/runs?per_page=${Math.min(Math.max(limit, 1), 100)}`;
  const res = await fetch(url, {
    headers: ghHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`GitHub listWorkflowRuns failed: HTTP ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { workflow_runs?: GithubWorkflowRun[] };
  return data.workflow_runs ?? [];
}

async function listArtifacts(
  token: string,
  repo: string,
  runId: number
): Promise<GithubArtifact[]> {
  const url = `${GITHUB_API}/repos/${repo}/actions/runs/${runId}/artifacts?per_page=50`;
  const res = await fetch(url, { headers: ghHeaders(token), cache: 'no-store' });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`GitHub listArtifacts failed: HTTP ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { artifacts?: GithubArtifact[] };
  return data.artifacts ?? [];
}

/**
 * Download a zip artifact and extract the first .json file inside it.
 * GitHub artifacts are zip files; we parse the central directory manually
 * to avoid pulling in a full zip lib.
 */
async function downloadAndExtractJson(
  token: string,
  repo: string,
  artifact: GithubArtifact
): Promise<ScalingResultsJson | null> {
  const url = artifact.archive_download_url;
  // archive_download_url is on github.com (not api.github.com); it expects
  // the same Authorization header and returns a 302 to the actual blob.
  const res = await fetch(url, {
    headers: ghHeaders(token),
    cache: 'no-store',
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`Artifact download failed: HTTP ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const jsonText = extractFirstJsonFromZip(buf);
  if (!jsonText) return null;
  return JSON.parse(jsonText) as ScalingResultsJson;
}

function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function normalizeScalingResults(
  run: GithubWorkflowRun,
  raw: ScalingResultsJson
): PerfHistoryPoint[] {
  const runs = raw.runs ?? {};
  const fallbackTimestamp = raw.generatedAt ?? run.created_at;
  const points: PerfHistoryPoint[] = [];
  for (const [runId, r] of Object.entries(runs)) {
    if (!r || typeof r !== 'object') continue;
    points.push({
      source: 'github',
      runId: `${run.id}-${runId}`,
      label: typeof r.label === 'string' ? r.label : runId,
      timestamp: typeof r.timestamp === 'string' ? r.timestamp : fallbackTimestamp,
      numMembers: typeof r.numMembers === 'number' ? r.numMembers : null,
      numTrainers: typeof raw.config?.NUM_TRAINERS === 'number' ? raw.config.NUM_TRAINERS : null,
      numCourts: typeof raw.config?.NUM_COURTS === 'number' ? raw.config.NUM_COURTS : null,
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
 * Minimal ZIP extractor: reads the End-of-Central-Directory record, walks
 * the central directory entries, and returns the first .json file's content
 * (handles stored or deflate-compressed entries).
 */
function extractFirstJsonFromZip(buf: Buffer): string | null {
  // Find EOCD signature (0x06054b50)
  const eocd = findSignature(buf, 0x06054b50, buf.length - 22, 22);
  if (eocd < 0) return null;
  const totalEntries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const fileNameLength = buf.readUInt16LE(p + 28);
    const extraFieldLength = buf.readUInt16LE(p + 30);
    const commentLength = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + fileNameLength).toString('utf-8');

    if (name.toLowerCase().endsWith('.json')) {
      // Read local file header
      const lh = localHeaderOffset;
      if (buf.readUInt32LE(lh) !== 0x04034b50) return null;
      const lhFileNameLength = buf.readUInt16LE(lh + 26);
      const lhExtraFieldLength = buf.readUInt16LE(lh + 28);
      const dataStart = lh + 30 + lhFileNameLength + lhExtraFieldLength;
      const compressed = buf.slice(dataStart, dataStart + compressedSize);
      try {
        // Method 0 = stored, 8 = deflate
        const method = buf.readUInt16LE(lh + 8);
        if (method === 0) return compressed.toString('utf-8');
        if (method === 8) {
          const inflated = gunzipSync(compressed);
          // Sanity: ensure we didn't over-inflate
          if (inflated.length > uncompressedSize + 64) return null;
          return inflated.toString('utf-8');
        }
      } catch {
        return null;
      }
    }

    p += 46 + fileNameLength + extraFieldLength + commentLength;
  }
  return null;
}

function findSignature(buf: Buffer, signature: number, start: number, maxBack: number): number {
  const from = Math.max(0, start - maxBack);
  for (let i = start; i >= from; i -= 1) {
    if (buf.readUInt32LE(i) === signature) return i;
  }
  return -1;
}
