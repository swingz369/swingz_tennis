#!/usr/bin/env npx tsx
/**
 * Seed-Skript: TC Rheinland e.V. — Kompletter Test-Verein
 *
 * Erstellt:
 * - 1 neuen Verein (TC Rheinland e.V.) mit setup_completed_at = NULL
 * - 1 Admin-User (Löse die Onboarding-Wizards beim ersten Login aus)
 * - 8 Trainer (mit trainers + trainer_club Einträgen)
 * - 120 Mitglieder (mit realistischen deutschen Namen)
 * - 4 Courts
 *
 * Login-Daten nach dem Seed:
 *   Admin:   admin@tc-rheinland.de / TestAdmin2026!
 *   Trainer: trainer.1@tc-rheinland.de bis trainer.8@tc-rheinland.de / TestTrainer2026!
 *
 * Usage: npx tsx scripts/seed-test-club-rheinland.ts
 */

import 'dotenv/config';
import { createServiceClient } from '@/lib/supabase/service';

const supabase = createServiceClient();

// ═══════════════════════════════════════════════════════════════
// NAME POOLS (realistische deutsche Namen)
// ═══════════════════════════════════════════════════════════════

const FIRST_NAMES_MALE = [
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
  'Philipp',
  'Fabian',
  'Jan',
  'Moritz',
  'Lennart',
  'Rafael',
  'Adrian',
  'Vincent',
  'Nico',
  'Jannik',
  'Marco',
  'Daniel',
  'Alexander',
  'Stefan',
  'Christian',
  'Michael',
  'Andreas',
  'Thomas',
  'Markus',
  'Johannes',
  'Matthias',
  'Sebastian',
  'Florian',
  'Patrick',
  'Dominik',
  'Lars',
  'Sven',
  'Oliver',
  'Tobias',
  'Benjamin',
];

const FIRST_NAMES_FEMALE = [
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
  'Carina',
  'Stefanie',
  'Christina',
  'Melanie',
  'Sandra',
  'Nicole',
  'Andrea',
  'Katrin',
  'Martina',
  'Silke',
  'Petra',
  'Claudia',
  'Monika',
  'Barbara',
  'Angela',
  'Susanne',
  'Brigitte',
  'Heike',
  'Ute',
  'Renate',
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
  'Schubert',
  'Roth',
  'Frank',
  'Berger',
  'Winkler',
  'Peters',
  'Scholz',
  'Möller',
  'Weiß',
  'Graf',
  'Friedrich',
  'Pohl',
  'Seidel',
  'Engel',
  'Haas',
  'Brandt',
  'Jäger',
];

// ═══════════════════════════════════════════════════════════════
// TRAINER DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const TRAINERS = [
  {
    firstName: 'Martin',
    lastName: 'Berger',
    specialties: ['Anfänger', 'Fortgeschrittene', 'Einzeltraining'],
  },
  {
    firstName: 'Sandra',
    lastName: 'Koch',
    specialties: ['Kindertraining', 'Jugendtraining', 'Anfänger'],
  },
  {
    firstName: 'Stefan',
    lastName: 'Wagner',
    specialties: ['Leistungssport', 'Turniervorbereitung', 'Fortgeschrittene'],
  },
  {
    firstName: 'Katharina',
    lastName: 'Roth',
    specialties: ['Anfänger', 'Breitensport', 'Senioren'],
  },
  {
    firstName: 'Alexander',
    lastName: 'Schubert',
    specialties: ['Fortgeschrittene', 'Mannschaftstraining', 'Doppel'],
  },
  {
    firstName: 'Julia',
    lastName: 'Keller',
    specialties: ['Kindertraining', 'Anfänger', 'Spielspaß'],
  },
  {
    firstName: 'Thomas',
    lastName: 'Vogel',
    specialties: ['Leistungssport', 'Konditionstraining', 'Fortgeschrittene'],
  },
  {
    firstName: 'Christina',
    lastName: 'Brandt',
    specialties: ['Senioren', 'Einzeltraining', 'Anfänger'],
  },
];

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function randomLevel(): string {
  const levels = [
    'beginner',
    'beginner',
    'intermediate',
    'intermediate',
    'intermediate',
    'advanced',
    'advanced',
    'pro',
  ];
  return levels[Math.floor(Math.random() * levels.length)];
}

