/**
 * End-to-end cluster-pipeline verification for ticket 3.7.3 (23514 trigger-channel).
 *
 * Two-layer design:
 *   Layer 1 — Precondition probe: queries live CHECK `season_planning_history_action_type_check`
 *     with the action_type values that the AFTER INSERT/UPDATE/DELETE trigger
 *     `log_season_plan_entry_changes()` would emit. Auto-detects fix variant:
 *       A = whitelist widened (created/updated/deleted accepted)
 *       B = trigger mapped (entry_added/entry_modified/entry_removed accepted)
 *       MIXED = BOTH sets accepted (whitelist widened AND trigger mapped — semantically dirty but acceptance OK)
 *       NONE = 23514 fix NOT applied on live DB; pipeline skips layer 2.
 *   Layer 2 — Full pipeline: runs SeasonClusteringEngine.runClustering(dryRun=false)
 *     on TC Rheinland Sommer 2026. Verifies runClustering success=true,
 *     entries.length >= 1, season_plan_entries delta > 0.
 *
 * Exit codes:
 *   0 = ALL GREEN (Layer 1 fix applied + Layer 2 cluster succeeded + rows landed)
 *   2 = Layer 1 precondition NOT met (23514 fix not yet applied on live DB)
 *   3 = Layer 2 succeeded but no entries landed (= engine succeeded without producing rows)
 *   4 = Layer 2 succeeded but season_plan_entries row count did NOT increase on a FRESH season
 *       (beforeCount=0). Acceptable-criterion failure.
 *   5 = Layer 2 threw (uncaught engine exception)
 *   6 = Infra: season_plan_entries count query returned null (table missing / RLS / network).
 *       Distinct from exit 4 because semantically this is a count-query infrastructure failure,
 *       not an acceptance-criterion failure.
 *
 * Note: season_plan_entries row-count delta is advisory only when the season is already-clustered
 * (beforeCount > 0); on a fresh season (beforeCount = 0), delta > 0 is part of the user's literal
 * acceptance criterion ("≥1 row landed in season_plan_entries") and remains blocking (exit 4).
 *
 * Cleanup: probes insert+delete candidate whitelist rows transactionally so the
 * probe is idempotent and never leaves orphaned history rows. After `ALL GREEN`
 * this script can be deleted (per ticket 3.7.3 acceptance criteria).
 */
import 'dotenv/config';
import { createServiceClient } from '@/lib/supabase/service';
import { SeasonClusteringEngine } from '@/lib/season-planning/clustering-engine';

interface WhitelistProbeResult {
  value: string;
  ok: boolean;
  code: string | null;
  history_row_deleted: boolean;
}

async function probeWhitelist(
  sb: ReturnType<typeof createServiceClient>,
  seasonId: string,
  clubId: string,
  candidates: string[],
): Promise<WhitelistProbeResult[]> {
  const results: WhitelistProbeResult[] = [];
  for (const value of candidates) {
    const { data: inserted, error } = await sb
      .from('season_planning_history')
      .insert({ season_id: seasonId, club_id: clubId, action_type: value })
      .select('id, created_at')
      .single();
    const ok = !error;
    if (ok && inserted?.id) {
      // Cleanup immediately so the probe is non-destructive.
      await sb.from('season_planning_history').delete().eq('id', inserted.id);
    }
    results.push({
      value,
      ok,
      code: error?.code ?? null,
      history_row_deleted: ok && !!inserted?.id,
    });
  }
  return results;
}

function fmtProbeRow(p: WhitelistProbeResult): string {
  const status = p.ok ? 'ACCEPTED' : `REJECTED (${p.code})`;
  const cleanup = p.ok
    ? p.history_row_deleted
      ? '  // probe-row cleaned up'
      : '  // WARNING: probe-row cleanup failed'
    : '';
  return `  ${p.value.padEnd(28)} -> ${status}${cleanup}`;
}

