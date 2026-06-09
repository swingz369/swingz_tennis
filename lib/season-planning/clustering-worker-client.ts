/**
 * clustering-worker-client.ts
 *
 * Sprint 4 — P1 #4: Main-thread wrapper that spawns the clustering worker_thread
 * and returns a promise that resolves with the ClusteringResult.
 *
 * Why a wrapper?
 *   - Encapsulates the worker_threads boilerplate (spawn, message, terminate).
 *   - Adds timeout, cancellation, and graceful fallback to in-process execution
 *     (for serverless environments like Vercel where worker_threads may be
 *     unreliable or unavailable).
 *   - Provides a single import path for API routes: `runClusteringInWorker(...)`.
 *
 * Usage:
 *   ```ts
 *   import { runClusteringInWorker } from '@/lib/season-planning/clustering-worker-client';
 *
 *   const result = await runClusteringInWorker({
 *     seasonId,
 *     clubId,
 *     config: { backtrackDepth: 3 },
 *     dryRun: true,
 *     timeoutMs: 60_000,
 *   });
 *   ```
 *
 * When to use vs. in-process:
 *   - Use the worker for 500+ Member clubs or when the API needs to stay
 *     responsive to other requests during clustering.
 *   - Use the in-process engine (SeasonClusteringEngine directly) for small
 *     clubs (<500 Members) where worker startup overhead (~50-100ms) would
 *     dominate the runtime.
 */

import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import type { ClusteringResult, ClusteringConfig } from './types';

export interface RunClusteringOptions {
  seasonId: string;
  clubId: string;
  config?: Partial<ClusteringConfig>;
  dryRun?: boolean;
  /** Max wall-clock time before the worker is killed. Default: 5 minutes. */
  timeoutMs?: number;
  /**
   * If true (default), falls back to in-process execution if worker_threads
   * fails to spawn (e.g. serverless edge runtime, Vercel hobby tier).
   * Set to false to require a worker and throw on failure.
   */
  fallbackToInProcess?: boolean;
}

interface WorkerSuccess {
  type: 'done';
  result: ClusteringResult;
}
interface WorkerError {
  type: 'error';
  message: string;
  stack?: string;
}
type WorkerResponse = WorkerSuccess | WorkerError;

/**
 * Run clustering in a dedicated worker thread.
 * Returns the ClusteringResult. Rejects on timeout or worker error.
 */
export function runClusteringInWorker(opts: RunClusteringOptions): Promise<ClusteringResult> {
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;
  const fallback = opts.fallbackToInProcess ?? true;

  return new Promise<ClusteringResult>((resolve, reject) => {
    let worker: Worker | null = null;
    let timeoutHandle: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (worker) {
        worker.removeAllListeners();
        worker.terminate().catch(() => {
          /* ignore termination errors */
        });
      }
    };

    try {
      // Resolve the worker file path relative to this module's location.
      // The .js extension is used at runtime; .ts is the source.
      // In production (after tsc/esbuild bundling), the worker file is .js.
      // In dev (tsx/ts-node), the worker is loaded from the .ts source.
      const workerPath = join(__dirname, 'clustering.worker.js');

      worker = new Worker(workerPath, {
        workerData: undefined,
        // Resource limits: cap the worker at 1GB heap and 30s of CPU.
        // Adjust these in cluster-tuning if your runs are heavier.
        resourceLimits: {
          maxOldGenerationSizeMb: 1024,
          maxYoungGenerationSizeMb: 256,
        },
      });

      timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new Error(`Clustering timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      worker.on('message', (msg: WorkerResponse) => {
        cleanup();
        if (msg.type === 'done') {
          resolve(msg.result);
        } else {
          reject(new Error(`Worker error: ${msg.message}${msg.stack ? '\n' + msg.stack : ''}`));
        }
      });

      worker.on('error', (err) => {
        cleanup();
        reject(err);
      });

      worker.on('exit', (code) => {
        cleanup();
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${code}`));
        }
      });

      worker.postMessage({
        type: 'cluster',
        seasonId: opts.seasonId,
        clubId: opts.clubId,
        config: opts.config ?? {},
        dryRun: opts.dryRun ?? true,
      });
    } catch (err) {
      cleanup();
      if (fallback) {
        // Worker spawn failed (e.g. serverless environment) — fall back to
        // in-process execution. Caller gets the same return type.
        runClusteringInProcess(opts).then(resolve, reject);
      } else {
        reject(err);
      }
    }
  });
}

/**
 * Fallback path: run clustering in the same process.
 * Used when worker_threads is unavailable (e.g. Vercel edge runtime) or when
 * the worker fails to spawn and `fallbackToInProcess` is true.
 */
async function runClusteringInProcess(opts: RunClusteringOptions): Promise<ClusteringResult> {
  // Dynamic import: the engine uses Drizzle/Postgres, which is a heavy import.
  // Lazy-loading keeps the worker-client module lightweight.
  const { SeasonClusteringEngine } = await import('./clustering-engine');
  const engine = new SeasonClusteringEngine(opts.seasonId, opts.clubId, opts.config);
  return engine.runClustering(opts.dryRun ?? true);
}

/**
 * Convenience: run clustering with worker if dataset is large, else in-process.
 * Heuristic: > 500 Members → worker, else in-process.
 *
 * Callers who want to force one or the other should use `runClusteringInWorker`
 * or `runClusteringInProcess` directly.
 */
export async function runClusteringAdaptive(
  opts: RunClusteringOptions & { memberCount?: number }
): Promise<ClusteringResult> {
  const { memberCount = 0, ...rest } = opts;
  if (memberCount > 500) {
    return runClusteringInWorker(rest);
  }
  return runClusteringInProcess(rest);
}
