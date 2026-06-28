#!/usr/bin/env node
/**
 * scripts/force-dynamic-bulk-migration.mjs
 *
 * Bulk-Migration Script für TICKET 2.4.5-Followup: fügt
 * `export const dynamic = 'force-dynamic';` konsistent nach dem letzten
 * Import-Block in jede route.ts ein, die noch keinen force-dynamic-Marker hat.
 *
 * Default-Spec (M1+M2 — Code-Reviewer Polish Q1+Q2):
 *   • Placement: direkt nach letzter Import-Deklaration
 *   • Whitespace: 1 Leerzeile danach (= Abgrenzung zum nächsten Modul-Top-Element)
 *   • Kommentar: KEIN (Style-Konsistenz mit 65+ bestehenden Routes)
 *   • Reihenfolge bei mehreren Segment-Configs: dynamic zuerst
 *
 * CLI:
 *   node scripts/force-dynamic-bulk-migration.mjs                                     # dry-run all
 *   node scripts/force-dynamic-bulk-migration.mjs --apply                            # mutate all
 *   node scripts/force-dynamic-bulk-migration.mjs --apply --cluster=admin,cron       # scoped cluster
 *   node scripts/force-dynamic-bulk-migration.mjs --apply --target=app/api/admin/X   # single file
 *
 * Exit-Codes:
 *   0 = alle Files in erwartetem Zustand (no-op oder SUCCESS)
 *   1 = SKIP mit manual-review-required (Force-Static gefunden)
 *   2 = unerwarteter Fehler (file-not-readable, parse-failure, etc.)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const SPRINT1_LIST = resolve(PROJECT_ROOT, 'scripts/sprint-1-routes.txt');
const LOG_DIR = resolve(PROJECT_ROOT, 'migration-log');

// ─── CLI-Parse ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const options = {
  apply: false,
  cluster: null,
  target: null,
};

for (const arg of args) {
  if (arg === '--apply') {
    options.apply = true;
  } else if (arg.startsWith('--cluster=')) {
    options.cluster = arg.slice('--cluster='.length).split(',');
  } else if (arg.startsWith('--target=')) {
    options.target = arg.slice('--target='.length);
  } else if (arg === '--help' || arg === '-h') {
    console.log(usage());
    process.exit(0);
  } else {
    console.error(`[ERROR] Unknown arg: ${arg}`);
    console.error(usage());
    process.exit(2);
  }
}

function usage() {
  return `
Usage: node scripts/force-dynamic-bulk-migration.mjs [--apply] [--cluster=admin,cron,webhooks] [--target=path/to/route.ts]

Default: dry-run all routes in scripts/sprint-1-routes.txt
 --apply            Apply mutations (default: dry-run)
 --cluster=...      Scope to clusters (comma-sep: admin,cron,webhooks)
 --target=...       Single-file mode (overrides cluster + list)
`.trim();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Findet die Insertion-Stelle: Index der Zeile, NACH der `export const dynamic`
 * eingefügt werden soll. Anchor-Detection: letzte Zeile eines Import-Blocks.
 * Für mehrzeilige Imports ('import {\\n a,\\n b\\n} from ...) wird die letzte
 * `} from '...'`-Zeile als Anchor erkannt.
 *
 * @param {string[]} lines
 * @returns {{ lineIndex: number; anchorType: 'post-import' | 'file-start' }}
 */
function findInsertionPoint(lines) {
  const importAnchorRegex = /^(import\s|export\s+type\s|}?\s*from\s|export\s*\{)/;
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (importAnchorRegex.test(trimmed) && (trimmed.startsWith('import') || trimmed.startsWith('}') || trimmed.startsWith('export'))) {
      return { lineIndex: i, anchorType: 'post-import' };
    }
  }
  // Fallback: keine Imports gefunden
  return { lineIndex: -1, anchorType: 'file-start' };
}

/**
 * Prüft Skip-Conditions (Code-Reviewer BLOCKER-2 Fix).
 * Granularität:
 *   • dynamic = 'force-dynamic' → already-configured (silent skip)
 *   • dynamic = 'auto' oder andere Werte → manual-review-required (skip mit warn-log)
 *   • force-static gefunden → manual-review-required (gefährliche Überschreibung)
 * @returns {{ skip: boolean; reason: string }}
 */
function checkSkipConditions(content) {
  const dynamicMatch = content.match(/export\s+const\s+dynamic\s*=\s*['"]([^'"]+)['"]/);
  if (dynamicMatch) {
    const value = dynamicMatch[1];
    if (value === 'force-dynamic') {
      return {
        skip: true,
        reason: `already-configured (existing value: 'force-dynamic')`,
      };
    }
    // 'auto' oder andere Werte: explizit gesetzt → manuelle Review
    return {
      skip: true,
      reason: `manual-review-required (existing dynamic='${value}' is non-default; manual decision needed before override)`,
    };
  }
  // force-static gefunden (gefährliche Überschreibung)
  if (/\bforce-static\b/.test(content)) {
    return {
      skip: true,
      reason: 'manual-review-required (force-static annotation detected)',
    };
  }
  return { skip: false, reason: '' };
}

/**
 * Wendet die Mutation auf die Zeilen an und gibt neuen Content + Indikator
 * zurück, ob dynamisch-change passiert ist.
 */