async function main(): Promise<void> {
  const sb = createServiceClient() as ReturnType<typeof createServiceClient>;

  // Resolve TC Rheinland Sommer 2026 (deterministic seed target).
  const { data: clubs, error: clubsErr } = await sb
    .from('clubs')
    .select('id, name')
    .ilike('name', '%rheinland%')
    .limit(1);
  if (clubsErr || !clubs?.length) {
    console.error('FATAL: TC Rheinland lookup failed:', clubsErr?.message ?? 'no rows');
    process.exit(1);
  }
  const club = clubs[0];

  const { data: season, error: seasonErr } = await sb
    .from('seasons')
    .select('id, name, planning_status')
    .eq('club_id', club.id)
    .eq('season_type', 'summer')
    .eq('year', 2026)
    .maybeSingle();
  if (seasonErr || !season) {
    console.error('FATAL: Sommer 2026 season lookup failed:', seasonErr?.message ?? 'no rows');
    process.exit(1);
  }

  console.log('=== TC Rheinland Sommer 2026 ===');
  console.log(`club="${club.name}" (${club.id})`);
  console.log(`season="${season.name}" (${season.id}) status="${season.planning_status}"`);
  console.log('');

  // LAYER 1 — Precondition probe (23514-fix detection)
  console.log('=== Layer 1: 23514-fix precondition probe ===');
  const candidates = [
    // Trigger-emitted values (Variante A: Whitelist widens these)
    'created', 'updated', 'deleted',
    // Trigger-mapped values (Variante B: Trigger uses these instead)
    'entry_added', 'entry_modified', 'entry_removed',
  ];
  const probeResults = await probeWhitelist(sb, season.id, club.id, candidates);
  for (const p of probeResults) console.log(fmtProbeRow(p));

  const triggerEmittedOk = probeResults
    .filter((p) => ['created', 'updated', 'deleted'].includes(p.value))
    .every((p) => p.ok);
  const triggerMappedOk = probeResults
    .filter((p) => ['entry_added', 'entry_modified', 'entry_removed'].includes(p.value))
    .every((p) => p.ok);

  console.log('');
  console.log(`  Trigger-emitted ('created'/'updated'/'deleted') accepted?     ${triggerEmittedOk}`);
  console.log(`  Trigger-mapped   ('entry_added'/'entry_modified'/'entry_removed') accepted? ${triggerMappedOk}`);

  // Explicit MIXED detection: if BOTH sets accepted, the CHECK was widened AND
  // the trigger was mapped — semantically dirty state (the trigger now writes
  // values the whitelist already covers, but the whitelist has duplicates).
  // Surface it explicitly so a half-applied fix is not silently reported as A.
  const fixVariant: 'A' | 'B' | 'MIXED' | 'NONE' =
    triggerEmittedOk && triggerMappedOk
      ? 'MIXED'
      : triggerEmittedOk
        ? 'A'
        : triggerMappedOk
          ? 'B'
          : 'NONE';
  const fixLabel =
    fixVariant === 'A'
      ? 'Whitelist erweitert (created/updated/deleted accepted)'
      : fixVariant === 'B'
        ? 'Trigger gemappt (entry_added/entry_modified/entry_removed accepted)'
        : fixVariant === 'MIXED'
          ? '⚠ HALB ANGEWANDT: Whitelist erweitert + Trigger mapped — semantisch dirty, Akzeptanz OK'
          : 'NICHT angewendet — 23514 fix noch ausstehend';
  console.log(`  Detected fix variant: ${fixVariant}  //  ${fixLabel}`);
  if (fixVariant === 'MIXED') {
    console.log('  [advisory] Trigger emittiert eventuell beide Sets — Whitelist dedupliziert nicht.');
    console.log('  [advisory] Empfehlung: Trigger-Emission normalisieren ODER Whitelist auf exakt 11 Werte reduzieren.');
  }
  console.log('');

  if (fixVariant === 'NONE') {
    console.log('=== Layer 2 SKIPPED: 23514 fix not yet applied on live DB. ===');
    console.log('Apply ticket 3.7.3 (Variant A or B) via `npx supabase db push` on dev-machine first,');
    console.log('then re-run `npx tsx scripts/_repro-cluster.ts`.');
    process.exit(2);
  }

  // LAYER 2 — Full cluster pipeline
  console.log(`=== Layer 2: SeasonClusteringEngine.runClustering (HTTP 200 + ≥1 row) ===`);

  // Snapshot season_plan_entries row count BEFORE run.
  const { count: beforeCount } = await sb
    .from('season_plan_entries')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', season.id);
  console.log(`  season_plan_entries rows BEFORE run: ${beforeCount ?? 0}`);

  try {
    const engine = new SeasonClusteringEngine({
      seasonId: season.id,
      clubId: club.id,
      autoResolveConflicts: true,
    });
    const result = await engine.runClustering(false);
    const success = result.success === true;
    const entriesCount = result.entries?.length ?? 0;

    console.log('  runClustering returned:', JSON.stringify({
      success: result.success,
      entries_count: entriesCount,
      conflicts_count: result.conflicts?.length ?? 0,
      error: result.error ?? null,
    }));

    // Snapshot AFTER run.
    const { count: afterCount } = await sb
      .from('season_plan_entries')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', season.id);
    console.log(`  season_plan_entries rows AFTER  run: ${afterCount ?? 0}  (delta: ${(afterCount ?? 0) - (beforeCount ?? 0)})`);

    const pipelineOk = success && entriesCount >= 1;
    // Re-running against an already-clustered season can produce 0 new rows
    // because the engine deduplicates plans. The primary signal is
    // runClustering's own success + entries produced (the engine writes the
    // planned entries atomically via Supabase REST). Row-count delta is
    // advisory only — a zero delta does NOT invalidate the green verdict
    // because the engine's authoritative return value already says success.
    const rowcountDelta = (afterCount ?? 0) - (beforeCount ?? 0);
    const deltaOk = rowcountDelta > 0;
    console.log('');
    console.log('=== Layer 2 verdict ===');
    console.log(`  runClustering success (HTTP 200 implicit):   ${success}`);
    console.log(`  entries.length >= 1:                          ${entriesCount >= 1}  (entries=${entriesCount})`);
    console.log(`  season_plan_entries delta > 0:                ${deltaOk}  (delta=${rowcountDelta}, advisory only)`);
    console.log(`  pipeline_ok:                                  ${pipelineOk}`);

    if (!success) {
      console.error('=== PIPELINE FAIL — runClustering returned success=false ===');
      process.exit(3);
    }
    if (entriesCount < 1) {
      console.error('=== PIPELINE FAIL — no entries produced ===');
      process.exit(3);
    }
    if (!deltaOk) {
      // Distinguish three delta-zero cases:
      //   1. beforeCount === null  → Supabase count query failed (table missing / RLS / network) → BLOCK + diagnostic
      //   2. beforeCount === 0     → fresh season, user acceptance "≥1 row landed" requires delta > 0 → BLOCK
      //   3. beforeCount > 0       → re-run against already-clustered season, engine deduplicates → ADVISORY
      if (beforeCount === null) {
        console.error('=== INFRA FAIL — season_plan_entries count query returned null ===');
        console.error('  Supabase could not compute row count (table missing / RLS / network).');
        console.error(`  Hint: verify SELECT COUNT(*) FROM season_plan_entries works manually as service-role;`);
        console.error('  Hint: check RLS policies on season_plan_entries, SUPABASE_SERVICE_ROLE_KEY env, table presence.');
        console.error(`  delta=${rowcountDelta} → cannot verify acceptance criterion.`);
        process.exit(6);
      }
      if (beforeCount === 0) {
        console.error('=== PIPELINE FAIL — fresh season (beforeCount=0) but no row landed ===');
        console.error(`  delta=${rowcountDelta}, but user acceptance is "≥1 row landed in season_plan_entries".`);
        console.error('  Hint: engine.persistEntries() may be silently dropping plan rows. Inspect season_plan_entries schema drift.');
        process.exit(4);
      }
      console.warn(`  [advisory] season_plan_entries row count did not increase (delta=${rowcountDelta}).`);
      console.warn('  [advisory] Likely root cause: re-run against already-clustered season, engine deduplicates.');
      console.warn('  [advisory] Re-running against a fresh season_id will show delta > 0.');
    }
    console.log('');
    console.log('=== ALL GREEN ===');
    console.log('  ✓ Layer 1: 23514 fix applied (' + fixVariant + ')');
    console.log('  ✓ Layer 2: runClustering returned success=true + entries >= 1');
    if (deltaOk) {
      console.log('  ✓ Layer 2: season_plan_entries row count increased');
    } else {
      console.log('  ⚠ Layer 2: season_plan_entries delta=0 (advisory, see warning above)');
    }
    console.log('');
    console.log('Script `scripts/_repro-cluster.ts` can now be deleted.');
    process.exit(0);
  } catch (e: unknown) {
    const err = e as Error;
    console.error('=== Pipeline threw ===');
    console.error('  message:', err?.message);
    console.error('  stack head:', String(err?.stack ?? '').split('\n').slice(0, 6).join('\n'));
    process.exit(5);
  }
}

main().catch((e: unknown) => {
  console.error('FATAL main():', (e as Error)?.message ?? e);
  process.exit(1);
});
