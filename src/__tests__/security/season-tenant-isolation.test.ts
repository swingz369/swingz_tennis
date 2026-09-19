/**
 * Regression guard for two bug classes found in a 2026-07-26 security audit
 * (docs/ARCHIV/2026-07-26-produktaudit-verkaufsreife.md):
 *
 * 1. Missing club-membership check on `app/api/seasons/[id]/**` routes.
 *    `verifyRole()` only checks the caller's GLOBAL role, not membership in
 *    THIS season's own club — an admin of club A could read/write club B's
 *    billing config or member preferences. Confirmed and fixed in
 *    billing/route.ts and preferences/[userId]/route.ts.
 *
 * 2. Missing `await` before an async auth check (`if (!verifyRole(...))`).
 *    A Promise is always truthy, so the negation is always `false` and the
 *    guard never fires for ANY caller. Confirmed and fixed in
 *    calendar/route.ts and calendar/toggle/route.ts.
 *
 * Both are static source scans, not behavioral tests — cheap to run, and
 * they fail loudly the moment a new route reintroduces either pattern.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out;
}

describe('tenant isolation: app/api/seasons/[id]/**/route.ts', () => {
  const seasonsIdDir = path.join(ROOT, 'app/api/seasons/[id]');
  const routeFiles = walk(seasonsIdDir);

  // Routes that intentionally use a DIFFERENT, verified-safe scoping pattern
  // instead of authorizeSeasonAccess()/memberships-based checks:
  //   - groups/route.ts, groups/[groupId]/members/route.ts: query through
  //     `requireAuth()`'s RLS-enforced Supabase client (@/lib/supabase/server
  //     family) — an arbitrary clubId query param is backstopped by RLS.
  //   - copy-groups/route.ts: compares `season.club_id`/`auth.clubId` directly
  //     rather than via `auth.memberships`.
  //   - calendar/route.ts, calendar/toggle/route.ts: also RLS-backed via
  //     `auth.supabase` (from withApiAuth); toggle additionally scopes writes
  //     to the caller's own `auth.clubId`, never a season-derived club id.
  const ALLOWLIST = new Set(
    [
      'groups/route.ts',
      'groups/[groupId]/members/route.ts',
      'copy-groups/route.ts',
      'calendar/route.ts',
      'calendar/toggle/route.ts',
      // ADR-005: Service (`SeasonPreferenceService`) prüft die Mitgliedschaft in der Saison-Club,
      // Repository liest per RLS-Client. Der Guard steht nicht mehr im Route-Quelltext.
      'preferences/route.ts',
      'preferences/[userId]/route.ts',
    ].map((p) => path.join(seasonsIdDir, p))
  );

  const hasTenantGuard = (src: string) =>
    /authorizeSeasonAccess\(|verifyClubAccess\(/.test(src) ||
    (/\.memberships\b/.test(src) && /club_id/.test(src)) ||
    (/auth\.clubId\b/.test(src) && /club_id/.test(src));

  it("every route file scopes access to the season's own club", () => {
    const violations = routeFiles
      .filter((f) => !ALLOWLIST.has(f))
      .filter((f) => !hasTenantGuard(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));

    expect(violations).toEqual([]);
  });
});

describe('async auth checks are always awaited', () => {
  const ASYNC_AUTH_HELPERS = ['verifyRole', 'verifyTrainerInClub', 'verifyOffice'];

  const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.tokensave', '.claude']);

  function collectTsFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collectTsFiles(full, out);
      else if (/\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it('no "if (!helper(...))" guard is missing its await', () => {
    const files = collectTsFiles(path.join(ROOT, 'app'));
    const violations: string[] = [];

    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const helper of ASYNC_AUTH_HELPERS) {
          const guardRe = new RegExp(`if\\s*\\(\\s*!\\s*${helper}\\(`);
          const awaitRe = new RegExp(`await\\s*${helper}`);
          if (guardRe.test(line) && !awaitRe.test(line)) {
            violations.push(`${path.relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