function applyInsertion(content) {
  const lines = content.split('\n');
  const { lineIndex, anchorType } = findInsertionPoint(lines);

  if (anchorType === 'file-start') {
    // No Imports: einfügen am Anfang. 1 Leerzeile danach.
    return {
      newContent: `export const dynamic = 'force-dynamic';\n\n${content}`,
      changed: true,
    };
  }

  // Insertion nach `lineIndex`. Collapse potentielle Leerzeilen davor auf 1.
  const before = lines.slice(0, lineIndex + 1);
  const after = lines.slice(lineIndex + 1);

  // Collapse trailing empties in `before` to max 0 (1 Leerzeile max)
  while (before.length > 0 && before[before.length - 1].trim() === '') {
    before.pop();
  }

  const newLines = [
    ...before,
    '',
    `export const dynamic = 'force-dynamic';`,
    '',
    ...after,
  ];

  // Collapse 3+ consecutive empties to max 2 (= 1 Leerzeile Sicht)
  const collapsed = [];
  let emptyRun = 0;
  for (const l of newLines) {
    if (l === '') {
      emptyRun++;
      if (emptyRun <= 1) collapsed.push(l);
    } else {
      emptyRun = 0;
      collapsed.push(l);
    }
  }

  return { newContent: collapsed.join('\n'), changed: true };
}

// ─── Main-Loop ──────────────────────────────────────────────────────────────

async function loadRoutes() {
  if (options.target) {
    return { routes: [options.target], source: 'cli-target-override' };
  }

  if (!existsSync(SPRINT1_LIST)) {
    console.error(`[ERROR] Sprint-1 routes-list not found: ${SPRINT1_LIST}`);
    process.exit(2);
  }

  const raw = await readFile(SPRINT1_LIST, 'utf-8');
  const allRoutes = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (options.cluster) {
    const clusterFilter = (route) => {
      return options.cluster.some((c) => route.startsWith(`app/api/${c}/`));
    };
    return {
      routes: allRoutes.filter(clusterFilter),
      source: `sprint-1-list (cluster=${options.cluster.join(',')})`,
    };
  }

  return { routes: allRoutes, source: 'sprint-1-list (all)' };
}

async function processFile(relPath) {
  const absPath = resolve(PROJECT_ROOT, relPath);

  if (!existsSync(absPath)) {
    return { status: 'SKIPPED', reason: 'file-not-found' };
  }

  let content;
  try {
    content = await readFile(absPath, 'utf-8');
  } catch (err) {
    return {
      status: 'SKIPPED',
      reason: `read-error: ${err.message}`,
    };
  }

  const { skip, reason } = checkSkipConditions(content);
  if (skip) {
    return { status: 'SKIPPED', reason };
  }

  const beforeSha = sha256(content);
  const { newContent, changed } = applyInsertion(content);

  if (!changed) {
    return { status: 'NO-OP', reason: 'no-change-detected' };
  }

  if (options.apply) {
    try {
      await writeFile(absPath, newContent, 'utf-8');
    } catch (err) {
      return {
        status: 'ERROR',
        reason: `write-error: ${err.message}`,
      };
    }
  } else {
    // Dry-run: kein Write, kein Prettier-Schritt
    return { status: 'PREVIEW', reason: 'dry-run-no-mutation' };
  }

  const afterSha = sha256(newContent);

  return {
    status: 'SUCCESS',
    reason: 'inserted-after-last-import',
    beforeSha,
    afterSha,
  };
}

async function main() {
  const mode = options.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`[${mode}] Starting force-dynamic bulk migration...\n`);

  const { routes, source } = await loadRoutes();
  console.log(`Loaded ${routes.length} routes from ${source}\n`);

  const today = new Date().toISOString().split('T')[0];
  const logFileName = `${today}-sprint-1-force-dynamic.log`;

  await mkdir(LOG_DIR, { recursive: true });
  const logFile = resolve(LOG_DIR, logFileName);

  // In dry-run mode, write nothing
  const logEntries = [];
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const route of routes) {
    const result = await processFile(route);
    const entry = {
      timestamp: new Date().toISOString(),
      file: route,
      status: result.status,
      reason: result.reason,
      beforeSha: result.beforeSha,
      afterSha: result.afterSha,
    };
    logEntries.push(entry);

    if (result.status === 'SUCCESS') successCount++;
    else if (result.status === 'SKIPPED') skipCount++;
    else if (result.status === 'ERROR') errorCount++;

    // Console output
    const icon = result.status === 'SUCCESS' ? '✅' : result.status === 'SKIPPED' ? '⏭️ ' : '❌';
    const shaInfo = result.beforeSha ? ` | ${result.beforeSha.slice(0, 8)} → ${result.afterSha?.slice(0, 8) ?? '___'}` : '';
    console.log(`${icon} ${route} [${result.status}] ${result.reason}${shaInfo}`);
  }

  // Audit-Log persistieren (auch im dry-run, für Trail)
  const logContent = logEntries
    .map(
      (e) =>
        `[${e.timestamp}] ${e.file} | Status: ${e.status} | Reason: ${e.reason}${e.beforeSha ? ` | Before-SHA256: ${e.beforeSha}` : ''}${e.afterSha ? ` | After-SHA256: ${e.afterSha}` : ''}`
    )
    .join('\n') + '\n';

  if (options.apply) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(logFile, `[${mode} ${new Date().toISOString()}]\n${logContent}`, 'utf-8');
    console.log(`\n[${mode}] Audit-Log appended to: ${logFile}`);
  } else {
    console.log(`\n[${mode}] Audit-Log preview (would be written):`);
    console.log(logContent.split('\n').slice(0, 10).join('\n') + '\n...');
  }

  console.log(`\n[${mode}] Summary: SUCCESS=${successCount} | SKIPPED=${skipCount} | ERROR=${errorCount}`);

  if (errorCount > 0) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(`[FATAL] ${err.message}`);
  console.error(err.stack);
  process.exit(2);
});
