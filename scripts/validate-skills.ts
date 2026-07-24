#!/usr/bin/env npx tsx
/**
 * validate-skills.ts
 *
 * Validiert alle Skills in .codebuff/skills/:
 *   1. Jede SKILL.md hat gültiges YAML-Frontmatter (name + description)
 *   2. description enthält mindestens 3 Trigger-Keywords (Komma-getrennt)
 *   3. "Where it lives"-Section referenziert existierende Dateien
 *   4. README-Index ist synchron mit den tatsächlichen Skills
 *
 * Usage:
 *   npx tsx scripts/validate-skills.ts
 *   npx tsx scripts/validate-skills.ts --json
 *   npm run validate:skills
 *
 * Exit codes:
 *   0 = alle Checks bestanden
 *   1 = mindestens ein Check fehlgeschlagen
 *   2 = Setup-Fehler (z.B. .codebuff/skills/ nicht gefunden)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, basename, relative } from 'path';

// ═══ YAML frontmatter parser (minimal, no deps) ═══════════════════════
function parseFrontmatter(content: string): { data: Record<string, string>; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const [, yamlBlock, body] = match;
  const data: Record<string, string> = {};
  for (const line of yamlBlock.split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) {
      const [, key, rawValue] = m;
      // Strip surrounding quotes if present
      let value = rawValue.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      data[key] = value;
    }
  }
  return { data, body };
}

// ═══ Trigger keyword counter ═══════════════════════════════════════════
function countTriggerKeywords(description: string): number {
  // Count comma-separated items OR bullet keywords after "You mention:"
  const mentions = description.match(/You mention:\s*([^|]+?)(?:\.|$)/i);
  if (mentions) {
    // Split on commas — each non-empty item is a keyword
    return mentions[1].split(',').filter((k) => k.trim().length > 0).length;
  }
  // Fallback: count comma-separated words/phrases in the whole description
  return description.split(',').filter((k) => k.trim().length > 0).length;
}

// ═══ File path extraction from "Where it lives" section ═══════════════
function extractFileRefs(body: string): string[] {
  // Find "## Where it lives" section, extract backtick-quoted paths
  const section = body.match(/##\s*Where it lives[\s\S]*?(?=\n##\s|\n---|\Z)/i);
  if (!section) return [];
  const backticked = section[0].match(/`([^`]+)`/g) || [];
  return backticked
    .map((b) => b.replace(/`/g, '').trim())
    .filter((p) => p.includes('/') || p.includes('.')) // filter out non-paths
    .filter((p) => !p.startsWith('http')); // exclude URLs
}

function fileExists(ref: string, cwd: string): boolean {
  // Strip trailing annotations like " (if exists)" or " (optional)"
  const cleanPath = ref.replace(/\s*\([^)]*\)\s*$/, '').trim();
  // Direct match
  if (existsSync(resolve(cwd, cleanPath))) return true;
  // Try with .ts/.tsx/.md extension if missing
  if (!cleanPath.match(/\.[a-z]+$/i)) {
    for (const ext of ['.ts', '.tsx', '.md', '.sql', '.json', '.mjs']) {
      if (existsSync(resolve(cwd, cleanPath + ext))) return true;
    }
  }
  return false;
}

// ═══ README index sync check ═══════════════════════════════════════════
function readmeIndexEntries(readmeContent: string): string[] {
  // Find skill entries: **[**swingz-xxx**](./swingz-xxx/...)**
  const matches = readmeContent.match(/\[\*\*(swingz-[a-z0-9-]+)\*\*\]/g) || [];
  return matches.map((m) => m.match(/(swingz-[a-z0-9-]+)/)![1]);
}

// ═══ Single skill check ═══════════════════════════════════════════════
interface SkillResult {
  skill: string;
  path: string;
  frontmatter: { valid: boolean; name: string; description: string; errors: string[] };
  triggerKeywords: { count: number; ok: boolean };
  fileRefs: { total: number; found: number; missing: string[] };
  inReadme: boolean;
  ok: boolean;
}

function checkSkill(skillDir: string, cwd: string, readmeSkills: Set<string>): SkillResult {
  const skillName = basename(skillDir);
  const skillMdPath = join(skillDir, 'SKILL.md');
  const result: SkillResult = {
    skill: skillName,
    path: relative(cwd, skillMdPath),
    frontmatter: { valid: false, name: '', description: '', errors: [] },
    triggerKeywords: { count: 0, ok: false },
    fileRefs: { total: 0, found: 0, missing: [] },
    inReadme: readmeSkills.has(skillName),
    ok: false,
  };

  if (!existsSync(skillMdPath)) {
    result.frontmatter.errors.push('SKILL.md not found');
    return result;
  }

  const content = readFileSync(skillMdPath, 'utf-8');
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    result.frontmatter.errors.push(
      'No valid YAML frontmatter (must start with --- and end with ---)'
    );
    return result;
  }

  const { data, body } = parsed;
  if (!data.name) result.frontmatter.errors.push('Missing "name" field');
  if (!data.description) result.frontmatter.errors.push('Missing "description" field');
  if (data.name && data.name !== skillName) {
    result.frontmatter.errors.push(`name "${data.name}" doesn't match directory "${skillName}"`);
  }
  result.frontmatter = {
    ...result.frontmatter,
    valid: result.frontmatter.errors.length === 0,
    name: data.name || '',
    description: data.description || '',
  };

  // Trigger keywords
  const kwCount = countTriggerKeywords(data.description || '');
  result.triggerKeywords = { count: kwCount, ok: kwCount >= 3 };

  // File refs
  const refs = extractFileRefs(body);
  const missing: string[] = [];
  for (const ref of refs) {
    if (fileExists(ref, cwd)) {
      result.fileRefs.found++;
    } else {
      missing.push(ref);
    }
  }
  result.fileRefs = { total: refs.length, found: result.fileRefs.found, missing };

  result.ok =
    result.frontmatter.valid &&
    result.triggerKeywords.ok &&
    result.fileRefs.missing.length === 0 &&
    result.inReadme;
  return result;
}

// ═══ Report formatting ════════════════════════════════════════════════
function formatHumanReport(results: SkillResult[]): string {
  const lines: string[] = [];
  lines.push('┌──────────────────────────┬────────┬──────┬────────┬────────┬────────┐');
  lines.push('│ Skill                    │ YAML   │ Keys │ Files  │ README │ OK     │');
  lines.push('├──────────────────────────┼────────┼──────┼────────┼────────┼────────┤');
  for (const r of results) {
    const padded = r.skill.padEnd(24);
    const yaml = r.frontmatter.valid ? '   ✅  ' : '   ❌  ';
    const keys = r.triggerKeywords.ok
      ? `  ${r.triggerKeywords.count} ✅ `
      : `  ${r.triggerKeywords.count} ❌ `;
    const files =
      r.fileRefs.missing.length === 0
        ? ` ${r.fileRefs.found}/${r.fileRefs.total} ✅`
        : ` ${r.fileRefs.found}/${r.fileRefs.total} ❌`;
    const readme = r.inReadme ? '   ✅  ' : '   ❌  ';
    const ok = r.ok ? '   ✅  ' : '   ❌  ';
    lines.push(`│ ${padded} │${yaml}│${keys}│${files} │${readme}│${ok}│`);
  }
  lines.push('└──────────────────────────┴────────┴──────┴────────┴────────┴────────┘');
  return lines.join('\n');
}

function formatJsonReport(results: SkillResult[], readmeSkills: string[]): string {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      totalSkills: results.length,
      passing: results.filter((r) => r.ok).length,
      failing: results.filter((r) => !r.ok).length,
      readmeSkills,
      skills: results,
    },
    null,
    2
  );
}

// ═══ Main ══════════════════════════════════════════════════════════════
function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json') || args.includes('-j');

  const cwd = process.cwd();
  const skillsDir = resolve(cwd, '.codebuff/skills');
  const readmePath = resolve(skillsDir, 'README.md');

  if (!existsSync(skillsDir)) {
    if (jsonMode) {
      console.log(JSON.stringify({ ok: false, error: '.codebuff/skills/ not found' }, null, 2));
    } else {
      console.error(`❌ Skills-Verzeichnis nicht gefunden: ${skillsDir}`);
    }
    process.exit(2);
  }

  // Read README index
  const readmeContent = existsSync(readmePath) ? readFileSync(readmePath, 'utf-8') : '';
  const readmeEntries = readmeIndexEntries(readmeContent);
  const readmeSet = new Set(readmeEntries);

  // Find all skill directories
  const entries = readdirSync(skillsDir).filter((e) => {
    const p = join(skillsDir, e);
    return statSync(p).isDirectory() && e.startsWith('swingz-');
  });

  if (entries.length === 0) {
    if (jsonMode) {
      console.log(
        JSON.stringify({ ok: false, error: 'No swingz-* skill directories found' }, null, 2)
      );
    } else {
      console.error('❌ Keine swingz-* Skill-Verzeichnisse gefunden');
    }
    process.exit(2);
  }

  // Check each skill
  const results: SkillResult[] = entries
    .map((e) => checkSkill(join(skillsDir, e), cwd, readmeSet))
    .sort((a, b) => a.skill.localeCompare(b.skill));

  // Check for README entries that don't have a skill directory
  const skillSet = new Set(entries);
  const orphanedReadmeEntries = readmeEntries.filter((e) => !skillSet.has(e));

  const ok = results.every((r) => r.ok) && orphanedReadmeEntries.length === 0;

  if (jsonMode) {
    const jsonReport = JSON.parse(formatJsonReport(results, readmeEntries));
    jsonReport.orphanedReadmeEntries = orphanedReadmeEntries;
    jsonReport.ok = ok;
    console.log(JSON.stringify(jsonReport, null, 2));
  } else {
    console.log('🔍 Skill-Validierung startet...\n');
    console.log(`📁 Skills-Verzeichnis: ${relative(cwd, skillsDir)}`);
    console.log(`📋 README-Index: ${readmeEntries.length} Einträge`);
    console.log(`📂 Tatsächliche Skills: ${entries.length} Verzeichnisse\n`);
    console.log(formatHumanReport(results));

    // Detailed error report
    const failing = results.filter((r) => !r.ok);
    if (failing.length > 0) {
      console.log(`\n❌ ${failing.length} Skill(s) haben Issues:\n`);
      for (const r of failing) {
        console.log(`  ${r.skill}:`);
        if (!r.frontmatter.valid) {
          for (const e of r.frontmatter.errors) console.log(`    • Frontmatter: ${e}`);
        }
        if (!r.triggerKeywords.ok) {
          console.log(
            `    • Trigger-Keywords: ${r.triggerKeywords.count}/3 (description braucht "You mention: a, b, c, ...")`
          );
        }
        if (r.fileRefs.missing.length > 0) {
          for (const m of r.fileRefs.missing) console.log(`    • Fehlende Datei: ${m}`);
        }
        if (!r.inReadme) {
          console.log(
            `    • Nicht in README-Index — füge Zeile hinzu: | [**${r.skill}**](./${r.skill}/SKILL.md) | ... |`
          );
        }
      }
    }
    if (orphanedReadmeEntries.length > 0) {
      console.log(`\n⚠️  README-Einträge ohne Skill-Verzeichnis:`);
      for (const e of orphanedReadmeEntries) console.log(`    • ${e}`);
    }
    console.log('\n' + '='.repeat(70));
    if (ok) {
      console.log(`✅ Alle ${results.length} Skills bestanden die Validierung`);
    } else {
      console.log(`❌ Skill-Validierung fehlgeschlagen`);
    }
    console.log('='.repeat(70));
  }

  process.exit(ok ? 0 : 1);
}

main();
