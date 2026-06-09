#!/usr/bin/env npx tsx
/**
 * verify-gitignore.ts
 *
 * Prüft, ob alle gängigen Build-Artefakt-Pfade in .gitignore eingetragen sind,
 * führt `npm run clean` aus, und listet danach alle ignorierten Pfade via
 * `git status --ignored` auf.
 *
 * Erwartete Pflicht-Patterns (per Stand 2026-06):
 *   - node_modules/   (Dependencies)
 *   - .next/          (Next.js Build-Cache)
 *   - dist/           (TypeScript Build-Output)
 *   - build/          (Allgemeiner Build-Output)
 *   - coverage/       (Test Coverage Reports)
 *   - .turbo/         (Turborepo Cache)
 *   - .vercel/        (Vercel Deploy-Cache)
 *   - out/            (Next.js Static Export)
 *   - .swc/           (SWC Compiler Cache)
 *   - .eslintcache    (ESLint Cache)
 *   - *.tsbuildinfo   (TypeScript Incremental Build Info)
 *   - .mdx/           (MDX Compilation Cache)
 *
 * Usage:
 *   npx tsx scripts/verify-gitignore.ts
 *   npx tsx scripts/verify-gitignore.ts --json
 *   npx tsx scripts/verify-gitignore.ts --webhook https://hooks.slack.com/...
 *   npx tsx scripts/verify-gitignore.ts --json --webhook $SLACK_WEBHOOK_URL
 *   # oder:
 *   npm run verify:gitignore -- --json
 *
 * Exit codes:
 *   0 = alle Patterns vorhanden
 *   1 = fehlende Patterns ODER clean fehlgeschlagen
 *   2 = ungültige Argumente
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_PATTERNS = [
  'node_modules/',
  '.next/',
  'dist/',
  'build/',
  'coverage/',
  '.turbo/',
  '.vercel/',
  'out/',
  // Compiler / Linter / Bundler caches
  '.swc/',
  '.eslintcache',
  '*.tsbuildinfo',
  '.mdx/',
  // Tool caches + temp dirs (clean:all paths)
  'node_modules/.cache',
  '.cache',
  '.tmp',
  // OS temp files
  '.DS_Store',
  'Thumbs.db',
  '*~',
];

// ═══ CLI arg parsing ═══════════════════════════════════════════════════
interface CliOptions {
  json: boolean;
  webhook: string | null;
  skipClean: boolean;
  skipIgnored: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    json: false,
    webhook: process.env.GITIGNORE_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || null,
    skipClean: false,
    skipIgnored: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json' || a === '-j') opts.json = true;
    else if (a === '--webhook' || a === '-w') opts.webhook = argv[++i] || null;
    else if (a === '--no-clean') opts.skipClean = true;
    else if (a === '--no-ignored') opts.skipIgnored = true;
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: verify-gitignore.ts [--json] [--webhook URL] [--no-clean] [--no-ignored]'
      );
      process.exit(0);
    }
  }
  return opts;
}

const CWD = process.cwd();
const GITIGNORE_PATH = resolve(CWD, '.gitignore');

interface CheckResult {
  pattern: string;
  present: boolean;
  lineNumbers: number[];
}

interface Report {
  ok: boolean;
  timestamp: string;
  gitignorePath: string;
  requiredPatterns: number;
  presentCount: number;
  missingCount: number;
  results: CheckResult[];
  missing: string[];
  cleanRun: { attempted: boolean; ok: boolean; output?: string; skipped?: boolean };
  ignoredPaths: { count: number; byGroup: Record<string, string[]>; skipped: boolean };
  webhook: { attempted: boolean; sent: boolean; url?: string; error?: string };
}

function checkPatterns(gitignoreContent: string): CheckResult[] {
  return REQUIRED_PATTERNS.map((pattern) => {
    const lines = gitignoreContent.split('\n');
    const lineNumbers: number[] = [];
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed === '') return;
      if (
        trimmed === pattern ||
        trimmed === pattern.replace(/\/$/, '') ||
        trimmed === `**/${pattern}` ||
        trimmed === `**/${pattern.replace(/\/$/, '')}`
      ) {
        lineNumbers.push(idx + 1);
      }
    });
    return { pattern, present: lineNumbers.length > 0, lineNumbers };
  });
}

function runGitIgnored(): string | null {
  try {
    return execSync('git status --ignored --porcelain', {
      cwd: CWD,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err: any) {
    if (err.message?.includes('not a git repository')) return null;
    throw err;
  }
}

function runClean(): { ok: boolean; output: string } {
  try {
    const out = execSync('npm run clean', {
      cwd: CWD,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: out };
  } catch (err: any) {
    return { ok: false, output: err.message ?? String(err) };
  }
}

function parseIgnoredPaths(porcelainOut: string | null): string[] {
  if (!porcelainOut || porcelainOut.trim() === '') return [];
  return porcelainOut
    .split('\n')
    .filter((line) => line.trim().startsWith('!!'))
    .map((line) => line.replace(/^!!\s*/, '').trim())
    .filter((line) => line.length > 0);
}

function groupPathsByTopLevel(paths: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const p of paths) {
    const top = p.split('/')[0] || p;
    if (!grouped[top]) grouped[top] = [];
    grouped[top].push(p);
  }
  return grouped;
}

async function postWebhook(
  url: string,
  report: Report
): Promise<{ sent: boolean; error?: string }> {
  // Format message for both Slack and Discord (both accept JSON with `text` or `content`)
  const isSlack = url.includes('hooks.slack.com');
  const isDiscord = url.includes('discord.com/api/webhooks');
  const missingList = report.missing.map((m) => `• \`${m}\``).join('\n') || '_(none)_';
  const text =
    `🔍 *Gitignore-Verifizierung fehlgeschlagen*\n` +
    `Repository: \`${CWD.split('/').pop()}\`\n` +
    `Timestamp: ${report.timestamp}\n\n` +
    `*${report.missingCount} Pattern(s) fehlen:*\n${missingList}\n\n` +
    `Vorhanden: ${report.presentCount}/${report.requiredPatterns}\n` +
    `Details: ${report.gitignorePath}`;

  const payload = isSlack
    ? { text }
    : isDiscord
      ? { content: text.replace(/\*/g, '**') }
      : { text, content: text }; // generic fallback

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return {
        sent: false,
        error: `HTTP ${res.status}: ${await res.text().catch(() => '<no body>')}`,
      };
    }
    return { sent: true };
  } catch (err: any) {
    return { sent: false, error: err.message ?? String(err) };
  }
}

