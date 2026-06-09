#!/usr/bin/env npx tsx
/**
 * Seed-Skript: Performance-Test-Daten
 *
 * Erstellt:
 * - 1 Verein (TC PerfTest e.V.) falls noch nicht vorhanden
 * - 5 Courts (3 Sand, 1 Halle, 1 Hartplatz)
 * - 8 Trainer (mit user, trainers, trainer_club, user_club_memberships, user_training_preferences)
 * - 200 Mitglieder (mit user, user_club_memberships, user_training_preferences)
 * - 1 aktive Sommer-Saison mit season_planning_configs
 *
 * Usage: npx tsx scripts/seed-perf-test.ts
 *
 * Zweck: E2E-Performance-Tests für den Clustering-Algorithmus (200/8/5/12).
 * Login-Daten: admin@tc-perftest.de / TestAdmin2026!
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const CLUB_NAME = 'TC PerfTest e.V.';
const CLUB_SLUG = 'tc-perftest';
const ADMIN_EMAIL = 'admin@tc-perftest.de';
const ADMIN_PASSWORD = 'TestAdmin2026!';
const MEMBER_PASSWORD = 'TestMitglied2026!';
const TRAINER_PASSWORD = 'TestTrainer2026!';
const NUM_TRAINERS = 8;
const NUM_MEMBERS = 200;
const NUM_COURTS = 5;
const CURRENT_YEAR = new Date().getFullYear();

// ═══════════════════════════════════════════════════════════════
// NAME POOLS
// ═══════════════════════════════════════════════════════════════

const FIRST_NAMES = [
  'Lukas',
  'Felix',
  'Maximilian',
  'Leon',
  'Paul',
  'Jonas',
  'Tim',
  'Niklas',
  'Finn',
  'Julian',
  'Luis',
  'Mats',
  'Elias',
  'Simon',
  'Oskar',
  'David',
  'Noah',
  'Ben',
  'Tom',
  'Samuel',
  'Anna',
  'Laura',
  'Sarah',
  'Lisa',
  'Julia',
  'Emma',
  'Sophie',
  'Marie',
  'Lena',
  'Hannah',
  'Mia',
  'Emily',
  'Lina',
  'Lea',
  'Nele',
  'Amelie',
  'Lara',
  'Leonie',
  'Johanna',
  'Maya',
  'Paula',
  'Marlene',
  'Ida',
  'Clara',
  'Theresa',
  'Alina',
  'Katharina',
  'Sabrina',
  'Nadine',
  'Vanessa',
];

const LAST_NAMES = [
  'Müller',
  'Schmidt',
  'Schneider',
  'Fischer',
  'Weber',
  'Wagner',
  'Becker',
  'Hoffmann',
  'Schäfer',
  'Koch',
  'Bauer',
  'Richter',
  'Klein',
  'Wolf',
  'Schröder',
  'Neumann',
  'Schwarz',
  'Zimmermann',
  'Braun',
  'Krüger',
  'Hofmann',
  'Hartmann',
  'Lange',
  'Schmitt',
  'Werner',
  'Schmitz',
  'Krause',
  'Meier',
  'Lehmann',
  'Schmid',
  'Huber',
  'Mayer',
  'Herrmann',
  'König',
  'Walter',
  'Lang',
  'Jung',
  'Hahn',
  'Keller',
  'Vogel',
];

const TRAINER_NAMES = [
  { first: 'Martin', last: 'Berger', specialties: ['Anfänger', 'Fortgeschrittene'] },
  { first: 'Sandra', last: 'Koch', specialties: ['Kindertraining', 'Anfänger'] },
  { first: 'Stefan', last: 'Wagner', specialties: ['Leistungssport', 'Turniervorbereitung'] },
  { first: 'Katharina', last: 'Roth', specialties: ['Anfänger', 'Breitensport'] },
  {
    first: 'Alexander',
    last: 'Schubert',
    specialties: ['Fortgeschrittene', 'Mannschaftstraining'],
  },
  { first: 'Julia', last: 'Keller', specialties: ['Kindertraining', 'Anfänger'] },
  { first: 'Thomas', last: 'Vogel', specialties: ['Leistungssport', 'Konditionstraining'] },
  { first: 'Christina', last: 'Brandt', specialties: ['Senioren', 'Einzeltraining'] },
];

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'professional'] as const;
type SkillLevel = (typeof SKILL_LEVELS)[number];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomLevel(): SkillLevel {
  // 40% beginner, 40% intermediate, 15% advanced, 5% professional
  const r = Math.random();
  if (r < 0.4) return 'beginner';
  if (r < 0.8) return 'intermediate';
  if (r < 0.95) return 'advanced';
  return 'professional';
}

function randomExperience(level: SkillLevel): number {
  switch (level) {
    case 'beginner':
      return randomInt(1, 6);
    case 'intermediate':
      return randomInt(6, 24);
    case 'advanced':
      return randomInt(24, 60);
    case 'professional':
      return randomInt(60, 120);
  }
}

function randomAvailability(): any {
  // 90% Mon-Fri evening, 10% also Saturday
  const evenings = [
    { start: '17:00', end: '21:00' },
    { start: '18:00', end: '22:00' },
    { start: '16:00', end: '20:00' },
  ];
  const morning = [{ start: '08:00', end: '12:00' }];
  return {
    monday: Math.random() < 0.7 ? [pick(evenings)] : [pick(morning)],
    tuesday: Math.random() < 0.7 ? [pick(evenings)] : [pick(morning)],
    wednesday: Math.random() < 0.8 ? [pick(evenings)] : [pick(morning)],
    thursday: Math.random() < 0.7 ? [pick(evenings)] : [pick(morning)],
    friday: Math.random() < 0.8 ? [pick(evenings)] : [pick(morning)],
    saturday: Math.random() < 0.3 ? [pick(morning)] : [],
    sunday: [],
  };
}

function uniqueNamePairs(count: number): Array<{ first: string; last: string }> {
  const used = new Set<string>();
  const out: Array<{ first: string; last: string }> = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 10) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const key = `${first}-${last}`;
    if (!used.has(key)) {
      used.add(key);
      out.push({ first, last });
    }
    attempts++;
  }
  // If we couldn't generate enough unique names, add numeric suffixes
  while (out.length < count) {
    out.push({ first: `Test${out.length}`, last: 'Mitglied' });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log('🎾 Performance-Test-Seed startet...\n');

  try {
    // ── 1. Club ────────────────────────────────────────────────
    console.log('📋 Schritt 1: Club...');
    const clubRes = await pool.query<{ id: string }>(`SELECT id FROM clubs WHERE slug = $1`, [
      CLUB_SLUG,
    ]);

    let clubId: string;
    if (clubRes.rows.length > 0) {
      clubId = clubRes.rows[0].id;
      console.log(`  ⚠️  Club existiert bereits: ${clubId}`);
    } else {
      const insert = await pool.query<{ id: string }>(
        `INSERT INTO clubs (
          name, slug, timezone, default_session_duration_minutes, max_members,
          opening_hours, default_hourly_rate, description, bundesland,
          billing_unit_minutes, tax_rate, default_payment_method,
  invoice_number_prefix, status, features
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id`,
        [
          CLUB_NAME,
          CLUB_SLUG,
          'Europe/Berlin',
          90,
          500,
          JSON.stringify({
            monday: { open: '08:00', close: '22:00' },
            tuesday: { open: '08:00', close: '22:00' },
            wednesday: { open: '08:00', close: '22:00' },
            thursday: { open: '08:00', close: '22:00' },
            friday: { open: '08:00', close: '22:00' },
            saturday: { open: '09:00', close: '20:00' },
            sunday: { open: '10:00', close: '18:00' },
          }),
          '18.00',
          'Performance-Test-Verein — Synthetic data for clustering benchmarks',
          'Bayern',
          60,
          0,
          'transfer',
          'PERF',
          'active',
          JSON.stringify({
            members: true,
            trainers: true,
            season_planning: true,
            finances: true,
            shop: false,
            tournaments: false,
            trial_trainings: false,
            ai_matchmaking: false,
          }),
        ]
      );
      clubId = insert.rows[0].id;
      console.log(`  ✅ Club erstellt: ${CLUB_NAME} (${clubId})`);
    }

    // ── 2. Courts ──────────────────────────────────────────────
    console.log(`\n🏟️  Schritt 2: ${NUM_COURTS} Courts...`);
    const courtConfigs = [
      { name: 'Center Court', surface: 'sand', has_indoor: false, has_lighting: true },
      { name: 'Platz 2', surface: 'sand', has_indoor: false, has_lighting: true },
      { name: 'Platz 3', surface: 'sand', has_indoor: false, has_lighting: false },
      { name: 'Halle 1', surface: 'hard', has_indoor: true, has_lighting: true },
      { name: 'Halle 2', surface: 'hard', has_indoor: true, has_lighting: true },
    ];

    const courtIds: string[] = [];
    for (let i = 0; i < NUM_COURTS; i++) {
      const cfg = courtConfigs[i];
      const existing = await pool.query<{ id: string }>(
        `SELECT id FROM courts WHERE club_id = $1 AND name = $2`,
        [clubId, cfg.name]
      );
      if (existing.rows.length > 0) {
        courtIds.push(existing.rows[0].id);
        console.log(`  ⚠️  ${cfg.name} existiert bereits`);
      } else {
        const inserted = await pool.query<{ id: string }>(
          `INSERT INTO courts (club_id, name, surface, has_indoor, has_lighting, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           RETURNING id`,
          [clubId, cfg.name, cfg.surface, cfg.has_indoor, cfg.has_lighting]
        );
        courtIds.push(inserted.rows[0].id);
        console.log(`  ✅ ${cfg.name} erstellt`);
      }
    }

    // ── 3. Admin user ──────────────────────────────────────────
    console.log('\n👤 Schritt 3: Admin-User...');
    const adminUserId = await ensureAuthAndPublicUser(
      pool,
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
      'PerfTest Admin'
    );
    await ensureMembership(pool, adminUserId, clubId, 'admin');
    console.log(`  ✅ Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

    // ── 4. Trainer (8) ─────────────────────────────────────────
    console.log(`\n👨‍🏫 Schritt 4: ${NUM_TRAINERS} Trainer...`);
    const trainerUserIds: string[] = [];
    const trainerRecordIds: string[] = [];

    for (let i = 0; i < NUM_TRAINERS; i++) {
      const t = TRAINER_NAMES[i];
      const email = `trainer.${i + 1}@tc-perftest.de`;
      const fullName = `${t.first} ${t.last}`;

      // Auth + public user
      const userId = await ensureAuthAndPublicUser(pool, email, TRAINER_PASSWORD, fullName, {
        skill_level: 'advanced',
        experience_months: randomInt(60, 180),
      });
      trainerUserIds.push(userId);

      // Membership
      await ensureMembership(pool, userId, clubId, 'trainer');

      // Trainer record
      let trainerId: string;
      const existingTrainer = await pool.query<{ id: string }>(
        `SELECT id FROM trainers WHERE email = $1`,
        [email]
      );
      if (existingTrainer.rows.length > 0) {
        trainerId = existingTrainer.rows[0].id;
      } else {
        const ins = await pool.query<{ id: string }>(
          `INSERT INTO trainers (email, name, specialties, max_hours_per_week, is_active)
           VALUES ($1, $2, $3, $4, true)
           RETURNING id`,
          [email, fullName, JSON.stringify(t.specialties), randomInt(20, 30)]
        );
        trainerId = ins.rows[0].id;
      }
      trainerRecordIds.push(trainerId);

      // trainer_club link
      await pool.query(
        `INSERT INTO trainer_club (trainer_id, club_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [trainerId, clubId]
      );

      // user_training_preferences for trainer (so clustering can read availability)
      await pool.query(
        `INSERT INTO user_training_preferences (
          season_id, user_id, club_id, user_role, is_submitted,
          weekly_availability, max_sessions_per_week, can_teach_groups,
          preferred_level, preferred_age_group
        ) VALUES ($1, $2, $3, 'trainer', true, $4, $5, $6, $7, $8)
        ON CONFLICT (season_id, user_id) DO UPDATE SET
          weekly_availability = EXCLUDED.weekly_availability,
          max_sessions_per_week = EXCLUDED.max_sessions_per_week,
          can_teach_groups = EXCLUDED.can_teach_groups`,
        [
          // season_id will be set later — for now use NULL so it's filtered out by clustering
          null,
          userId,
          clubId,
          JSON.stringify(randomAvailability()),
          randomInt(8, 16),
          JSON.stringify(t.specialties),
          'intermediate',
          'adult',
        ]
      );

      console.log(`  ✅ Trainer ${i + 1}: ${fullName} (${email})`);
    }

    // ── 5. Season (1) ──────────────────────────────────────────
    console.log('\n📅 Schritt 5: 1 Sommer-Saison...');
    const seasonName = `Sommer ${CURRENT_YEAR}`;
    const existingSeason = await pool.query<{ id: string }>(
      `SELECT id FROM seasons WHERE club_id = $1 AND name = $2`,
      [clubId, seasonName]
    );

    let seasonId: string;
    if (existingSeason.rows.length > 0) {
      seasonId = existingSeason.rows[0].id;
      console.log(`  ⚠️  Saison existiert bereits: ${seasonId}`);
    } else {
      const seasonStart = `${CURRENT_YEAR}-04-01`;
      const seasonEnd = `${CURRENT_YEAR}-09-30`;
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO seasons (
          club_id, name, season_type, year, start_date, end_date,
          description, planning_status, auto_plan_config
        ) VALUES ($1, $2, 'summer', $3, $4, $5, $6, 'planning', $7)
        RETURNING id`,
        [
          clubId,
          seasonName,
          CURRENT_YEAR,
          seasonStart,
          seasonEnd,
          'Performance-Test Saison — synthetic data',
          JSON.stringify({
            enabled: true,
            max_iterations: 1000,
            optimization_goals: [
              'minimize_conflicts',
              'balance_trainer_load',
              'maximize_preferences',
            ],
          }),
        ]
      );
      seasonId = ins.rows[0].id;
      console.log(`  ✅ Saison erstellt: ${seasonName} (${seasonId})`);
    }

    // season_planning_configs
    await pool.query(
      `INSERT INTO season_planning_configs (
        club_id, season_id,
        max_niveau_span_beginner_months, max_niveau_span_advanced_months,
        trainer_utilization_max_pct, group_max_size, group_min_size,
        proven_group_attendance_threshold_pct, slot_failure_rate_threshold_pct,
        waitlist_priority_rule, prefer_historic_groups, avoid_high_failure_slots,
        treat_high_failure_as_hard, backtrack_depth,
        kids_group_max_size, kids_group_min_size, slot_duration_minutes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (club_id, season_id) DO UPDATE SET
        treat_high_failure_as_hard = EXCLUDED.treat_high_failure_as_hard,
        backtrack_depth = EXCLUDED.backtrack_depth`,
      [
        clubId,
        seasonId,
        4,
        8,
        80,
        12,
        3,
        80,
        30,
        'registration_time',
        true,
        true,
        false,
        0, // The two new fields, default
        6,
        3,
        90,
      ]
    );

    // ── 6. Members (200) ───────────────────────────────────────
    console.log(`\n👥 Schritt 6: ${NUM_MEMBERS} Mitglieder erstellen...`);
    const memberNames = uniqueNamePairs(NUM_MEMBERS);
    let memberCount = 0;
    let errorCount = 0;

    for (let i = 0; i < memberNames.length; i++) {
      const m = memberNames[i];
      const email = `mitglied.${i + 1}@tc-perftest.de`;
      const fullName = `${m.first} ${m.last}`;
      const level = randomLevel();
      const experience = randomExperience(level);

      try {
        const userId = await ensureAuthAndPublicUser(pool, email, MEMBER_PASSWORD, fullName, {
          skill_level: level,
          experience_months: experience,
        });
        await ensureMembership(pool, userId, clubId, 'member');

        // user_training_preferences (REQUIRED for clustering to pick up this member)
        await pool.query(
          `INSERT INTO user_training_preferences (
            season_id, user_id, club_id, user_role, is_submitted,
            preferred_level, preferred_age_group,
            weekly_availability, wish_partner_ids, avoid_member_ids,
            self_assessed_level, max_sessions_per_week
          ) VALUES ($1,$2,$3,'member',true,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (season_id, user_id) DO UPDATE SET
            preferred_level = EXCLUDED.preferred_level,
            weekly_availability = EXCLUDED.weekly_availability,
            is_submitted = true`,
          [
            seasonId,
            userId,
            clubId,
            level,
            'adult',
            JSON.stringify(randomAvailability()),
            JSON.stringify([]), // wish partners
            JSON.stringify([]), // avoid members
            level,
            randomInt(1, 3),
          ]
        );
        memberCount++;
      } catch (err) {
        errorCount++;
        if (errorCount <= 3) {
          console.error(`  ❌ Mitglied ${i + 1}: ${err instanceof Error ? err.message : err}`);
        }
      }

      if ((i + 1) % 50 === 0) {
        console.log(`  ... ${i + 1}/${NUM_MEMBERS} Mitglieder verarbeitet`);
      }
    }

    console.log(`  ✅ ${memberCount}/${NUM_MEMBERS} Mitglieder erstellt (${errorCount} Fehler)`);

    // ── Summary ────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log('📋 SEED-ZUSAMMENFASSUNG');
    console.log('='.repeat(60));
    console.log(`Verein:    ${CLUB_NAME} (${clubId})`);
    console.log(`Saison:    ${seasonName} (${seasonId})`);
    console.log(`Courts:    ${courtIds.length}`);
    console.log(`Admin:     ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log(`Trainer:   ${trainerRecordIds.length}`);
    console.log(`Mitglieder: ${memberCount}`);
    console.log('='.repeat(60));
    console.log('\n✅ Performance-Test-Seed abgeschlossen!');
    console.log('\n🧪 Nächster Schritt: Vitest-Benchmark ausführen');
    console.log('   npx vitest bench tests/bench/clustering.bench.ts');
  } catch (err) {
    console.error('\n❌ Seed fehlgeschlagen:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ═══════════════════════════════════════════════════════════════
// DB HELPERS (idempotent)
// ═══════════════════════════════════════════════════════════════

/**
 * Idempotent helper: creates auth user + public.users row, returns the public user id.
 * NOTE: This bypasses the Supabase Auth API and writes directly to `auth.users` +
 * `public.users` via SQL — works against a local Postgres without needing a real
 * Supabase project. For production-like seeds, use `createServiceClient()`.
 */
