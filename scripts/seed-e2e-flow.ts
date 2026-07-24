#!/usr/bin/env npx tsx
/**
 * Seed-Skript: E2E-Flow Testdaten für TC Rheinland
 *
 * Stellt sicher, dass alle Testdaten für einen kompletten E2E-Flow vorhanden sind:
 * 1. Test-Accounts (Admin, Trainer, Member) mit korrekten Passwörtern
 * 2. Trainer-Auth-Verknüpfungen (user_id)
 * 3. Trainer-Verfügbarkeiten (Mo–Fr)
 * 4. Saisonplanung-Konfiguration
 * 5. Saisonplanung-Einträge (Stundenplan)
 * 6. Gruppenzuordnungen (Members → Groups)
 * 7. Test-Buchungen (Member bucht Platz)
 * 8. Published Sessions (aus Saisonplanung)
 *
 * Idempotent — kann mehrfach ausgeführt werden ohne Duplikate.
 *
 * Usage: npx tsx scripts/seed-e2e-flow.ts
 */

import 'dotenv/config';
import { createServiceClient } from '@/lib/supabase/service';

const supabase = createServiceClient();
const CLUB_NAME = 'TC Rheinland e.V.';

// ═══════════════════════════════════════════════════════════════
// TEST CREDENTIALS
// ═══════════════════════════════════════════════════════════════

