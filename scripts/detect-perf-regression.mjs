#!/usr/bin/env node
/**
 * Detects performance regressions by comparing current vs previous benchmark results.
 *
 * Usage:
 *   node scripts/detect-perf-regression.mjs \
 *     --current tests/bench/.bench-results.json \
 *     --previous tests/bench/.previous/.bench-results.json \
 *     --threshold 0.20 \
 *     --output tests/bench/.regression-report.json
 *
 * Exit code: 0 = no regression, 1 = regression detected, 2 = missing files
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function parseArgs(argv) {
  const args = { current: null, previous: null, threshold: 0.20, output: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--current') { args.current = v; i++; }
    else if (k === '--previous') { args.previous = v; i++; }
    else if (k === '--threshold') { args.threshold = parseFloat(v); i++; }
    else if (k === '--output') { args.output = v; i++; }
  }
  return args;
}

function loadJson(path) {
  if (!path || !existsSync(resolve(path))) return null;
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch {
    return null;
  }
}

function compareRuns(current, previous, threshold) {
  const comparisons = [];
  let maxDeltaPct = 0;
  for (const [key, cur] of Object.entries(current.runs ?? {})) {
    const prev = previous.runs?.[key];
    if (!prev || typeof cur.meanMs !== 'number' || typeof prev.meanMs !== 'number') continue;
    const deltaMs = cur.meanMs - prev.meanMs;
    const deltaPct = (deltaMs / prev.meanMs) * 100;
    maxDeltaPct = Math.max(maxDeltaPct, deltaPct);
    comparisons.push({
      key,
      label: cur.label ?? key,
      previous_ms: prev.meanMs.toFixed(2),
      current_ms: cur.meanMs.toFixed(2),
      delta_ms: deltaMs.toFixed(2),
      delta_pct: parseFloat(deltaPct.toFixed(2)),
      regressed: deltaPct > threshold * 100,
    });
  }
  return { comparisons, maxDeltaPct, thresholdPct: threshold * 100 };
}

const args = parseArgs(process.argv);
if (!args.current || !args.output) {
  console.error('Usage: node detect-perf-regression.mjs --current <path> --output <path> [--previous <path>] [--threshold 0.20]');
  process.exit(2);
}

const current = loadJson(args.current);
if (!current) {
  console.error(`[regression] Cannot load current results from ${args.current}`);
  process.exit(2);
}

const previous = loadJson(args.previous);
if (!previous) {
  console.log(`[regression] No previous results found at ${args.previous ?? '(not set)'} — skipping regression check`);
  const report = {
    regressed: false,
    threshold: args.threshold,
    maxDeltaPct: 0,
    reason: 'no-previous-baseline',
    comparisons: [],
    checkedAt: new Date().toISOString(),
  };
  writeFileSync(resolve(args.output), JSON.stringify(report, null, 2));
  process.exit(0);
}

const result = compareRuns(current, previous, args.threshold);
const report = {
  regressed: result.maxDeltaPct > args.threshold * 100,
  threshold: args.threshold,
  thresholdPct: result.thresholdPct,
  maxDeltaPct: parseFloat(result.maxDeltaPct.toFixed(2)),
  comparisons: result.comparisons,
  checkedAt: new Date().toISOString(),
  currentTimestamp: current.generatedAt,
  previousTimestamp: previous.generatedAt,
};

writeFileSync(resolve(args.output), JSON.stringify(report, null, 2));
console.log(`[regression] ${report.regressed ? '⚠️  REGRESSION' : '✅ OK'} — max Δ = ${report.maxDeltaPct}% (threshold ${report.thresholdPct}%)`);
console.log(`[regression] Report written to ${args.output}`);
process.exit(report.regressed ? 1 : 0);
