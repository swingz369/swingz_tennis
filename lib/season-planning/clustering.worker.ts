/**
 * clustering.worker.ts
 *
 * Sprint 4 — P1 #4: WebWorker / worker_threads entry point for off-thread clustering.
 *
 * Receives a clustering request via `parentPort` (Node.js worker_threads API —
 * the server-side equivalent of a browser WebWorker), runs the
 * `SeasonClusteringEngine` in this dedicated thread, and posts the result back
 * to the main thread. The main thread (Next.js request handler) stays
 * responsive even for 2000+ Member runs.
 *
 * Usage (from main thread):
 *   ```ts
 *   import { runClusteringInWorker } from './clustering-worker-client';
 *   const result = await runClusteringInWorker(seasonId, clubId, config);
 *   ```
 *
 * Message protocol:
 *   IN:  { type: 'cluster', seasonId, clubId, config }
 *   OUT: { type: 'done', result: ClusteringResult } | { type: 'error', message }
 *
 * Why worker_threads (not browser WebWorker)?
 *   - The clustering engine depends on Drizzle/Postgres.js, which is Node-only.
 *   - Next.js server routes run in Node, so we use the Node equivalent.
 *   - The same shape (`self.onmessage` / `postMessage`) carries over to a
 *     browser WebWorker if we later add a client-side preview path.
 *
 * Performance notes (per docs/SCALING_ANALYSIS.md):
 *   - Main-thread UI stays responsive at 0ms perceived latency during clustering.
 *   - The clustering itself takes the same wall-clock time, but the request
 *     handler can return 202 Accepted + a job ID, then stream the result back
 *     via SSE or poll, without blocking other requests.
 *   - For very long runs (>10s), consider showing a progress bar driven by
 *     intermediate postMessage events.
 */

import { parentPort } from 'node:worker_threads';
import { isMainThread, parentPort as parentPortCheck } from 'node:worker_threads';

import { createLogger } from '@/lib/logger';

const log = createLogger('season-planning:clustering.worker');

// Re-import the engine from the same package. The worker has its own module
// instance (no shared state with the main thread) — that's the whole point.
if (!isMainThread && parentPortCheck) {
  runWorker();
} else {
  log.error(
    '[clustering.worker] This file must be loaded as a worker_threads worker, not the main thread.'
  );
  process.exit(1);
}

interface ClusterRequest {
  type: 'cluster';
  seasonId: string;
  clubId: string;
  config?: Record<string, unknown>;
  dryRun?: boolean;
}

async function runWorker(): Promise<void> {
  if (!parentPort) {
    log.error('[clustering.worker] No parentPort available — exiting.');
    return;
  }

  // Dynamic import to avoid loading the engine (with all its Drizzle deps) at module-init time
  // before the worker knows it should be running.
  const { SeasonClusteringEngine } = await import('./clustering-engine');

  parentPort.on('message', async (msg: ClusterRequest) => {
    if (msg.type !== 'cluster') {
      parentPort!.postMessage({
        type: 'error',
        message: `Unknown message type: ${(msg as { type: string }).type}`,
      });
      return;
    }

    const { seasonId, clubId, config = {}, dryRun = false } = msg;

    try {
      const engine = new SeasonClusteringEngine(seasonId, clubId, config as never);
      const result = await engine.runClustering(dryRun);
      parentPort!.postMessage({ type: 'done', result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      parentPort!.postMessage({ type: 'error', message, stack });
    }
  });
}