async function ensureAuthAndPublicUser(
  pool: Pool,
  email: string,
  password: string,
  fullName: string,
  extras: Record<string, any> = {}
): Promise<string> {
  // Check if user already exists in public.users (cheap lookup)
  const existing = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [
    email,
  ]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const userId = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  // Insert into auth.users
  await pool.query(
    `INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      $2, $3, $4, $5, $6, $7, $7, '', '', '', ''
    )
    ON CONFLICT (email) DO NOTHING`,
    [
      userId,
      email,
      passwordHash,
      now,
      JSON.stringify({ provider: 'email', providers: ['email'] }),
      JSON.stringify({ full_name: fullName }),
      now,
    ]
  );

  // Insert into public.users
  await pool.query(
    `INSERT INTO public.users (id, email, full_name, subscription_tier, subscription_status, created_at, updated_at, ${Object.keys(extras).join(', ')})
     VALUES ($1, $2, $3, 'free', 'active', $4, $4${
       ', ' +
       Object.keys(extras)
         .map((_, i) => `$${i + 5}`)
         .join(', ')
     })
     ON CONFLICT (id) DO NOTHING`,
    [userId, email, fullName, now, ...Object.values(extras)]
  );

  return userId;
}

async function ensureMembership(
  pool: Pool,
  userId: string,
  clubId: string,
  role: 'admin' | 'trainer' | 'member' | 'superadmin' | 'junior'
) {
  await pool.query(
    `INSERT INTO user_club_memberships (user_id, club_id, role, is_active, include_in_planning, joined_at)
     VALUES ($1, $2, $3, true, $4, NOW())
     ON CONFLICT (user_id, club_id) DO NOTHING`,
    [userId, clubId, role, role === 'member' || role === 'trainer']
  );
}

// Lightweight password hasher using Node's crypto.scrypt (avoids Supabase auth dependency)
async function hashPassword(password: string): Promise<string> {
  const crypto = await import('crypto');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

main();
