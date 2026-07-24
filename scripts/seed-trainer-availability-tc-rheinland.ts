#!/usr/bin/env npx tsx
/**
 * Realistic Trainer-Availability-Seed für TC Rheinland e.V. (v3).
 *
 * Befüllt differenzierte Wochenprofile für die 8 Trainer in BEIDE
 * relevanten Tabellen:
 *   A. `trainer_availabilities` (PLURAL) – kanonische Live-Tabelle
 *   B. `user_training_preferences` (user_role='trainer') – aktiv vom
 *       Saisonplanungs-Algorithmus gelesen (siehe
 *       `app/api/clubs/[id]/planning-readiness/route.ts`)
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ WICHTIG – WARUM PLURAL in dieser DB?                                  │
 * │                                                                      │
 * │ Historisch war `trainer_availability` (singular) die primäre        │
 * │ Tabelle (Migration 20260506_trainer_availability.sql).               │
 * │ Schema-Consolidation (20260507) aliasiierte den Plural als VIEW.     │
 * │ Drop-Legacy (20260605) hat die Singular-Tabelle gedroppt.            │
 * │                                                                      │
 * │ Diagnose via scripts/_diag-availability.ts:                          │
 * │   trainer_availability  (singular) → 404 PGRST205                   │
 * │   trainer_availabilities (plural)   → 200 OK mit Row-Daten          │
 * │                                                                      │
 * │ Diese DB verwendet die Plural-Form als kanonische physische          │
 * │ Tabelle. supabase-types.ts / supabase-types.ts sind stale            │
 * │ (generiert aus dem ursprünglichen Singular-Schema). Daher:           │
 * │ `as any` Cast analog `app/api/clubs/[id]/planning-readiness/route.ts`│
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Day-of-week-Konvention: 0=Sonntag, 1=Montag, …, 6=Samstag
 * (consistent mit PG EXTRACT(DOW ...))
 *
 * Usage: npx tsx scripts/seed-trainer-availability-tc-rheinland.ts
 */
import 'dotenv/config';
import { createServiceClient } from '@/lib/supabase/service';

const CLUB_NAME = 'TC Rheinland e.V.';
const SEASON_TYPE = 'summer';
const SEASON_YEAR = 2026;

// ───────────────────────── Profile-Definition ─────────────────────────
type Slot = { start: string; end: string }; // Format: HH:MM

type TrainerProfile = {
  email: string;
  fullName: string;
  shortLabel: string;
  preferredLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredAgeGroup: 'junior' | 'senior' | 'both';
  maxSessionsPerWeek: number;
  schedule: Record<number, Slot[]>;
  notes: string;
};

// T1 — Head Coach (Vollzeit, Mo–Fr + Sa Vormittag)
const T1: TrainerProfile = {
  email: 'trainer.1@tc-rheinland.de',
  fullName: 'Christina Schmidt',
  shortLabel: 'Head Coach',
  preferredLevel: 'advanced',
  preferredAgeGroup: 'senior',
  maxSessionsPerWeek: 25,
  schedule: {
    1: [
      { start: '09:00', end: '12:00' },
      { start: '16:00', end: '21:00' },
    ],
    2: [
      { start: '09:00', end: '12:00' },
      { start: '16:00', end: '21:00' },
    ],
    3: [
      { start: '09:00', end: '12:00' },
      { start: '16:00', end: '21:00' },
    ],
    4: [
      { start: '09:00', end: '12:00' },
      { start: '16:00', end: '21:00' },
    ],
    5: [
      { start: '09:00', end: '12:00' },
      { start: '16:00', end: '21:00' },
    ],
    6: [{ start: '10:00', end: '14:00' }],
  },
  notes: 'Head Coach – Mannschaft, Leistung, Doppel. Wochenende eingeschränkt.',
};

// T2 — Jugend-Cheftrainer (Nachmittags + Wochenende für Kids/Jugend)
const T2: TrainerProfile = {
  email: 'trainer.2@tc-rheinland.de',
  fullName: 'Benjamin Schneider',
  shortLabel: 'Jugend-Cheftrainer',
  preferredLevel: 'beginner',
  preferredAgeGroup: 'junior',
  maxSessionsPerWeek: 20,
  schedule: {
    1: [{ start: '14:00', end: '19:00' }],
    2: [{ start: '14:00', end: '19:00' }],
    3: [{ start: '14:00', end: '19:00' }],
    4: [{ start: '14:00', end: '19:00' }],
    5: [{ start: '14:00', end: '19:00' }],
    6: [{ start: '09:00', end: '13:00' }],
    0: [{ start: '10:00', end: '12:00' }], // gelegentliche Camps
  },
  notes: 'Kids & Jugend – Schnupperkurse, Mannschaftstraining U12/U18.',
};

