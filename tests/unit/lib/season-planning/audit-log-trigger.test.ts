/**
 * Vitest regression test for ticket 3.7.3 — Season Planning 23514 Trigger-Channel.
 *
 * Validates the static content of migration
 * `supabase/migrations/20260701_widen_season_planning_history_action_type_check.sql`.
 *
 * Bug background (live-DB-Probe 2026-07-01):
 *   The Postgres CHECK constraint `season_planning_history_action_type_check` rejected
 *   `created`/`updated`/`deleted` (SQLSTATE 23514), but the AFTER INSERT/UPDATE/DELETE
 *   trigger `log_season_plan_entry_changes()` (in 20260506_fix_season_planning_groups.sql
 *   L145-188) emits exactly those values. Every successful INSERT into
 *   season_plan_entries triggered a 23514 → cluster-pipeline-block.
 *
 *   The bug was previously masked by the FK-Drift on season_plan_entries.group_id
 *   (23503 fired before the trigger was reached). Migration
 *   20260630_recorrect_season_plan_entries_group_fk.sql fixed the FK drift, which
 *   surfaced the 23514 channel. This migration widens the CHECK constraint to
 *   accept all 18 values emitted by the three source-of-truth texts.
 *
 * Acceptance evidence:
 *   - Docblock above + ticket docs/tickets/q3/3.7.3.md (Live-Probe section)
 *   - After apply: npx tsx scripts/_repro-cluster.ts exits 0 (full
 *     cluster pipeline regression end-to-end)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import { fileURLToPath } from 'node:url';
import * as path from 'path';

// ESM-strict-safe __dirname shim (forward-compatible if tsconfig flips to NodeNext).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_PATH = path.join(
  __dirname,
  '..', '..', '..', '..',
  'supabase', 'migrations',
  '20260701_widen_season_planning_history_action_type_check.sql',
);

// The 18 expected action_type values, partitioned by source-of-truth text.
const TRIGGER_A_EMITTED = ['created', 'updated', 'deleted'];
const TRIGGER_B_EMITTED = [
  'season_created',
  'preferences_opened',
  'auto_plan_started',
  'plan_published',
  'season_activated',
  'season_completed',
  'manual_edit',
];
const COMMENT_LITERAL_C = [
  'plan_created',
  'plan_regenerated',
  'entry_added',
  'entry_modified',
  'entry_removed',
  'conflict_resolved',
  'preferences_closed',
  'published',
];
const ALL_EXPECTED = [
  ...TRIGGER_A_EMITTED,
  ...TRIGGER_B_EMITTED,
  ...COMMENT_LITERAL_C,
];

describe('Ticket 3.7.3 — Season Planning 23514 Trigger-Channel Migration', () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  });

  it('file exists at the expected project-root-relative path', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it('DROPs the existing CHECK constraint (idempotent re-apply safe)', () => {
    expect(sql).toMatch(
      /ALTER\s+TABLE\s+season_planning_history\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+season_planning_history_action_type_check/i,
    );
  });

  it('ADDs the CHECK constraint with the same constraint name', () => {
    expect(sql).toMatch(
      /ALTER\s+TABLE\s+season_planning_history\s+ADD\s+CONSTRAINT\s+season_planning_history_action_type_check/i,
    );
  });

  it('wraps the migration body in BEGIN/COMMIT (single transaction)', () => {
    expect(sql).toMatch(/^\s*BEGIN\s*;/im);
    expect(sql).toMatch(/^\s*COMMIT\s*;?/im);
  });

  it.each(ALL_EXPECTED)(
    'whitelists the action_type value "%s" (single-quoted in CHECK clause)',
    (value: string) => {
      // Match the value as a single-quoted string literal (the form Postgres CHECK uses).
      const regex = new RegExp(`'\\s*${value}\\s*'`);
      expect(sql).toMatch(regex);
    },
  );

  it('contains exactly 18 single-quoted action_type literals (regression guard)', () => {
    // Extract the CHECK (...) block, then count quoted literals inside it.
    const checkMatch = sql.match(/CHECK\s*\(\s*action_type\s+IN\s*\(([\s\S]*?)\)\s*\)/i);
    expect(checkMatch).not.toBeNull();
    const inner = checkMatch?.[1] ?? '';
    const quotedLiterals = inner.match(/'\s*[^']+?\s*'/g) ?? [];
    expect(quotedLiterals.length).toBe(18);
  });

  it('does not introduce unrelated DROP statements (table / schema / function / trigger)', () => {
    // The fix is constraint-only; no structural changes to tables or trigger functions.
    expect(sql).not.toMatch(/DROP\s+TABLE\b/i);
    expect(sql).not.toMatch(/DROP\s+SCHEMA\b/i);
    expect(sql).not.toMatch(/DROP\s+FUNCTION\b/i);
    expect(sql).not.toMatch(/DROP\s+TRIGGER\b/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\b/i);
  });

  it('does not add unused columns to season_planning_history', () => {
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+season_planning_history[\s\S]*?\bADD\s+COLUMN\b/i);
  });

  it('refers only to season_planning_history in its ALTER TABLE statements', () => {
    const alters = sql.match(/ALTER\s+TABLE\s+\w+/gi) ?? [];
    expect(alters.length).toBeGreaterThan(0);
    for (const stmt of alters) {
      const tableName = stmt.replace(/^ALTER\s+TABLE\s+/i, '').trim().split(/\s/)[0];
      expect(tableName).toBe('season_planning_history');
    }
  });
});