function randomExperience(level: string): number {
  switch (level) {
    case 'beginner':
      return Math.floor(Math.random() * 6) + 1;
    case 'intermediate':
      return Math.floor(Math.random() * 24) + 12;
    case 'advanced':
      return Math.floor(Math.random() * 36) + 36;
    case 'pro':
      return Math.floor(Math.random() * 60) + 60;
    default:
      return 12;
  }
}

function randomPhone(): string {
  const prefix = [
    '0151',
    '0152',
    '0157',
    '0160',
    '0162',
    '0163',
    '0170',
    '0171',
    '0172',
    '0173',
    '0174',
    '0175',
    '0176',
    '0177',
    '0178',
    '0179',
  ];
  const p = prefix[Math.floor(Math.random() * prefix.length)];
  const num = String(Math.floor(Math.random() * 10000000)).padStart(7, '0');
  return `+49 ${p} ${num.slice(0, 3)} ${num.slice(3)}`;
}

async function createAuthUser(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    if (error.message.includes('already been registered')) {
      // Find existing user
      const { data: users } = await supabase.auth.admin.listUsers();
      const existing = users?.users.find((u) => u.email === email);
      if (existing) {
        console.log(`  ⚠️  ${email} existiert bereits (auth)`);
        return existing.id;
      }
    }
    throw new Error(`Auth user creation failed for ${email}: ${error.message}`);
  }

  return data.user.id;
}

async function ensurePublicUser(
  userId: string,
  email: string,
  fullName: string,
  extras: Record<string, any> = {}
) {
  // Check if public.users entry exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (existing) return userId;

  const { error } = await supabase.from('users').insert({
    id: userId,
    email,
    full_name: fullName,
    subscription_tier: 'free',
    subscription_status: 'active',
    ...extras,
  });

  if (error && !error.message.includes('duplicate')) {
    console.error(`  ❌ public.users insert failed for ${email}: ${error.message}`);
  }

  return userId;
}