// T3 — Leistungstrainerin (Teilzeit, Mi+Fr+Sa)
const T3: TrainerProfile = {
  email: 'trainer.3@tc-rheinland.de',
  fullName: 'Eva Fischer',
  shortLabel: 'Leistungstrainerin (B-Lizenz)',
  preferredLevel: 'advanced',
  preferredAgeGroup: 'both',
  maxSessionsPerWeek: 12,
  schedule: {
    3: [{ start: '16:00', end: '21:00' }],
    5: [{ start: '16:00', end: '21:00' }],
    6: [{ start: '09:00', end: '14:00' }],
  },
  notes: 'Kader-Training Damen + Junioren – Match-Simulation, Taktik.',
};

// T4 — Senioren-Trainer (Vormittag Mo–Do)
const T4: TrainerProfile = {
  email: 'trainer.4@tc-rheinland.de',
  fullName: 'Daniel Weber',
  shortLabel: 'Senioren-Trainer',
  preferredLevel: 'beginner',
  preferredAgeGroup: 'senior',
  maxSessionsPerWeek: 10,
  schedule: {
    1: [{ start: '08:00', end: '12:00' }],
    2: [{ start: '08:00', end: '12:00' }],
    3: [{ start: '08:00', end: '12:00' }],
    4: [{ start: '08:00', end: '12:00' }],
  },
  notes: 'Hobbyspieler 60+, Senioren-Mannschaft H50/H70. Vormittags.',
};

// T5 — Berufstätige Lehrerin / Feierabend-Coach
const T5: TrainerProfile = {
  email: 'trainer.5@tc-rheinland.de',
  fullName: 'Jana Meyer',
  shortLabel: 'Feierabend-Trainerin',
  preferredLevel: 'intermediate',
  preferredAgeGroup: 'senior',
  maxSessionsPerWeek: 12,
  schedule: {
    1: [{ start: '17:00', end: '21:00' }],
    3: [{ start: '17:00', end: '21:00' }],
    5: [{ start: '17:00', end: '21:00' }],
  },
  notes: 'Hobbyspieler Damen 30+, Mixed-Gruppen. Berufstätig.',
};

// T6 — Student (Aushilfe, wenige Nachmittage)
const T6: TrainerProfile = {
  email: 'trainer.6@tc-rheinland.de',
  fullName: 'Fabian Wagner',
  shortLabel: 'Student (Aushilfe)',
  preferredLevel: 'beginner',
  preferredAgeGroup: 'junior',
  maxSessionsPerWeek: 8,
  schedule: {
    2: [{ start: '15:00', end: '18:00' }],
    4: [{ start: '15:00', end: '18:00' }],
    5: [{ start: '14:00', end: '17:00' }],
  },
  notes: 'Anfänger-Kinder, Schnupperkurse. Semesterbegleitend.',
};

// T7 — Allrounder Teilzeit
const T7: TrainerProfile = {
  email: 'trainer.7@tc-rheinland.de',
  fullName: 'Katharina Becker',
  shortLabel: 'Allrounder (Teilzeit)',
  preferredLevel: 'intermediate',
  preferredAgeGroup: 'both',
  maxSessionsPerWeek: 14,
  schedule: {
    2: [{ start: '14:00', end: '19:00' }],
    3: [{ start: '14:00', end: '19:00' }],
    4: [{ start: '14:00', end: '19:00' }],
    6: [{ start: '10:00', end: '13:00' }],
  },
  notes: 'Breitensport, Hobby-Spieler, Familientrainerin.',
};

// T8 — Wochenend-Aushilfe
const T8: TrainerProfile = {
  email: 'trainer.8@tc-rheinland.de',
  fullName: 'Florian Schulz',
  shortLabel: 'Wochenend-Aushilfe',
  preferredLevel: 'beginner',
  preferredAgeGroup: 'both',
  maxSessionsPerWeek: 9,
  schedule: {
    5: [{ start: '16:00', end: '20:00' }],
    6: [{ start: '10:00', end: '14:00' }],
    0: [{ start: '10:00', end: '14:00' }],
  },
  notes: 'Wochenend-Vertretung, Camps, Schnupperkurse.',
};

const ALL_TRAINERS: TrainerProfile[] = [T1, T2, T3, T4, T5, T6, T7, T8];

