#!/usr/bin/env tsx
/**
 * scripts/docs-autogen.ts — Handbuch-Auto-Generator
 *
 * Regeneriert zwei Kapitel des Handbuchs aus Code-Quellen:
 *   1. docs/handbook/dev/data-model.md     ← src/infrastructure/persistence/schema.ts
 *   2. docs/handbook/dev/api-reference.md  ← app/api/.../route.ts (alle Routen)
 *
 * Marker-gestützte Bereiche (`<!-- AUTOGEN:BEGIN…` / `<!-- AUTOGEN:END -->`)
 * werden überschrieben; manuelle Bereiche bleiben unangetastet.
 *
 * Aufruf:
 *   pnpm tsx scripts/docs-autogen.ts
 *   oder:
 *   npm run docs:autogen
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ────────────────────────────────────────────────────────────────
// Pfade
// ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const DATA_MODEL_TARGET = join(ROOT, 'docs/handbook/dev/data-model.md');
const API_REF_TARGET = join(ROOT, 'docs/handbook/dev/api-reference.md');

const SCHEMA_DIRS = [join(ROOT, 'src/infrastructure/persistence/schema')];
const API_DIR = join(ROOT, 'app/api');

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function walk(dir: string): string[] {
  if (!exists(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function exists(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

function readFile(p: string): string {
  return readFileSync(p, 'utf-8');
}

/**
 * Ersetzt Inhalt zwischen `<!-- AUTOGEN:BEGIN ... -->` und `<!-- AUTOGEN:END -->`.
 * Gibt finalen Markdown-String zurück.
 */
function replaceAutoGenSection(markdown: string, marker: string, newContent: string): string {
  const begin = `<!-- AUTOGEN:BEGIN ${marker} `;
  const end = `<!-- AUTOGEN:END -->`;
  const beginIdx = markdown.indexOf(begin);
  if (beginIdx === -1) {
    throw new Error(
      `Marker "${begin}" nicht gefunden in Markdown. ` + `Bitte vorher manuell setzen.`
    );
  }
  // Finde das Ende von AUTOGEN:BEGIN marker xxx -->
  const beginLineEnd = markdown.indexOf('-->', beginIdx) + 3;
  const endIdx = markdown.indexOf(end, beginLineEnd);
  if (endIdx === -1) {
    throw new Error(`Marker "${end}" nicht gefunden nach "${begin}".`);
  }
  const before = markdown.slice(0, beginLineEnd);
  const after = markdown.slice(endIdx);
  return before + '\n' + newContent + '\n' + after;
}

/**
 * Berechnet den neuen Markdown-Inhalt, OHNE zu schreiben. Wird sowohl für
 * --check (Dry-Run, Diff-Ausgabe) als auch für den echten Schreibpfad genutzt.
 */
function renderNewDataModel(): string {
  const schemaFiles = SCHEMA_DIRS.flatMap((d) => walk(d)).filter((f) => f.endsWith('.ts'));
  if (schemaFiles.length === 0) {
    console.warn(`  WARN  Keine Schema-Dateien in ${SCHEMA_DIRS.join(', ')}`);
  }
  const tables = extractTables(schemaFiles);
  console.log(
    `  ${tables.length} Tabellen extrahiert ueber ${new Set(tables.map((t) => t.domain)).size} Module`
  );
  const old = readFile(DATA_MODEL_TARGET);
  return replaceAutoGenSection(old, 'data-model', renderDataModel(tables));
}

function renderNewApiReference(): string {
  const routes = extractRoutes(API_DIR);
  console.log(`  ${routes.length} Routes extrahiert`);
  const old = readFile(API_REF_TARGET);
  return replaceAutoGenSection(old, 'api-routes', renderApiReference(routes));
}

/**
 * Liefert true, wenn der generierte Inhalt dem aktuellen Markdown-File entspricht.
 * Wird fuer --check genutzt (CI-Gate: keine Drift).
 */
function wouldDiffer(rendered: string, currentPath: string): boolean {
  const current = readFile(currentPath);
  return rendered.trim() !== current.trim();
}

// ────────────────────────────────────────────────────────────────
// Data Model Extraction
// ────────────────────────────────────────────────────────────────