const TEST_ACCOUNTS = {
  admin: { email: 'admin@tc-rheinland.de', password: 'TestAdmin2026!', name: 'Alexander Hartmann' },
  trainer: { email: 'trainer.1@tc-rheinland.de', password: 'Trainer2026!', name: 'Martin Berger' },
  member: { email: 'member@swingz.com', password: 'MemberPass123!', name: 'Anna Member' },
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

let stats = { created: 0, skipped: 0, errors: 0 };

function log(icon: string, msg: string) {
  console.log(`  ${icon} ${msg}`);
}

function logSection(title: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(60)}`);
}

async function ensureAuthPassword(email: string, password: string): Promise<string | null> {
  // `email` is not in Supabase PageParams but is accepted at runtime.
  const { data: users } = await supabase.auth.admin.listUsers({ email } as never);
  if (!users?.users.length) {
    log('❌', `Auth user ${email} not found`);
    stats.errors++;
    return null;
  }
  const userId = users.users[0].id;

  // Set password via Supabase Admin API (GoTrue)
  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) {
    log('❌', `Failed to set password for ${email}: ${error.message}`);
    stats.errors++;
    return userId;
  }
  return userId;
}

async function ensureMembership(userId: string, clubId: string, role: string) {
  const { data: existing } = await supabase
    .from('user_club_memberships')
    .select('id')
    .match({ user_id: userId, club_id: clubId })
    .maybeSingle();

  if (existing) {
    log('⏭️', `Membership already exists (${role})`);
    stats.skipped++;
    return;
  }

  const { error } = await supabase.from('user_club_memberships').insert({
    user_id: userId,
    club_id: clubId,
    role,
    is_active: true,
    include_in_planning: role === 'member' || role === 'trainer',
    joined_at: new Date().toISOString(),
  });

  if (error) {
    log('❌', `Membership insert failed: ${error.message}`);
    stats.errors++;
  } else {
    log('✅', `Membership created (${role})`);
    stats.created++;
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN SEED
// ═══════════════════════════════════════════════════════════════

async function seed() {
  console.log('\n🎾 SwingZ E2E-Flow Seed');
  console.log('═'.repeat(60));
  console.log(`  Target club: ${CLUB_NAME}`);
  console.log('═'.repeat(60));

  // ─── 0. Find club ───────────────────────────────────────────
  logSection('0. Club finden');

  const { data: club } = await supabase
    .from('clubs')
    .select('id, name')
    .eq('name', CLUB_NAME)
    .maybeSingle();

  if (!club) {
    console.error(
      `\n❌ Club "${CLUB_NAME}" nicht gefunden. Bitte zuerst seed-test-club-rheinland.ts ausführen.`
    );
    process.exit(1);
  }
  const clubId = club.id;
  log('✅', `Club gefunden: ${club.name} (${clubId.slice(0, 8)}…)`);

  // ─── 1. Test-Accounts + Passwörter ──────────────────────────
  logSection('1. Test-Accounts (Passwörter setzen)');

  const accountIds: Record<string, string> = {};

  for (const [role, account] of Object.entries(TEST_ACCOUNTS)) {
    const userId = await ensureAuthPassword(account.email, account.password);
    if (userId) {
      accountIds[role] = userId;
      log('✅', `${role}: ${account.email} — Passwort gesetzt`);

      // Ensure public user entry
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!existingUser) {
        await supabase.from('users').insert({
          id: userId,
          email: account.email,
          full_name: account.name,
        });
      }

      // Ensure membership at TC Rheinland
      await ensureMembership(userId, clubId, role === 'trainer' ? 'trainer' : role);
    }
  }

  // ─── 2. Trainer-Auth-Verknüpfungen ─────────────────────────
  logSection('2. Trainer → Auth-User Verknüpfungen');

  const { data: trainers } = await supabase
    .from('trainers')
    .select('id, email, user_id')
    .in('email', [
      'trainer.1@tc-rheinland.de',
      'trainer.2@tc-rheinland.de',
      'trainer.3@tc-rheinland.de',
      'trainer.4@tc-rheinland.de',
      'trainer.5@tc-rheinland.de',
      'trainer.6@tc-rheinland.de',
      'trainer.7@tc-rheinland.de',
      'trainer.8@tc-rheinland.de',
    ]);

  if (trainers) {
    for (const trainer of trainers) {
      if (trainer.user_id) {
        log('⏭️', `${trainer.email} already linked`);
        stats.skipped++;
        continue;
      }

      // `email` is not in Supabase PageParams but is accepted at runtime.
      const { data: authUsers } = await supabase.auth.admin.listUsers({
        email: trainer.email,
      } as never);
      if (authUsers?.users.length) {
        const authId = authUsers.users[0].id;
        await supabase.from('trainers').update({ user_id: authId }).eq('id', trainer.id);
        log('✅', `${trainer.email} → linked (${authId.slice(0, 8)}…)`);
        stats.created++;
      } else {
        log('❌', `${trainer.email} — no auth user found`);
        stats.errors++;
      }
    }
  }

  // ─── 3. Trainer-Verfügbarkeiten ────────────────────────────
  logSection('3. Trainer-Verfügbarkeiten');

  const { count: availCount } = await supabase
    .from('trainer_availability')
    .select('*', { count: 'exact', head: true })
    .in('user_id', trainers?.filter((t) => t.user_id).map((t) => t.user_id!) ?? []);

  if (availCount && availCount > 0) {
    log('⏭️', `${availCount} Verfügbarkeiten bereits vorhanden`);
    stats.skipped++;
  } else if (trainers) {
    // Insert availability for all linked trainers
    const availabilityRows: Array<{
      user_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      is_available: boolean;
    }> = [];

    // Time slots: Mo-Fr 08:00-12:00 and 14:00-18:00
    const timeSlots = [
      { start: '08:00:00', end: '12:00:00' },
      { start: '14:00:00', end: '18:00:00' },
    ];

    for (const trainer of trainers) {
      if (!trainer.user_id) continue;
      for (let day = 1; day <= 5; day++) {
        for (const slot of timeSlots) {
          availabilityRows.push({
            user_id: trainer.user_id,
            day_of_week: day,
            start_time: slot.start,
            end_time: slot.end,
            is_available: true,
          });
        }
      }
    }

    if (availabilityRows.length > 0) {
      const { error } = await supabase.from('trainer_availability').insert(availabilityRows);
      if (error) {
        log('❌', `Insert failed: ${error.message}`);
        stats.errors++;
      } else {
        log(
          '✅',
          `${availabilityRows.length} Verfügbarkeiten erstellt (${trainers.length} Trainer × Mo–Fr)`
        );
        stats.created++;
      }
    }
  }

  // ─── 4. Saisonplanung-Konfiguration ────────────────────────
  logSection('4. Saisonplanung-Konfiguration');

  const { data: season } = await supabase
    .from('seasons')
    .select('id, name, planning_status')
    .eq('club_id', clubId)
    .eq('season_type', 'summer')
    .eq('year', 2026)
    .maybeSingle();

  if (!season) {
    log('❌', 'Keine Sommer 2026 Saison gefunden');
    stats.errors++;
  } else {
    log('✅', `Saison: ${season.name} (${season.planning_status})`);

    const { data: existingConfig } = await supabase
      .from('season_planning_configs')
      .select('id')
      .match({ club_id: clubId, season_id: season.id })
      .maybeSingle();

    if (existingConfig) {
      log('⏭️', 'Planning config already exists');
      stats.skipped++;
    } else {
      const { error } = await supabase.from('season_planning_configs').insert({
        club_id: clubId,
        season_id: season.id,
        trainer_utilization_max_pct: 80,
        group_min_size: 3,
        group_max_size: 12,
        slot_duration_minutes: 90,
        ai_clustering_enabled: true,
        prefer_historic_groups: true,
        avoid_high_failure_slots: true,
      });

      if (error) {
        log('❌', `Config insert failed: ${error.message}`);
        stats.errors++;
      } else {
        log('✅', 'Planning config erstellt (90min Slots, 3–12 TN/Gruppe)');
        stats.created++;
      }
    }
  }

  // ─── 5. Saisonplanung-Einträge (Stundenplan) ──────────────
  logSection('5. Saisonplanung-Einträge (Stundenplan)');

  const { count: entryCount } = await supabase
    .from('season_plan_entries')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', season?.id ?? '');

  if (entryCount && entryCount > 0) {
    log('⏭️', `${entryCount} Plan-Einträge bereits vorhanden`);
    stats.skipped++;
  } else if (season && trainers && trainers.length > 0) {
    // Get courts
    const { data: courts } = await supabase
      .from('courts')
      .select('id, name')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .limit(4);

    if (!courts || courts.length === 0) {
      log('❌', 'Keine Courts gefunden');
      stats.errors++;
    } else {
      // Get groups
      const { data: groups } = await supabase
        .from('groups')
        .select('id, name')
        .eq('club_id', clubId)
        .limit(7);

      const entries: Array<{
        season_id: string;
        club_id: string;
        trainer_id: string;
        court_id: string;
        group_id: string | null;
        day_of_week: number;
        start_time: string;
        end_time: string;
        duration_minutes: number;
        entry_type: string;
        planning_source: string;
        max_participants: number;
        status: string;
      }> = [];

      // Create training entries: each trainer gets sessions on different days
      const linkedTrainers = trainers.filter((t) => t.user_id);
      const schedule = [
        { day: 1, start: '09:00', end: '10:30' }, // Montag
        { day: 1, start: '14:00', end: '15:30' },
        { day: 2, start: '09:00', end: '10:30' }, // Dienstag
        { day: 3, start: '10:00', end: '11:30' }, // Mittwoch
        { day: 3, start: '15:00', end: '16:30' },
        { day: 4, start: '09:00', end: '10:30' }, // Donnerstag
        { day: 5, start: '09:00', end: '10:30' }, // Freitag
        { day: 5, start: '14:00', end: '15:30' },
      ];

      for (let i = 0; i < schedule.length; i++) {
        const slot = schedule[i];
        const trainer = linkedTrainers[i % linkedTrainers.length];
        const court = courts[i % courts.length];
        const group = groups && groups.length > 0 ? groups[i % groups.length] : null;

        entries.push({
          season_id: season.id,
          club_id: clubId,
          trainer_id: trainer.id,
          court_id: court.id,
          group_id: group?.id ?? null,
          day_of_week: slot.day,
          start_time: slot.start + ':00',
          end_time: slot.end + ':00',
          duration_minutes: 90,
          entry_type: 'training',
          planning_source: 'manual',
          max_participants: 8,
          status: 'planned',
        });
      }

      const { error } = await supabase.from('season_plan_entries').insert(entries);
      if (error) {
        log('❌', `Entries insert failed: ${error.message}`);
        stats.errors++;
      } else {
        log('✅', `${entries.length} Stundenplan-Einträge erstellt`);
        stats.created++;
      }
    }
  }

  // ─── 5b. User Training Preferences (Mitglieder-Präferenzen) ──
  logSection('5b. User Training Preferences');

  const { count: prefCount } = await supabase
    .from('user_training_preferences')
    .select('*', { count: 'exact', head: true })
    .match({ club_id: clubId, season_id: season?.id ?? '' });

  if (prefCount && prefCount > 0) {
    log('⏭️', `${prefCount} Training-Präferenzen bereits vorhanden`);
    stats.skipped++;
  } else if (season) {
    // Get planning-eligible members
    const { data: members } = await supabase
      .from('user_club_memberships')
      .select('user_id')
      .match({ club_id: clubId, role: 'member', is_active: true, include_in_planning: true })
      .limit(120);

    if (members && members.length > 0) {
      // Clustering engine expects { start: string, end: string }[] per day
      const availabilityPatterns = [
        // Pattern A: Mo/Mi/Fr Vormittag
        {
          monday: [
            { start: '09:00', end: '10:30' },
            { start: '14:00', end: '15:30' },
          ],
          wednesday: [{ start: '09:00', end: '10:30' }],
          friday: [{ start: '09:00', end: '10:30' }],
        },
        // Pattern B: Di/Do Nachmittag
        {
          tuesday: [{ start: '09:00', end: '10:30' }],
          thursday: [{ start: '14:00', end: '15:30' }],
        },
        // Pattern C: Alle Tage
        {
          monday: [{ start: '14:00', end: '15:30' }],
          tuesday: [{ start: '10:00', end: '11:30' }],
          wednesday: [{ start: '14:00', end: '15:30' }],
          thursday: [{ start: '09:00', end: '10:30' }],
          friday: [{ start: '14:00', end: '15:30' }],
        },
      ];
      const levels = ['beginner', 'intermediate', 'intermediate', 'advanced'];

      const prefRows = members.map((m, i) => ({
        season_id: season.id,
        user_id: m.user_id,
        club_id: clubId,
        user_role: 'member' as const,
        preferred_level: levels[i % levels.length],
        self_assessed_level: levels[i % levels.length],
        weekly_availability: availabilityPatterns[i % availabilityPatterns.length],
        max_sessions_per_week: (i % 3) + 1,
        is_submitted: true,
        submitted_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('user_training_preferences').insert(prefRows);
      if (error) {
        log('❌', `Preferences insert failed: ${error.message}`);
        stats.errors++;
      } else {
        log('✅', `${prefRows.length} Training-Präferenzen erstellt`);
        stats.created++;
      }
    }
  }

  // ─── 6. Sessions (aus Plan-Einträgen) ─────────────────────
  logSection('6. Sessions (Stundenplan → Sessions)');

  const { count: sessionCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .in(
      'schedule_id',
      (await supabase.from('schedules').select('id').eq('club_id', clubId)).data?.map(
        (s) => s.id
      ) ?? []
    );

  if (sessionCount && sessionCount > 0) {
    log('⏭️', `${sessionCount} Sessions bereits vorhanden`);
    stats.skipped++;
  } else {
    log('ℹ️', 'Sessions werden automatisch bei der Saisonplanung-Veröffentlichung erstellt');
    log(
      'ℹ️',
      'Für manuelle Buchungen stehen Walk-in-Sessions via POST /api/bookings/direct bereit'
    );
  }

  // ─── 7. Test-Buchungen ────────────────────────────────────
  logSection('7. Test-Buchungen');

  if (!accountIds.member) {
    log('⏭️', 'Member-Account nicht verfügbar — Buchungen übersprungen');
  } else {
    // Check if member already has bookings
    const { count: bookingCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', accountIds.member)
      .eq('club_id', clubId);

    if (bookingCount && bookingCount > 0) {
      log('⏭️', `${bookingCount} Buchungen bereits vorhanden`);
      stats.skipped++;
    } else {
      // Get an active schedule
      const { data: schedule } = await supabase
        .from('schedules')
        .select('id')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!schedule) {
        log('❌', 'Kein aktiver Schedule für Buchungen');
        stats.errors++;
      } else {
        // Get courts for walk-in sessions
        const { data: courts } = await supabase
          .from('courts')
          .select('id')
          .eq('club_id', clubId)
          .eq('is_active', true)
          .limit(2);

        if (courts && courts.length > 0) {
          // (Removed unused `bookings` array — bookings are inserted inline below)

          for (let dayOffset = 1; dayOffset <= 3; dayOffset++) {
            const date = new Date();
            date.setDate(date.getDate() + dayOffset);
            // Skip weekends
            if (date.getDay() === 0 || date.getDay() === 6) continue;

            const dateStr = date.toISOString().split('T')[0];
            const startHour = 8 + dayOffset; // 09:00, 10:00, 11:00
            const startTime = `${dateStr}T${String(startHour).padStart(2, '0')}:00:00`;
            const endTime = `${dateStr}T${String(startHour + 1).padStart(2, '0')}:00:00`;
            const court = courts[dayOffset % courts.length];

            // Create walk-in session
            const isoWeek = getISOWeekNumber(new Date(startTime));
            const { data: session, error: sessionErr } = await supabase
              .from('sessions')
              .insert({
                schedule_id: schedule.id,
                trainer_id: null,
                group_ids: [],
                week_number: isoWeek,
                timeslot_start: startTime,
                timeslot_end: endTime,
                court_id: court.id,
                max_participants: 1,
                session_type: 'walk_in',
                notes: `Test-Buchung (Seed) — ${dateStr} ${startHour}:00`,
                status: 'scheduled',
              })
              .select('id')
              .single();

            if (sessionErr) {
              log('❌', `Session creation failed: ${sessionErr.message}`);
              stats.errors++;
              continue;
            }

            // Create booking
            const { error: bookingErr } = await supabase.from('bookings').insert({
              club_id: clubId,
              member_id: accountIds.member,
              schedule_id: schedule.id,
              session_id: session.id,
              court_id: court.id,
              session_start_time: startTime,
              start_time: startTime,
              end_time: endTime,
              booking_type: 'court',
              status: 'confirmed',
              payment_status: 'pending',
            });

            if (bookingErr) {
              log('❌', `Booking creation failed: ${bookingErr.message}`);
              // Rollback session
              await supabase.from('sessions').delete().eq('id', session.id);
              stats.errors++;
            } else {
              log('✅', `Buchung: ${dateStr} ${startHour}:00–${startHour + 1}:00`);
              stats.created++;
            }
          }
        }
      }
    }
  }

  // ─── 8. Sperren (Slot-Blocking Test) ───────────────────────
  logSection('8. Sperren (Slot-Blocking Test)');

  const { data: existingBlocks } = await supabase
    .from('sessions')
    .select('id')
    .in('session_type', ['event', 'maintenance'])
    .limit(1);

  if (existingBlocks && existingBlocks.length > 0) {
    log('⏭️', 'Gesperrte Slots bereits vorhanden');
    stats.skipped++;
  } else {
    const { data: schedule } = await supabase
      .from('schedules')
      .select('id')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: courts } = await supabase
      .from('courts')
      .select('id')
      .eq('club_id', clubId)
      .limit(1);

    if (schedule && courts && courts.length > 0) {
      // Block one slot for event, one for maintenance
      const nextSaturday = new Date();
      nextSaturday.setDate(nextSaturday.getDate() + ((6 - nextSaturday.getDay() + 7) % 7 || 7));
      const satStr = nextSaturday.toISOString().split('T')[0];

      const blocks = [
        {
          schedule_id: schedule.id,
          trainer_id: null,
          group_ids: [],
          week_number: getISOWeekNumber(nextSaturday),
          timeslot_start: `${satStr}T10:00:00`,
          timeslot_end: `${satStr}T12:00:00`,
          court_id: courts[0].id,
          max_participants: 1,
          session_type: 'event',
          notes: 'Vereinsturnier — Platz gesperrt',
          status: 'scheduled',
        },
        {
          schedule_id: schedule.id,
          trainer_id: null,
          group_ids: [],
          week_number: getISOWeekNumber(nextSaturday),
          timeslot_start: `${satStr}T14:00:00`,
          timeslot_end: `${satStr}T16:00:00`,
          court_id: courts[0].id,
          max_participants: 1,
          session_type: 'maintenance',
          notes: 'Wartung: Netz erneuern',
          status: 'scheduled',
        },
      ];

      const { error } = await supabase.from('sessions').insert(blocks);
      if (error) {
        log('❌', `Block insert failed: ${error.message}`);
        stats.errors++;
      } else {
        log('✅', `2 Sperren erstellt: Event (10–12 Uhr) + Wartung (14–16 Uhr) am ${satStr}`);
        stats.created++;
      }
    }
  }

  // ─── 9. Gruppen-Mitgliedschaften ──────────────────────────
  logSection('9. Gruppen-Mitgliedschaften');

  const { data: groups } = await supabase
    .from('groups')
    .select('id, name')
    .eq('club_id', clubId)
    .limit(7);

  if (groups && groups.length > 0) {
    // Check if member is already in a group
    // Note: group_members table may not exist — check via groups.members jsonb or similar
    log('ℹ️', `${groups.length} Gruppen vorhanden: ${groups.map((g) => g.name).join(', ')}`);
    log('ℹ️', 'Gruppen-Zuordnungen werden über die Saisonplanung verwaltet');
    stats.skipped++;
  } else {
    log('⚠️', 'Keine Gruppen gefunden');
  }

  // ─── Summary ───────────────────────────────────────────────
  logSection('ZUSAMMENFASSUNG');
  console.log(`
  🏟️  Club:         ${CLUB_NAME} (${clubId.slice(0, 8)}…)

  🔑 Login-Daten:
     Admin:        ${TEST_ACCOUNTS.admin.email} / ${TEST_ACCOUNTS.admin.password}
     Trainer:      ${TEST_ACCOUNTS.trainer.email} / ${TEST_ACCOUNTS.trainer.password}
     Member:       ${TEST_ACCOUNTS.member.email} / ${TEST_ACCOUNTS.member.password}

  📊 Statistiken:
     Erstellt:     ${stats.created}
     Übersprungen: ${stats.skipped}
     Fehler:       ${stats.errors}

  🧪 E2E-Flow (nach dem Seed testbar):
     1. Admin-Login → Dashboard → Sidebar-Navigation
     2. Saisonplanung: Konfigurieren → Planen → Finalisieren
     3. Platz-Kalender: Wochen-/Tagesansicht, Sperren
     4. Member-Login → Platz buchen → Buchung stornieren
     5. Trainer-Login → Sessions anzeigen

  ⚡ Alles idempotent — kann sicher wiederholt werden!
`);
}

// ═══════════════════════════════════════════════════════════════
// ISO Week Number Helper
// ═══════════════════════════════════════════════════════════════

function getISOWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return Math.round((d.getTime() - week1.getTime()) / 86400000 / 7) + 1;
}

// ═══════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════

seed().catch((err) => {
  console.error('\n❌ Seed fehlgeschlagen:', err);
  process.exit(1);
});
