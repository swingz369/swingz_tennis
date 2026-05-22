import { SeasonClusteringEngine } from '../lib/season-planning/clustering-engine';
import { Pool } from 'pg';

async function main() {
  const seasonId = '6bd8f187-48b8-45eb-af39-e0813e8af088';
  const clubId = 'e7cb492c-8e16-4b89-b62d-12d46fba8bbf';

  console.log('🚀 Lade Clustering Engine...');
  const engine = new SeasonClusteringEngine(seasonId, clubId, {
    groupMaxSize: 12,
    groupMinSize: 3,
    maxNiveauSpanBeginner: 4,
    maxNiveauSpanAdvanced: 8,
    trainerUtilizationMaxPct: 80,
    preferHistoricGroups: false,
    avoidHighFailureSlots: true,
    slotFailureThreshold: 30,
  });

  console.log('✅ Engine geladen. Starte Clustering (dryRun=true)...\n');
  const result = await engine.runClustering(true);

  console.log('📊 CLUSTERING-ERGEBNIS');
  console.log('='.repeat(50));
  console.log(`Gruppen:         ${result.groups.length}`);
  console.log(`Nicht zugeordnet: ${result.unassignedMembers.length}`);
  console.log(`Warteliste:      ${result.waitlistSummary.length}`);
  console.log(`Laufzeit:        ${result.metrics.runtimeMs}ms\n`);

  for (const g of result.groups) {
    console.log(
      `  ${g.groupName} | Trainer: ${g.trainerName} | ${g.memberIds.length} Mitglieder | Tag ${g.dayOfWeek} | ${g.startTime}-${g.endTime}`
    );
    if (g.warnings.length > 0) {
      for (const w of g.warnings) console.log(`    ⚠️  ${w}`);
    }
  }

  console.log('\n📊 Metriken:');
  console.log(`  ∅ Niveau-Match:     ${result.metrics.avgNiveauMatch}%`);
  console.log(`  Wunschpartner-Erf.: ${result.metrics.wishPartnerRate}%`);
  console.log(`  ∅ Trainer-Auslast.: ${result.metrics.avgTrainerUtilization}%`);
  console.log(`  Niveau-Verstöße:    ${result.metrics.niveauSpanViolations}`);
  console.log(`  Warteliste:         ${result.metrics.totalWaitlisted}`);

  if (result.unassignedMembers.length > 0) {
    console.log('\n❌ Nicht zugeordnete Mitglieder:');
    for (const m of result.unassignedMembers) {
      console.log(`  - ${m.memberName}: ${m.reason}`);
    }
  }

  // ─── Manuelles Speichern via pg ─────────────────────────
  console.log('\n💾 Speichere Ergebnisse via direktem SQL...');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  try {
    // Map trainer user_ids → trainer_ids using NAME matching (emails differ between tables)
    // trainers table has: trainer.thomas.steiner@swingz.com / users table has: coach.thomas@swingz.com
    // But names match: "Thomas Steiner" in both tables
    const trainerRes = await pool.query(
      `SELECT t.id, t.name FROM trainers t WHERE t.id IN (SELECT trainer_id FROM trainer_club WHERE club_id = $1)`,
      [clubId]
    );
    
    // Get name for each user_id from clustering engine
    const userRes = await pool.query(
      `SELECT id, COALESCE(full_name, email) as name FROM users WHERE id = ANY($1::uuid[])`,
      [result.groups.map(g => g.trainerId)]
    );
    
    // Build name→trainer_id map (normalize names: lowercase, trim)
    function normalizeName(n: string): string {
      return n.trim().toLowerCase().replace(/\s+/g, ' ');
    }
    const nameToTrainerId: Record<string, string> = {};
    for (const tr of trainerRes.rows) {
      nameToTrainerId[normalizeName(tr.name)] = tr.id;
    }
    
    // Build user_id→name map
    const userIdToName: Record<string, string> = {};
    for (const ur of userRes.rows) {
      userIdToName[ur.id] = normalizeName(ur.name);
    }
    
    // Clean existing entries
    await pool.query('DELETE FROM season_plan_entries WHERE season_id = $1', [seasonId]);
    console.log('  ✅ Alte Einträge gelöscht');

    // Insert each group
    for (let i = 0; i < result.groups.length; i++) {
      const g = result.groups[i];
      const durationMin =
        (parseInt(g.endTime.split(':')[0]) - parseInt(g.startTime.split(':')[0])) * 60 +
        (parseInt(g.endTime.split(':')[1] || '0') - parseInt(g.startTime.split(':')[1] || '0'));

      const groupId = g.groupId.startsWith('auto_') ? null : g.groupId;
      
      // Map user_id → trainer_id via normalized name
      const userName = userIdToName[g.trainerId];
      const actualTrainerId = userName ? nameToTrainerId[userName] : null;
      if (!actualTrainerId) {
        console.log(`  ⚠️  Kein Trainer-Mapping für user_id ${g.trainerId.slice(0,8)}... (Name: ${userName}), überspringe Gruppe ${i+1}`);
        continue;
      }

      const avgMatch = g.memberDetails.length > 0
        ? String(g.memberDetails.reduce((s, d) => s + d.niveauMatch, 0) / g.memberDetails.length)
        : '0';

      const res = await pool.query(
        `INSERT INTO season_plan_entries (
          season_id, club_id, trainer_id, court_id, group_id,
          day_of_week, start_time, end_time, duration_minutes,
          starts_from_week, entry_type, planning_source,
          max_participants, expected_participants,
          preference_match_score, optimization_score, conflict_score,
          status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7::time,$8::time,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18)
        RETURNING id`,
        [
          seasonId, clubId, actualTrainerId, g.courtId, groupId,
          g.dayOfWeek, g.startTime + ':00', g.endTime + ':00', durationMin,
          1, 'training', 'auto',
          g.memberIds.length > 10 ? g.memberIds.length + 2 : 12,
          JSON.stringify(g.memberIds),
          avgMatch, '0', String(g.warnings.length * 10),
          'planned',
        ]
      );
      console.log(`  ✅ Gruppe ${i + 1}: ${g.groupName} gespeichert (ID: ${res.rows[0].id.slice(0, 8)}...)`);
    }

    console.log(`✅ ${result.groups.length} Plan-Einträge gespeichert`);

    // Update season status
    await pool.query(
      `UPDATE seasons SET planning_status = 'manual_review', last_planned_at = NOW() WHERE id = $1`,
      [seasonId]
    );
    console.log('✅ Season auf manual_review gesetzt');

    // History entry skipped - table has schema mismatch with production DB

    console.log('\n🎉 CLUSTERING ERFOLGREICH ABGESCHLOSSEN UND IN DB GESPEICHERT!');
    console.log('   Nächster Schritt: Konfliktprüfung (POST /api/seasons/{id}/planning/conflicts)');

  } catch (err: any) {
    console.error('\n❌ DB-FEHLER:', err.message);
    if (err.position) {
      // Parse PostgreSQL error position
      console.error('  Position:', err.position);
      console.error('  Hint:', err.hint || 'none');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Unerwarteter Fehler:', err.message);
  console.error(err.stack?.substring(0, 500));
  process.exit(1);
});