// ───────────────────────── Helpers ─────────────────────────
type Stats = {
  availInserted: number;
  availSkippedNoUser: number;
  prefInserted: number;
  prefSkipped: number;
  errors: number;
};
const stats: Stats = {
  availInserted: 0,
  availSkippedNoUser: 0,
  prefInserted: 0,
  prefSkipped: 0,
  errors: 0,
};

function log(icon: string, msg: string) {
  console.log(`  ${icon} ${msg}`);
}
function logSection(title: string) {
  console.log(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`);
}

const AVAIL_TABLE = 'trainer_availabilities'; // PLURAL – kanonische Live-Tabelle

const DAY_INDEX_TO_NAME: Record<
  number,
  'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

function scheduleToAvailabilityJsonb(
  schedule: Record<number, Slot[]>
): Record<
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  Slot[]
> {
  const out = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  } as Record<
    'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
    Slot[]
  >;
  for (const [dayStr, slots] of Object.entries(schedule)) {
    if (slots.length > 0) out[DAY_INDEX_TO_NAME[Number(dayStr)]] = slots;
  }
  return out;
}

const toTime = (s: string): string => (s.length === 5 ? `${s}:00` : s);

// ───────────────────────── Main ─────────────────────────
async function main() {
  const sb = createServiceClient();

  console.log('\n🎾 SwingZ Trainer-Availability Seed – TC Rheinland (v3)');
  console.log('═'.repeat(60));
  console.log(`  Club:    ${CLUB_NAME}`);
  console.log(`  Saison:  Sommer ${SEASON_YEAR}`);
  console.log(`  Trainer: ${ALL_TRAINERS.length} differenzierte Profile\n`);

  // ─── 0. Club + Sommer-Saison + Trainer-User-Lookup ──────────────────
  logSection('0. Club & Sommer-Saison finden');

  const { data: club } = await sb
    .from('clubs')
    .select('id,name')
    .ilike('name', `%${CLUB_NAME}%`)
    .maybeSingle();
  if (!club) {
    console.error(`\n❌ Club "${CLUB_NAME}" nicht gefunden.`);
    process.exit(1);
  }
  const clubId = club.id;
  log('✅', `${club.name} (${clubId.slice(0, 8)}…)`);

  const trainerEmails = ALL_TRAINERS.map((t) => t.email);
  const { data: publicUsers } = await sb
    .from('users')
    .select('id,email,full_name')
    .in('email', trainerEmails)
    .order('email');

  const userIdByEmail = new Map<string, string>();
  for (const u of publicUsers ?? []) userIdByEmail.set(u.email, u.id);
  log('✅', `${userIdByEmail.size} von ${trainerEmails.length} Trainer-Usern gefunden`);
  const missing = trainerEmails.filter((e) => !userIdByEmail.has(e));
  if (missing.length > 0)
    console.warn(`  ⚠️ Fehlend: ${missing.join(', ')} – werden übersprungen.`);

  const { data: season } = await sb
    .from('seasons')
    .select('id,name,planning_status')
    .eq('club_id', clubId)
    .eq('season_type', SEASON_TYPE)
    .eq('year', SEASON_YEAR)
    .maybeSingle();
  if (!season) {
    console.error(`\n❌ Keine Sommer-${SEASON_YEAR}-Saison für ${CLUB_NAME} gefunden.`);
    process.exit(1);
  }
  log('✅', `Saison: ${season.name} (${season.planning_status})`);

  const { data: memberships } = await sb
    .from('user_club_memberships')
    .select('user_id,role,is_active')
    .eq('club_id', clubId)
    .in('user_id', Array.from(userIdByEmail.values()));
  const activeTrainerMemberships = (memberships ?? []).filter(
    (m) => m.role === 'trainer' && m.is_active
  );
  log('ℹ️', `${activeTrainerMemberships.length}/${userIdByEmail.size} aktive Trainer-Memberships`);

  // ─── 1. trainer_availabilities (kanonische Live-Tabelle) ───────────
  logSection(`1. trainer_availabilities (PLURAL – kanonisch)`);

  for (const profile of ALL_TRAINERS) {
    const userId = userIdByEmail.get(profile.email);
    if (!userId) {
      stats.availSkippedNoUser++;
      continue;
    }

    const rows = Object.entries(profile.schedule).flatMap(([dayStr, slots]) =>
      slots.map((slot) => ({
        user_id: userId,
        club_id: clubId,
        day_of_week: Number(dayStr),
        start_time: toTime(slot.start),
        end_time: toTime(slot.end),
        is_available: true,
        notes: profile.shortLabel,
      }))
    );
    if (rows.length === 0) continue;

    // `as any` Cast: supabase-types.ts ist veraltet (singular-Form), Plural fehlt
    // im lokalen TS-Schema. Cast matches das Pattern aus
    // `app/api/clubs/[id]/planning-readiness/route.ts`.
    const { data, error } = await (sb.from(AVAIL_TABLE) as any)
      .upsert(rows, {
        onConflict: 'user_id,club_id,day_of_week,start_time,end_time',
        ignoreDuplicates: true,
      })
      .select('id');

    if (error) {
      log('❌', `${profile.fullName} – ${error.message}`);
      stats.errors++;
      continue;
    }

    // ignoreDuplicates:true → data ist null, wenn alle Rows Konflikte waren
    const inserted = Array.isArray(data) ? data.length : 0;
    const skipped = rows.length - inserted;
    stats.availInserted += inserted;

    if (inserted === rows.length) {
      log('✅', `${profile.fullName} (${profile.shortLabel}): +${inserted} neue Slots`);
    } else if (inserted === 0) {
      log('⏭️', `${profile.fullName} (${profile.shortLabel}): ${skipped} bereits vorhanden`);
    } else {
      log(
        '✅',
        `${profile.fullName} (${profile.shortLabel}): +${inserted}/${rows.length} neu (${skipped} schon da)`
      );
    }
  }

  // ─── 2. user_training_preferences (user_role='trainer') ────────────
  logSection(`2. user_training_preferences (user_role='trainer', Saison=${season.name})`);

  for (const profile of ALL_TRAINERS) {
    const userId = userIdByEmail.get(profile.email);
    if (!userId) continue;

    // Idempotenz: Pre-Check (kein UNIQUE-Constraint im Live-Schema)
    const { data: existing } = await sb
      .from('user_training_preferences')
      .select('id,max_sessions_per_week,is_submitted')
      .eq('season_id', season.id)
      .eq('user_id', userId)
      .eq('user_role', 'trainer')
      .maybeSingle();

    if (existing) {
      log(
        '⏭️',
        `${profile.fullName} – already exists (max=${existing.max_sessions_per_week}, sub=${existing.is_submitted})`
      );
      stats.prefSkipped++;
      continue;
    }

    const totalSlots = Object.values(profile.schedule).flat().length;
    const insertRow: Record<string, unknown> = {
      season_id: season.id,
      user_id: userId,
      club_id: clubId,
      user_role: 'trainer',
      preferred_level: profile.preferredLevel,
      preferred_age_group: profile.preferredAgeGroup,
      preferred_group_ids: [],
      weekly_availability: scheduleToAvailabilityJsonb(profile.schedule),
      unavailable_dates: [],
      max_sessions_per_week: profile.maxSessionsPerWeek,
      preferred_court_ids: [],
      can_teach_groups: [],
      priority: 5,
      special_requests: null,
      notes: profile.notes,
      submitted_at: new Date().toISOString(),
      is_submitted: true,
    };

    const { error } = await sb
      .from('user_training_preferences')
      .insert(insertRow)
      .select('id')
      .single();

    if (error) {
      log('❌', `${profile.fullName} – ${error.message}`);
      stats.errors++;
      continue;
    }

    stats.prefInserted++;
    log(
      '✅',
      `${profile.fullName} (${profile.shortLabel}): ${totalSlots} Wochen-Slots, ` +
        `max=${profile.maxSessionsPerWeek}/wk`
    );
  }

  // ─── 3. Zusammenfassung ──────────────────────────────────────────────
  logSection('Zusammenfassung');
  console.log(`
  🏟️  Club:                 ${club.name}
  🎾  Saison:               ${season.name}
  👥  Trainer-Profile:      ${ALL_TRAINERS.length}, ${userIdByEmail.size} User verlinkt

  📊  trainer_availabilities:      +${stats.availInserted} neue Slots
                                   ${stats.availSkippedNoUser > 0 ? `(${stats.availSkippedNoUser} skipped – kein User)` : ''}
  📊  user_training_preferences:   +${stats.prefInserted} neu
                                   ${stats.prefSkipped} bereits da
  ❗  Errors:                     ${stats.errors}

  ⚡ Wiederverwendbar: jeder Lauf ist idempotent (kein Duplikate-Wachstum).
  ♻️  Schema-Änderungen: Skript anpassen + neu ausführen.
`);
}

main().catch((e) => {
  console.error('\n❌ FATAL:', e);
  process.exit(1);
});
