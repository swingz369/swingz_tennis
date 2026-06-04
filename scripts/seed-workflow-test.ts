/**
 * Seed script for E2E workflow testing
 *
 * Creates: 1 Beitragskategorie, 3 Mitglieder (2 aktiv + 1 ausstehend), 1 Saison
 * Usage: npx tsx scripts/seed-workflow-test.ts
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createServiceClient } from '@/lib/supabase/service';

dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL!.split('?')[0];
const supabaseAdmin = createServiceClient();
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const TEST_PASSWORD = 'Test1234!';

async function seed() {
  const client = await pool.connect();

  try {
    // ── 1. Find existing club ──────────────────────────────────────────
    const clubsRes = await client.query('SELECT id, name FROM clubs ORDER BY created_at LIMIT 1');
    if (clubsRes.rows.length === 0) {
      console.error('❌ No club found. Run seed-full.ts first to create a club.');
      return;
    }
    const club = clubsRes.rows[0];
    const clubId: string = club.id;
    console.log(`🏟️  Using club: ${club.name} (${clubId})`);

    // ── 1b. Ensure admin user has 'admin' role ──────────────────────
    const {
      data: { users: adminUsers },
    } = await supabaseAdmin.auth.admin.listUsers({ email: 'admin@swingz.com' });
    if (adminUsers && adminUsers.length > 0) {
      const adminUserId = adminUsers[0].id;
      const { rows: adminMembership } = await client.query(
        'SELECT role FROM user_club_memberships WHERE user_id = $1 AND club_id = $2',
        [adminUserId, clubId]
      );
      if (adminMembership.length > 0 && adminMembership[0].role !== 'admin') {
        await client.query(
          "UPDATE user_club_memberships SET role = 'admin' WHERE user_id = $1 AND club_id = $2",
          [adminUserId, clubId]
        );
        console.log(`🔑 Fixed admin role: ${adminMembership[0].role} → admin`);
      } else if (adminMembership.length > 0) {
        console.log('🔑 Admin role verified: admin ✓');
      }
    }

    // ── 2. Fee Configuration (Beitragskategorie) ───────────────────────
    const existingFee = await client.query(
      'SELECT id FROM fee_configurations WHERE club_id = $1 AND name = $2',
      [clubId, 'Jahresmitgliedschaft Erwachsene']
    );
    if (existingFee.rows.length === 0) {
      await client.query(
        `INSERT INTO fee_configurations (club_id, name, type, amount, billing_cycle, is_active)
         VALUES ($1, $2, 'membership', 240.00, 'yearly', true)`,
        [clubId, 'Jahresmitgliedschaft Erwachsene']
      );
      console.log('💳 Created fee config: Jahresmitgliedschaft Erwachsene (€240/Jahr)');
    } else {
      console.log('💳 Fee config already exists, skipping');
    }

    // Also add a training fee
    const existingTrainingFee = await client.query(
      'SELECT id FROM fee_configurations WHERE club_id = $1 AND name = $2',
      [clubId, 'Training Einzelstunde']
    );
    if (existingTrainingFee.rows.length === 0) {
      await client.query(
        `INSERT INTO fee_configurations (club_id, name, type, amount, billing_cycle, is_active)
         VALUES ($1, $2, 'training', 25.00, 'one_time', true)`,
        [clubId, 'Training Einzelstunde']
      );
      console.log('💳 Created fee config: Training Einzelstunde (€25/Einheit)');
    }

    // ── 3. Members (2 aktiv + 1 ausstehend) ────────────────────────────
    const members = [
      { email: 'anna.mueller@swingz-verein.de', name: 'Anna Müller', active: true },
      { email: 'ben.schmidt@swingz-verein.de', name: 'Ben Schmidt', active: true },
      { email: 'clara.fischer@swingz-verein.de', name: 'Clara Fischer', active: false },
    ];

    for (const m of members) {
      // Check if auth user exists
      const {
        data: { users },
      } = await supabaseAdmin.auth.admin.listUsers({ email: m.email });
      let userId: string;

      if (users && users.length > 0) {
        userId = users[0].id;
        console.log(`👤 User ${m.email} already exists (${userId.slice(0, 8)}…)`);
      } else {
        const {
          data: { user },
        } = await supabaseAdmin.auth.admin.createUser({
          email: m.email,
          password: TEST_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: m.name },
        });
        if (!user) throw new Error(`Failed to create user ${m.email}`);
        userId = user.id;
        console.log(`👤 Created user: ${m.name} <${m.email}> (${userId.slice(0, 8)}…)`);
      }

      // Upsert users table entry
      await client.query(
        `INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name`,
        [userId, m.email, m.name]
      );

      if (m.active) {
        // Active membership
        const existingMembership = await client.query(
          'SELECT id FROM user_club_memberships WHERE user_id = $1 AND club_id = $2',
          [userId, clubId]
        );
        if (existingMembership.rows.length === 0) {
          await client.query(
            `INSERT INTO user_club_memberships (user_id, club_id, role, is_active, joined_at)
             VALUES ($1, $2, 'member', true, NOW())`,
            [userId, clubId]
          );
          console.log(`  ✅ Active membership created for ${m.name}`);
        } else {
          console.log(`  ✅ Membership already exists for ${m.name}`);
        }
      } else {
        // Pending registration request (ausstehende Genehmigung)
        const existingRequest = await client.query(
          "SELECT id FROM registration_requests WHERE email = $1 AND club_id = $2 AND status = 'pending'",
          [m.email, clubId]
        );
        if (existingRequest.rows.length === 0) {
          await client.query(
            `INSERT INTO registration_requests (club_id, first_name, last_name, email, phone, playing_level, status, wants_trial_training)
             VALUES ($1, 'Clara', 'Fischer', $2, '+49 170 1234567', 'intermediate', 'pending', true)`,
            [clubId, m.email]
          );
          console.log(`  ⏳ Pending registration request created for ${m.name}`);
        } else {
          console.log(`  ⏳ Registration request already exists for ${m.name}`);
        }
      }
    }

    // ── 4. Season (Saisonplanung) ──────────────────────────────────────
    const seasonName = 'Sommer 2026';
    const existingSeason = await client.query(
      'SELECT id FROM seasons WHERE club_id = $1 AND name = $2',
      [clubId, seasonName]
    );
    let seasonId: string;

    if (existingSeason.rows.length === 0) {
      const seasonRes = await client.query(
        `INSERT INTO seasons (club_id, name, season_type, year, start_date, end_date, planning_status, is_active, description)
         VALUES ($1, $2, 'summer', 2026, '2026-04-01', '2026-09-30', 'draft', true, 'Test-Saison für E2E-Workflow-Tests')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [clubId, seasonName]
      );
      if (seasonRes.rows.length > 0) {
        seasonId = seasonRes.rows[0].id;
        console.log(`📅 Created season: ${seasonName} (${seasonId.slice(0, 8)}…)`);
      } else {
        // ON CONFLICT DO NOTHING → re-fetch by unique constraint (club_id, season_type, year)
        const refetch = await client.query(
          "SELECT id, name FROM seasons WHERE club_id = $1 AND season_type = 'summer' AND year = 2026 LIMIT 1",
          [clubId]
        );
        if (refetch.rows.length === 0) {
          throw new Error('Season should exist after ON CONFLICT — something went wrong');
        }
        seasonId = refetch.rows[0].id;
        console.log(`📅 Season already exists: ${refetch.rows[0].name} (${seasonId.slice(0, 8)}…)`);
      }
    } else {
      seasonId = existingSeason.rows[0].id;
      console.log(`📅 Season ${seasonName} already exists (${seasonId.slice(0, 8)}…)`);
    }

    // ── 5. Season Plan Entry (Stundenplan-Eintrag) ──────────────────
    const existingEntry = await client.query(
      'SELECT id FROM season_plan_entries WHERE season_id = $1 LIMIT 1',
      [seasonId]
    );
    if (existingEntry.rows.length === 0) {
      // Find a trainer and court for this club
      const trainerRes = await client.query(
        `SELECT ucm.user_id FROM user_club_memberships ucm
         WHERE ucm.club_id = $1 AND ucm.role = 'trainer' AND ucm.is_active = true LIMIT 1`,
        [clubId]
      );
      const courtRes = await client.query(
        'SELECT id FROM courts WHERE club_id = $1 AND is_active = true LIMIT 1',
        [clubId]
      );

      if (trainerRes.rows.length > 0 && courtRes.rows.length > 0) {
        const trainerId = trainerRes.rows[0].user_id;
        const courtId = courtRes.rows[0].id;

        // We need a trainers-table id (not user_id). Try to find it.
        const trainerRowRes = await client.query(
          'SELECT id FROM trainers WHERE user_id = $1 LIMIT 1',
          [trainerId]
        );
        const trainerTableId = trainerRowRes.rows.length > 0 ? trainerRowRes.rows[0].id : trainerId;

        await client.query(
          `INSERT INTO season_plan_entries
             (season_id, club_id, trainer_id, court_id, day_of_week, start_time, end_time, duration_minutes, entry_type, planning_source, max_participants, status)
           VALUES ($1, $2, $3, $4, 3, '10:00:00', '11:30:00', 90, 'training', 'manual', 8, 'planned')`,
          [seasonId, clubId, trainerTableId, courtId]
        );
        console.log('📋 Created plan entry: Mittwoch 10:00–11:30 (Training)');
      } else {
        console.log('⚠️  No trainer or court found — skipping plan entry');
      }
    } else {
      console.log('📋 Plan entry already exists, skipping');
    }

    // ── Summary ────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════');
    console.log('✅ Seed completed! Test data summary:');
    console.log('═══════════════════════════════════════════════');
    console.log(`  🏟️  Club: ${club.name}`);
    console.log(`  💳 Fee configs: Jahresmitgliedschaft (€240), Einzelstunde (€25)`);
    console.log(`  👤 Active members: Anna Müller, Ben Schmidt`);
    console.log(`  ⏳ Pending approval: Clara Fischer`);
    console.log(`  📅 Season: ${seasonName} (draft)`);
    console.log(`\n  🔑 Login credentials for pending member:`);
    console.log(`     Email: clara.fischer@swingz-verein.de`);
    console.log(`     Password: ${TEST_PASSWORD}`);
    console.log('\n  Test the workflow:');
    console.log('  1. Login as admin → Dashboard should show "1 ausstehende Genehmigung"');
    console.log(
      '  2. Go to Genehmigungen → Approve Clara Fischer (clara.fischer@swingz-verein.de)'
    );
    console.log('  3. Check Billing → Should auto-create invoice (if fee config exists)');
    console.log('  4. Go to Saisonplanung → Plan Sommer 2026');
    console.log('  5. After planning → "Rechnungen generieren" button');
    console.log('═══════════════════════════════════════════════\n');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
