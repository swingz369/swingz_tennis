#!/usr/bin/env npx tsx
/**
 * Prüft die Doku-Regeln aus AGENTS.md maschinell.
 *
 * Die Regeln standen seit Monaten als Prosa in AGENTS.md und wurden trotzdem
 * mehrfach gebrochen (ROUTING.md/ROUTING2.md, DESIGN.md/DESIGN_KONZEPT.md,
 * TEST-CREDENTIALS.md/TESTZUGAENGE.md). Prosa ohne Prüfung ist keine Regel,
 * sondern eine Bitte. Dieses Skript macht daraus eine Regel.
 *
 * Usage: npm run docs:check
 * Exit 1 bei Verstößen, 0 bei nur Warnungen.
 */
import * as fs from 'fs';
import * as path from 'path';

const DOCS = 'docs';
/** Generierte Artefakte (AGENTS.md Regel 5) — kein Doku-Content. */
const GENERATED = ['TEST-CREDENTIALS.md'];
/** Dateinamen-Muster, die auf eine Parallel-Datei statt eines Updates hindeuten. */
const DUPLICATE_PATTERNS = [
  /_v\d+\./i,
  /_NEU\./i,
  /_KONZEPT\./i,
  /_ALT\./i,
  /-KOPIE\./i,
  /_FINAL\./i,
];

const errors: string[] = [];
const warnings: string[] = [];

const err = (file: string, msg: string) => errors.push(`  ${file}\n    → ${msg}`);
const warn = (file: string, msg: string) => warnings.push(`  ${file}\n    → ${msg}`);

function livingDocs(): string[] {
  return fs
    .readdirSync(DOCS)
    .filter((f) => f.endsWith('.md') && !GENERATED.includes(f))
    .sort();
}

// ── Regel 2: keine Parallel-Datei zu einem bestehenden Dokument ───────────
function checkDuplicates(docs: string[]) {
  for (const f of docs) {
    if (DUPLICATE_PATTERNS.some((p) => p.test(f))) {
      err(
        `docs/${f}`,
        'Name deutet auf Parallel-Datei hin — bestehendes Dokument updaten (AGENTS.md Regel 2)'
      );
    }
    // ROUTING.md vs ROUTING2.md: Ziffernsuffix an sonst gleichem Namen
    const stripped = f.replace(/(\d+)\.md$/, '.md');
    if (stripped !== f && docs.includes(stripped)) {
      err(`docs/${f}`, `Dublette zu docs/${stripped} — zusammenführen (AGENTS.md Regel 2)`);
    }
  }
}

// ── Regel 4: Verifikationsdatum in lebenden Dokumenten ────────────────────
function checkVerifiedHeader(docs: string[]) {
  for (const f of docs) {
    const head = fs.readFileSync(path.join(DOCS, f), 'utf8').split('\n').slice(0, 15).join('\n');
    if (!/Zuletzt (verifiziert|aktualisiert)/i.test(head)) {
      warn(`docs/${f}`, 'Kopfzeile "> Zuletzt verifiziert: <Datum>" fehlt (AGENTS.md Regel 4)');
    }
  }
}

// ── Regel 2/3: jedes lebende Dokument steht im Index ──────────────────────
function checkIndexed(docs: string[]) {
  const index = fs.readFileSync(path.join(DOCS, 'README.md'), 'utf8');
  for (const f of docs) {
    if (f === 'README.md') continue;
    if (!index.includes(f)) {
      err(
        `docs/${f}`,
        'nicht in docs/README.md verlinkt — sonst legt der nächste Agent es doppelt an'
      );
    }
  }
}

// ── Regel 1: Archiv-Dateien tragen ein Datum ──────────────────────────────
function checkArchive() {
  const dir = path.join(DOCS, 'ARCHIV');
  if (!fs.existsSync(dir)) return;
  const undated = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !/\d{4}-\d{2}-\d{2}/.test(f));
  if (undated.length) {
    warn(
      `docs/ARCHIV/ (${undated.length} Dateien)`,
      `ohne Datum im Namen, z.B. ${undated.slice(0, 3).join(', ')} — Schema YYYY-MM-DD-thema.md (AGENTS.md Regel 1)`
    );
  }
}

// ── Regel 3: ADR-Namensschema und fortlaufende Nummern ────────────────────
function checkAdrs() {
  const dir = path.join(DOCS, 'decisions');
  if (!fs.existsSync(dir)) {
    warn('docs/decisions/', 'existiert nicht, obwohl AGENTS.md Regel 3 ADRs dorthin vorschreibt');
    return;
  }
  const seen = new Map<string, string>();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const m = f.match(/^adr-(\d{3})-[a-z0-9-]+\.md$/);
    if (!m) {
      err(`docs/decisions/${f}`, 'verletzt Namensschema adr-NNN-slug.md (AGENTS.md Regel 3)');
      continue;
    }
    const prev = seen.get(m[1]);
    if (prev) err(`docs/decisions/${f}`, `ADR-Nummer ${m[1]} doppelt vergeben (auch ${prev})`);
    seen.set(m[1], f);
  }
}

// ── Tote relative Links in lebenden Dokumenten ────────────────────────────
function checkLinks(docs: string[]) {
  for (const f of docs) {
    const body = fs.readFileSync(path.join(DOCS, f), 'utf8');
    for (const m of body.matchAll(/\]\((?!https?:|#|mailto:)([^)#]+)/g)) {
      const target = path.resolve(DOCS, m[1].trim());
      if (!fs.existsSync(target)) {
        err(`docs/${f}`, `toter Link: ${m[1].trim()}`);
      }
    }
  }
}

function main() {
  const docs = livingDocs();
  checkDuplicates(docs);
  checkVerifiedHeader(docs);
  checkIndexed(docs);
  checkArchive();
  checkAdrs();
  checkLinks(docs);

  if (warnings.length) {
    console.log(`\n⚠️  ${warnings.length} Warnung(en):`);
    console.log(warnings.join('\n'));
  }
  if (errors.length) {
    console.log(`\n❌ ${errors.length} Verstoß/Verstöße gegen AGENTS.md:`);
    console.log(errors.join('\n'));
    console.log('\nRegeln: AGENTS.md → Dokumentations-Regeln\n');
    process.exit(1);
  }
  console.log(`\n✅ Doku-Regeln eingehalten (${docs.length} lebende Dokumente geprüft).\n`);
}

main();