async function ensureMembership(userId: string, clubId: string, role: string) {
  const { data: existing } = await supabase
    .from('user_club_memberships')
    .select('id')
    .match({ user_id: userId, club_id: clubId })
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from('user_club_memberships').insert({
    user_id: userId,
    club_id: clubId,
    role,
    is_active: true,
    include_in_planning: role === 'member' || role === 'trainer',
    joined_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`  ❌ Membership insert failed (${role}): ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN SEED
// ═══════════════════════════════════════════════════════════════

async function seed() {
  console.log('🎾 Starte Seed für TC Rheinland e.V.\n');
  console.log('='.repeat(60));

  // ─── 1. Club erstellen ───────────────────────────────────────
  console.log('\n📋 Schritt 1: Club erstellen...');

  const { data: existingClub } = await supabase
    .from('clubs')
    .select('id')
    .eq('name', 'TC Rheinland e.V.')
    .maybeSingle();

  let clubId: string;

  if (existingClub) {
    clubId = existingClub.id;
    console.log(`  ⚠️  Club existiert bereits (${clubId})`);
  } else {
    const { data: newClub, error: clubError } = await supabase
      .from('clubs')
      .insert({
        name: 'TC Rheinland e.V.',
        slug: 'tc-rheinland',
        timezone: 'Europe/Berlin',
        default_session_duration_minutes: 60,
        max_members: 500,
        opening_hours: {
          monday: { open: '08:00', close: '22:00' },
          tuesday: { open: '08:00', close: '22:00' },
          wednesday: { open: '08:00', close: '22:00' },
          thursday: { open: '08:00', close: '22:00' },
          friday: { open: '08:00', close: '22:00' },
          saturday: { open: '09:00', close: '20:00' },
          sunday: { open: '10:00', close: '18:00' },
        },
        default_hourly_rate: '18.00',
        description:
          'Traditioneller Tennisclub am Rhein — gegründet 1978. 4 Außenplätze, aktive Jugendabteilung.',
        bundesland: 'Nordrhein-Westfalen',
        billing_unit_minutes: 60,
        tax_rate: 0,
        default_payment_method: 'transfer',
        invoice_number_prefix: 'TCR',
        status: 'active',
        // setup_completed_at = NULL → Wizard triggert beim ersten Admin-Login!
      })
      .select('id')
      .single();

    if (clubError) {
      console.error('❌ Club erstellen fehlgeschlagen:', clubError.message);
      process.exit(1);
    }

    clubId = newClub!.id;
    console.log(`  ✅ Club erstellt: TC Rheinland e.V. (${clubId})`);
  }

  // ─── 2. Courts erstellen ─────────────────────────────────────
  console.log('\n🏟️  Schritt 2: Courts erstellen...');

  const courts = [
    {
      name: 'Platz 1 (Center Court)',
      surface: 'sand',
      has_indoor: false,
      has_lighting: true,
      number: 1,
      location: 'Nord',
    },
    {
      name: 'Platz 2',
      surface: 'sand',
      has_indoor: false,
      has_lighting: true,
      number: 2,
      location: 'Nord',
    },
    {
      name: 'Platz 3',
      surface: 'sand',
      has_indoor: false,
      has_lighting: false,
      number: 3,
      location: 'Süd',
    },
    {
      name: 'Platz 4 (Halle)',
      surface: 'hard',
      has_indoor: true,
      has_lighting: true,
      number: 4,
      location: 'Halle',
    },
  ];

  for (const court of courts) {
    const { data: existing } = await supabase
      .from('courts')
      .select('id')
      .match({ club_id: clubId, name: court.name })
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from('courts').insert({
        club_id: clubId,
        ...court,
        is_active: true,
      });
      if (error) {
        console.error(`  ❌ Court ${court.name}: ${error.message}`);
      } else {
        console.log(`  ✅ ${court.name} erstellt`);
      }
    } else {
      console.log(`  ⚠️  ${court.name} existiert bereits`);
    }
  }

  // ─── 3. Admin-User erstellen ─────────────────────────────────
  console.log('\n👤 Schritt 3: Admin-User erstellen...');

  const adminEmail = 'admin@tc-rheinland.de';
  const adminPassword = 'TestAdmin2026!';
  const adminName = 'Alexander Hartmann';

  const adminAuthId = await createAuthUser(adminEmail, adminPassword, adminName);
  await ensurePublicUser(adminAuthId, adminEmail, adminName);
  await ensureMembership(adminAuthId, clubId, 'admin');
  console.log(`  ✅ Admin: ${adminEmail} / ${adminPassword}`);

  // ─── 4. Trainer erstellen (8 Stück) ──────────────────────────
  console.log('\n👨‍🏫 Schritt 4: 8 Trainer erstellen...');

  const trainerUserIds: string[] = [];
  const trainerRecordIds: string[] = [];

  for (let i = 0; i < TRAINERS.length; i++) {
    const t = TRAINERS[i];
    const email = `trainer.${i + 1}@tc-rheinland.de`;
    const password = 'TestTrainer2026!';
    const fullName = `${t.firstName} ${t.lastName}`;

    // Auth user
    const authId = await createAuthUser(email, password, fullName);
    await ensurePublicUser(authId, email, fullName, {
      skill_level: 'advanced',
      experience_months: 120,
    });
    await ensureMembership(authId, clubId, 'trainer');
    trainerUserIds.push(authId);

    // Trainer record
    const { data: existingTrainer } = await supabase
      .from('trainers')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    let trainerRecordId: string;

    if (existingTrainer) {
      trainerRecordId = existingTrainer.id;
    } else {
      const { data: newTrainer, error: tErr } = await supabase
        .from('trainers')
        .insert({
          email,
          name: fullName,
          specialties: t.specialties,
          max_hours_per_week: 25,
          is_active: true,
        })
        .select('id')
        .single();

      if (tErr) {
        console.error(`  ❌ Trainer record ${email}: ${tErr.message}`);
        continue;
      }
      trainerRecordId = newTrainer!.id;
    }

    // trainer_club link
    const { error: tcErr } = await supabase
      .from('trainer_club')
      .insert({ trainer_id: trainerRecordId, club_id: clubId })
      .maybeSingle();

    if (tcErr && !tcErr.message.includes('duplicate')) {
      console.error(`  ❌ trainer_club: ${tcErr.message}`);
    }

    trainerRecordIds.push(trainerRecordId);
    console.log(`  ✅ Trainer ${i + 1}: ${email} (${fullName})`);
  }

  // ─── 5. 120 Mitglieder erstellen ─────────────────────────────
  console.log('\n👥 Schritt 5: 120 Mitglieder erstellen...');

  // Generate 120 unique names
  const allNames: Array<{ first: string; last: string }> = [];
  const namePool = [
    ...FIRST_NAMES_MALE.map((n) => ({ first: n, gender: 'M' as const })),
    ...FIRST_NAMES_FEMALE.map((n) => ({ first: n, gender: 'F' as const })),
  ];

  const usedCombos = new Set<string>();
  while (allNames.length < 120) {
    const entry = namePool[Math.floor(Math.random() * namePool.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const key = `${entry.first}-${lastName}`;
    if (!usedCombos.has(key)) {
      usedCombos.add(key);
      allNames.push({ first: entry.first, last: lastName });
    }
  }

  let memberCount = 0;
  let errorCount = 0;

  for (let i = 0; i < allNames.length; i++) {
    const name = allNames[i];
    const email = `mitglied.${i + 1}@tc-rheinland.de`;
    const password = 'TestMitglied2026!';
    const fullName = `${name.first} ${name.last}`;
    const level = randomLevel();
    const experience = randomExperience(level);

    try {
      const authId = await createAuthUser(email, password, fullName);
      await ensurePublicUser(authId, email, fullName, {
        skill_level: level,
        experience_months: experience,
        phone: randomPhone(),
      });
      await ensureMembership(authId, clubId, 'member');
      memberCount++;
    } catch (err) {
      errorCount++;
      if (errorCount <= 5) {
        console.error(
          `  ❌ Mitglied ${i + 1} (${email}): ${err instanceof Error ? err.message : err}`
        );
      }
    }

    if ((i + 1) % 30 === 0) {
      console.log(`  ... ${i + 1}/120 Mitglieder erstellt`);
    }
  }

  console.log(`  ✅ ${memberCount} Mitglieder erstellt (${errorCount} Fehler)`);

  // ─── 6. Schedule erstellen ───────────────────────────────────
  console.log('\n📅 Schritt 6: Schedule erstellen...');

  const currentYear = new Date().getFullYear();
  const { data: existingSchedule } = await supabase
    .from('schedules')
    .select('id')
    .match({ club_id: clubId, season_year: currentYear, season_type: 'full_year' })
    .maybeSingle();

  if (!existingSchedule) {
    const { error } = await supabase.from('schedules').insert({
      club_id: clubId,
      season_type: 'full_year',
      season_year: currentYear,
      season_start_date: new Date(currentYear, 0, 1).toISOString(),
      season_end_date: new Date(currentYear, 11, 31).toISOString(),
      is_active: true,
    });
    if (error) {
      console.error(`  ❌ Schedule: ${error.message}`);
    } else {
      console.log(`  ✅ Schedule ${currentYear} erstellt`);
    }
  } else {
    console.log(`  ⚠️  Schedule existiert bereits`);
  }

  // ─── Zusammenfassung ─────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('📋 SEED-ZUSAMMENFASSUNG');
  console.log('='.repeat(60));
  console.log(`Verein:     TC Rheinland e.V. (${clubId})`);
  console.log(`setup_completed_at: NULL → Onboarding Wizard triggert!`);
  console.log(`Courts:     4 (3× Sand, 1× Halle)`);
  console.log(`Admin:      ${adminEmail} / ${adminPassword}`);
  console.log(
    `Trainer:    ${TRAINERS.length} (${TRAINERS.map((t) => `${t.firstName} ${t.lastName}`).join(', ')})`
  );
  console.log(`Mitglieder: ${memberCount}`);
  console.log('='.repeat(60));

  // Count final state
  const { count: totalMemberships } = await supabase
    .from('user_club_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('is_active', true);

  console.log(`\n📊 Gesamt aktive Memberships in DB: ${totalMemberships}`);
  console.log(
    `   (1 Admin + ${TRAINERS.length} Trainer + ${memberCount} Mitglieder = ${1 + TRAINERS.length + memberCount})`
  );

  console.log('\n✅ Seed abgeschlossen!');
  console.log('\n🔑 LOGIN-DATEN:');
  console.log(`   Admin:      ${adminEmail} / ${adminPassword}`);
  console.log(
    `   Trainer:    trainer.1@tc-rheinland.de bis trainer.8@tc-rheinland.de / TestTrainer2026!`
  );
  console.log(
    `   Mitglieder: mitglied.1@tc-rheinland.de bis mitglied.120@tc-rheinland.de / TestMitglied2026!`
  );
  console.log('\n⚡ Der Admin-Onboarding-Wizard startet automatisch beim ersten Login!');
}

seed().catch((err) => {
  console.error('\n❌ Seed fehlgeschlagen:', err);
  process.exit(1);
});