/** Extrahiert `export const <name> = pgTable(...)` aus Schema-Dateien. */
function extractTables(schemaFiles: string[]): Array<{
  name: string;
  domain: string;
  columns: Array<{ name: string; type: string; pk: boolean; fk?: string }>;
}> {
  const tables: Array<{
    name: string;
    domain: string;
    columns: Array<{ name: string; type: string; pk: boolean; fk?: string }>;
  }> = [];

  for (const file of schemaFiles) {
    const src = readFile(file);
    const domain = relative(ROOT, file)
      .replace(/^src\/infrastructure\/persistence\/schema\//, '')
      .replace(/\.ts$/, '');

    // Suche pgTable-Definitionen
    const re = /export const \w+ = pgTable\(\s*['"](\w+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const tableName = m[1];

      // Extrahiere Spalten grob (regex-basiert, für bessere Qualität TS-Compiler nötig)
      const bodyStart = src.indexOf('{', m.index);
      const bodyEnd = src.indexOf('}', bodyStart);
      const body = src.slice(bodyStart, bodyEnd + 1);

      const columns: Array<{ name: string; type: string; pk: boolean; fk?: string }> = [];
      const colRe = /(\w+):\s*(\w+)\(['"](\w+)['"]\)([^,)]*)/g;
      let cm: RegExpExecArray | null;
      while ((cm = colRe.exec(body)) !== null) {
        const colName = cm[3];
        const colFn = cm[2]; // uuid, varchar, timestamp, integer, etc.
        const options = cm[4] || '';
        const isPk = options.includes('.primaryKey()');
        const fkMatch = options.match(/\.references\(\(\) => (\w+)/);
        columns.push({
          name: colName,
          type: colFn,
          pk: isPk,
          fk: fkMatch ? fkMatch[1] : undefined,
        });
      }

      tables.push({ name: tableName, domain, columns });
    }
  }
  return tables.sort((a, b) => a.name.localeCompare(b.name));
}

function renderDataModel(tables: ReturnType<typeof extractTables>): string {
  const grouped = new Map<string, typeof tables>();
  for (const t of tables) {
    const list = grouped.get(t.domain) ?? [];
    list.push(t);
    grouped.set(t.domain, list);
  }

  // Header-Zähler
  const header =
    `## Gelistete Tabellen (${tables.length} Tabellen, ${grouped.size} Schema-Module)\n\n` +
    `> Generiert: ${new Date().toISOString().split('T')[0]}. Manuell editieren verboten — Bereich wird bei jedem \`npm run docs:autogen\` ersetzt.\n\n`;

  const sections: string[] = [];
  for (const [domain, list] of grouped.entries()) {
    sections.push(`### Schema-Modul: ${domain}\n`);
    for (const t of list) {
      sections.push(`#### \`${t.name}\`  (${t.columns.length} Spalten)\n`);
      sections.push(`| Spalte | Typ | PK | FK |`);
      sections.push(`|---|---|:---:|---|`);
      for (const c of t.columns) {
        sections.push(`| \`${c.name}\` | ${c.type} | ${c.pk ? '✅' : ''} | ${c.fk ?? ''} |`);
      }
      sections.push(``);
    }
  }

  return header + sections.join('\n');
}

// ────────────────────────────────────────────────────────────────
// API Reference Extraction
// ────────────────────────────────────────────────────────────────

interface RouteInfo {
  file: string;
  path: string;
  methods: string[];
}

function extractRoutes(apiDir: string): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const routeFiles = walk(apiDir).filter((f) => f.endsWith('route.ts'));

  for (const file of routeFiles) {
    // Berechne URL-Pfad: app/api/foo/bar/route.ts → /api/foo/bar/[bar] wenn bar Ordner
    const relFromApi = relative(apiDir, file); // foo/bar/route.ts oder foo/[id]/route.ts
    const urlPath = '/api/' + relFromApi.replace(/\/route\.ts$/, '').replace(/\[(\w+)\]/g, ':$1');

    // Suche HTTP-Method-Exports
    const src = readFile(file);
    const methods: string[] = [];
    for (const m of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']) {
      const re = new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b`);
      if (re.test(src)) methods.push(m);
    }

    routes.push({ file, path: urlPath, methods });
  }

  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

function renderApiReference(routes: RouteInfo[]): string {
  const grouped = new Map<string, RouteInfo[]>();
  for (const r of routes) {
    const pathParts = r.path.split('/').filter(Boolean); // ['api', 'foo', 'bar']
    const group = pathParts.length >= 3 ? pathParts[1] : (pathParts[1] ?? 'misc');
    const list = grouped.get(group) ?? [];
    list.push(r);
    grouped.set(group, list);
  }

  const header =
    `## Routes nach Domäne\n\n` +
    `> Generiert: ${new Date().toISOString().split('T')[0]}. **${routes.length} Routes insgesamt** über ${grouped.size} Domänen-Cluster.\n\n`;

  const sections: string[] = [];
  for (const [group, list] of grouped.entries()) {
    sections.push(`### \`/api/${group}/*\` (${list.length} Routes)\n`);
    sections.push('| Method | Pfad | Datei |');
    sections.push('|---|---|---|');
    for (const r of list) {
      if (r.methods.length === 0) {
        sections.push(`| — | \`${r.path}\` | \`${relative(ROOT, r.file)}\` |`);
      } else {
        for (const m of r.methods) {
          sections.push(`| ${m} | \`${r.path}\` | \`${relative(ROOT, r.file)}\` |`);
        }
      }
    }
    sections.push('');
  }

  return header + sections.join('\n');
}

// ────────────────────────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────────────────────────

/**
 * Erlaubte Flags:
 *   --check       Dry-Run: generieren, mit aktuellem Markdown vergleichen,
 *                 Exit-Code 0 = aktuell, 1 = Drift (CI-Gate).
 *   --help / -h   Hilfe anzeigen.
 */
function parseArgs(argv: string[]): { check: boolean } {
  return {
    check: argv.includes('--check') || argv.includes('-c'),
  };
}

function printHelp(): void {
  console.log(`SwingZ Handbuch-Auto-Generator

Aufruf:
  tsx scripts/docs-autogen.ts           Schreibt Aktualisierungen in data-model.md + api-reference.md
  tsx scripts/docs-autogen.ts --check   Dry-Run; exit 0 = aktuell, exit 1 = Drift

Marker:
  <!-- AUTOGEN:BEGIN data-model --> ... <!-- AUTOGEN:END -->
  <!-- AUTOGEN:BEGIN api-routes --> ... <!-- AUTOGEN:END -->
  Nur diese Bereiche werden ersetzt. Manuelle Inhalte bleiben unangetastet.`);
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  if (args.check) {
    console.log('SwingZ Handbuch Auto-Gen: --check (Dry-Run)\n');
    const dmNew = renderNewDataModel();
    const arNew = renderNewApiReference();
    const dmDrift = wouldDiffer(dmNew, DATA_MODEL_TARGET);
    const arDrift = wouldDiffer(arNew, API_REF_TARGET);
    if (dmDrift || arDrift) {
      console.error(
        `DRIFT erkannt: data-model.md=${dmDrift ? 'DIFF' : 'OK'}, api-reference.md=${arDrift ? 'DIFF' : 'OK'}`
      );
      console.error('Loesung: npm run docs:autogen');
      process.exit(1);
    }
    console.log('OK — beide Auto-Gen-Bereiche sind aktuell.');
    return;
  }

  console.log('SwingZ Handbuch Auto-Gen (Schreib-Modus)\n');
  console.log('Generiere data-model.md ...');
  writeFileSync(DATA_MODEL_TARGET, renderNewDataModel());
  console.log(`  geschrieben: ${DATA_MODEL_TARGET}\n`);
  console.log('Generiere api-reference.md ...');
  writeFileSync(API_REF_TARGET, renderNewApiReference());
  console.log(`  geschrieben: ${API_REF_TARGET}`);
  console.log('\nFertig. Pruefe mit: git diff docs/handbook/dev/');
}

try {
  main();
} catch (err) {
  console.error('Auto-Gen fehlgeschlagen:', err);
  process.exit(1);
}
