#!/usr/bin/env node
/**
 * Extracts benchmark results from vitest bench log output.
 *
 * vitest bench --run does not always trigger afterAll hooks that write JSON.
 * This script parses the [BENCH]/[SCALING] log lines and reconstructs a JSON
 * file in the format expected by generate-perf-report.ts.
 *
 * Usage:
 *   node scripts/extract-bench-from-log.mjs <log-file> <output-json>
 *
 * Output JSON shape:
 *   {
 *     generatedAt, nodeVersion, platform, config, runs: Record<label, {label, meanMs, ...}>
 *   }
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const [, , logFile, outFile] = process.argv;
if (!logFile || !outFile) {
  console.error('Usage: node extract-bench-from-log.mjs <log-file> <output-json>');
  process.exit(1);
}

const log = readFileSync(resolve(logFile), 'utf8');
const runs = {};

// Pattern A: [BENCH] label: 4.0 ms | groups=17 unassigned=2 wish%=0.0
// Pattern B: [SCALING] label: 4.0 ms | members=200 groups=17 unassigned=2
const benchRegex = /\[(BENCH|SCALING)\]\s+([^:]+):\s+([\d.]+)\s+ms\s+\|\s+([^|]+)/g;
let match;
while ((match = benchRegex.exec(log)) !== null) {
  const [, kind, rawLabel, meanMs, details] = match;
  const label = rawLabel.trim();
  const numMembersMatch = details.match(/members=(\d+)/);
  const numMembers = numMembersMatch ? parseInt(numMembersMatch[1], 10) : 0;
  const groupsMatch = details.match(/groups=(\d+)/);
  const totalGroups = groupsMatch ? parseInt(groupsMatch[1], 10) : 0;
  const unassignedMatch = details.match(/unassigned=(\d+)/);
  const unassignedCount = unassignedMatch ? parseInt(unassignedMatch[1], 10) : 0;

  const safeLabel = label.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+|-+$/g, '').toLowerCase();
  runs[safeLabel] = {
    label,
    kind: kind.toLowerCase(),
    numMembers,
    meanMs: parseFloat(meanMs),
    totalGroups,
    unassignedCount,
  };
}

const out = {
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  platform: `${process.platform}/${process.arch}`,
  config: { source: 'log-extraction', sourceFile: logFile },
  runs,
};

writeFileSync(resolve(outFile), JSON.stringify(out, null, 2));
console.log(`[extract-bench] Wrote ${Object.keys(runs).length} runs to ${outFile}`);
