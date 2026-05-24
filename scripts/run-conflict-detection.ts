// Run conflict detection for the clustered season
// Calls the ConflictDetector directly (same logic as POST /api/seasons/{id}/planning/conflicts)

import { ConflictDetector } from '../lib/season-planning/conflict-detector';
import type { GroupAssignment } from '../lib/season-planning/types';
import { getDb } from '../src/infrastructure/persistence/client';
import { seasonPlanEntries } from '../src/infrastructure/persistence/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const seasonId = '6bd8f187-48b8-45eb-af39-e0813e8af088';
  const clubId = 'e7cb492c-8e16-4b89-b62d-12d46fba8bbf';

  console.log('🚀 Lade Plan-Einträge aus der DB...');

  // Load plan entries (same logic as the API route)
  const db = getDb();
  const entries = await db
    .select()
    .from(seasonPlanEntries)
    .where(eq(seasonPlanEntries.season_id, seasonId));

  console.log(`✅ ${entries.length} Plan-Einträge geladen\n`);

  // Build GroupAssignment objects (same logic as the API route)
  const groupMap = new Map<string, GroupAssignment>();

  for (const entry of entries) {
    const gid = entry.group_id || entry.id;
    const memberIds = (entry.expected_participants as string[]) || [];

    if (groupMap.has(gid)) {
      groupMap.get(gid)!.memberIds.push(...memberIds);
    } else {
      // Resolve trainer name
      const startTime = entry.start_time?.substring(0, 5) || '00:00';
      const endTime = entry.end_time?.substring(0, 5) || '00:00';

      groupMap.set(gid, {
        groupId: gid,
        groupName: gid.substring(0, 12) + '...',
        trainerId: entry.trainer_id,
        trainerName: `Trainer (${entry.trainer_id.substring(0, 8)})`,
        dayOfWeek: entry.day_of_week as GroupAssignment['dayOfWeek'],
        startTime,
        endTime,
        courtId: entry.court_id,
        courtName: entry.court_id ? `Court (${entry.court_id.substring(0, 8)})` : null,
        memberIds,
        memberDetails: [],
        waitlistIds: [],
        waitlistDetails: [],
        warnings: [],
        conflictIds: [],
      });
    }
  }

  const assignments: GroupAssignment[] = [...groupMap.values()];

  console.log('📋 Gruppenzuordnungen für die Konfliktprüfung:');
  for (const a of assignments) {
    console.log(
      `  ${a.groupName} | Trainer: ${a.trainerId.substring(0, 8)}... | Tag ${a.dayOfWeek} | ${a.startTime}-${a.endTime} | ${a.memberIds.length} Mitglieder`
    );
  }

  // ─── Konfliktprüfung ───────────────────────────────
  console.log('\n🔍 Starte Konfliktprüfung...');
  const detector = new ConflictDetector(seasonId, clubId);

  const conflicts = await detector.detectAll(assignments);
  const summary = detector.summarize(conflicts);

  // ─── Ergebnisse ausgeben ────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('📊 KONFLIKTPRÜFUNG - ERGEBNIS');
  console.log('='.repeat(60));
  console.log(`  Gesamt:   ${summary.total}`);
  console.log(`  🔴 Kritisch: ${summary.critical}`);
  console.log(`  🟡 Warnung:  ${summary.warnings}`);
  console.log(`  🔵 Hinweis:  ${summary.info}`);
  console.log('');

  if (conflicts.length === 0) {
    console.log('✅ Keine Konflikte gefunden!');
  }

  // Nach Schweregrad gruppiert ausgeben
  const critical = conflicts.filter((c) => c.severity === 'critical');
  const warnings = conflicts.filter((c) => c.severity === 'warning');
  const infos = conflicts.filter((c) => c.severity === 'info');

  if (critical.length > 0) {
    console.log('🔴 KRITISCHE KONFLIKTE:');
    for (const c of critical) {
      console.log(`  [${c.type}] ${c.description}`);
      if (c.suggestedResolution) console.log(`    💡 ${c.suggestedResolution}`);
      console.log('');
    }
  }

  if (warnings.length > 0) {
    console.log('🟡 WARNUNGEN:');
    for (const c of warnings) {
      console.log(`  [${c.type}] ${c.description}`);
      if (c.suggestedResolution) console.log(`    💡 ${c.suggestedResolution}`);
      console.log('');
    }
  }

  if (infos.length > 0) {
    console.log('🔵 HINWEISE:');
    for (const c of infos) {
      console.log(`  [${c.type}] ${c.description}`);
      if (c.suggestedResolution) console.log(`    💡 ${c.suggestedResolution}`);
      console.log('');
    }
  }

  // Prüfung: Kann der Plan bestätigt werden?
  const canConfirm = detector.canConfirm(conflicts);
  console.log('='.repeat(60));
  if (canConfirm) {
    console.log('✅ Plan kann bestätigt werden (keine kritischen Konflikte)');
  } else {
    console.log(
      `❌ Plan kann NICHT bestätigt werden (${critical.length} kritische Konflikte offen)`
    );
  }

  // In DB persistieren
  console.log('\n💾 Persistiere Konflikte in der DB...');
  const saved = await detector.persistConflicts(conflicts);
  console.log(`✅ ${saved} Konflikte in der DB gespeichert`);

  console.log('\n🎉 KONFLIKTPRÜFUNG ABGESCHLOSSEN!');
}

main().catch((err) => {
  console.error('❌ Fehler:', err.message);
  console.error(err.stack?.substring(0, 500));
  process.exit(1);
});