function formatHumanReport(report: Report, results: CheckResult[]): string {
  const lines: string[] = [];
  lines.push('┌──────────────────────┬────────┬─────────────────┐');
  lines.push('│ Pattern              │ Status │ .gitignore-Zeile│');
  lines.push('├──────────────────────┼────────┼─────────────────┤');
  for (const r of results) {
    const padded = r.pattern.padEnd(20);
    const status = r.present ? '   ✅   ' : '   ❌   ';
    const lineNums = r.lineNumbers.length > 0 ? r.lineNumbers.join(', ') : '— fehlt —';
    lines.push(`│ ${padded} │${status}│ ${lineNums.padEnd(15)} │`);
  }
  lines.push('└──────────────────────┴────────┴─────────────────┘');
  return lines.join('\n');
}

function formatIgnoredPathsHuman(paths: string[]): string {
  if (paths.length === 0) return '_Keine ignorierten Pfade gefunden._';
  const grouped = groupPathsByTopLevel(paths);
  const lines: string[] = [];
  for (const [top, items] of Object.entries(grouped).sort()) {
    lines.push(`**${top}/** (${items.length})`);
    const shown = items.slice(0, 10);
    for (const item of shown) lines.push(`  - ${item}`);
    if (items.length > 10) lines.push(`  - _... und ${items.length - 10} weitere_`);
  }
  return lines.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // ═══ Schritt 1: .gitignore lesen und Pflicht-Patterns prüfen ═══════
  if (!existsSync(GITIGNORE_PATH)) {
    if (opts.json) {
      console.log(
        JSON.stringify({ ok: false, error: '.gitignore not found', path: GITIGNORE_PATH }, null, 2)
      );
    } else {
      console.error(`❌ .gitignore nicht gefunden: ${GITIGNORE_PATH}`);
    }
    process.exit(1);
  }

  const gitignoreContent = readFileSync(GITIGNORE_PATH, 'utf-8');
  const results = checkPatterns(gitignoreContent);
  const missing = results.filter((r) => !r.present).map((r) => r.pattern);

  // ═══ Schritt 2: npm run clean ═════════════════════════════════════
  let cleanResult: { attempted: boolean; ok: boolean; output?: string; skipped?: boolean };
  if (opts.skipClean) {
    cleanResult = { attempted: false, ok: true, skipped: true };
  } else {
    const clean = runClean();
    cleanResult = { attempted: true, ok: clean.ok, output: clean.output };
  }

  // ═══ Schritt 3: git status --ignored ═══════════════════════════════
  const porcelain = runGitIgnored();
  let ignoredPaths: string[] = [];
  let ignoredSkipped = false;
  if (opts.skipIgnored) {
    ignoredSkipped = true;
  } else if (porcelain === null) {
    ignoredSkipped = true;
  } else {
    ignoredPaths = parseIgnoredPaths(porcelain);
  }

  // ═══ Build report object ══════════════════════════════════════════
  const ok = missing.length === 0 && cleanResult.ok;
  const report: Report = {
    ok,
    timestamp: new Date().toISOString(),
    gitignorePath: GITIGNORE_PATH,
    requiredPatterns: REQUIRED_PATTERNS.length,
    presentCount: results.filter((r) => r.present).length,
    missingCount: missing.length,
    results,
    missing,
    cleanRun: cleanResult,
    ignoredPaths: {
      count: ignoredPaths.length,
      byGroup: groupPathsByTopLevel(ignoredPaths),
      skipped: ignoredSkipped,
    },
    webhook: { attempted: false, sent: false },
  };

  // ═══ Schritt 4: Webhook (nur bei Fehler, falls konfiguriert) ══════
  if (!ok && opts.webhook) {
    report.webhook.attempted = true;
    report.webhook.url = opts.webhook.replace(/\/[^/]+$/, '/****'); // mask webhook ID
    const wh = await postWebhook(opts.webhook, report);
    report.webhook.sent = wh.sent;
    if (wh.error) report.webhook.error = wh.error;
  }

  // ═══ Output ════════════════════════════════════════════════════════
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('🔍 Gitignore-Verifizierung startet...\n');
    console.log('📋 Schritt 1: .gitignore-Patterns prüfen\n');
    console.log(formatHumanReport(report, results));
    if (missing.length > 0) {
      console.error(`\n❌ ${missing.length} Pattern(s) fehlen in .gitignore:`);
      for (const m of missing) console.error(`   - ${m}`);
    }
    if (!cleanResult.ok) {
      console.error(`\n❌ npm run clean fehlgeschlagen: ${cleanResult.output}`);
    }
    if (!opts.skipClean) {
      console.log('\n🧹 Schritt 2: npm run clean...');
      console.log(cleanResult.ok ? '   ✅ Build-Artefakte entfernt' : '   ❌ fehlgeschlagen');
    }
    console.log('\n📋 Schritt 3: git status --ignored...');
    if (ignoredSkipped) {
      console.log('   ⚠️  Übersprungen (kein Git-Repo oder --no-ignored)');
    } else {
      console.log(`\n   ${ignoredPaths.length} ignorierte Pfade gefunden:\n`);
      console.log(formatIgnoredPathsHuman(ignoredPaths));
    }
    if (report.webhook.attempted) {
      console.log(
        `\n📡 Webhook: ${report.webhook.sent ? '✅ gesendet' : '❌ fehlgeschlagen'}${report.webhook.error ? ' — ' + report.webhook.error : ''}`
      );
    }
    console.log('\n' + '='.repeat(60));
    if (ok) {
      console.log('✅ Gitignore-Verifizierung erfolgreich abgeschlossen');
      console.log(`Alle ${REQUIRED_PATTERNS.length} Pflicht-Patterns vorhanden.`);
    } else {
      console.log('❌ Gitignore-Verifizierung FEHLGESCHLAGEN');
    }
    console.log('='.repeat(60));
  }

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(2);
});
