/**
 * Seed-Script: 3-Club Testdaten
 *
 * Führt aus:
 *  1. Löscht alle Clubs, User, Trainer (außer Owner)
 *  2. Erstellt 3 Clubs + korrekte Struktur
 *  3. Auth-Accounts für Staff (Admin, Superadmin, je 3 Trainer, je 1 Member)
 *  4. DB-only Profile für Bulk-Members und restliche Trainer
 *
 * Usage: npx tsx scripts/seed-test-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OWNER_ID = '75a0c195-90f9-4245-9f30-0b25b7debf5d';
const DEFAULT_PASSWORD = 'Test2026!';

const FIRST_NAMES_M = [
  'Alexander',
  'Andreas',
  'Benjamin',
  'Christian',
  'Daniel',
  'David',
  'Fabian',
  'Felix',
  'Florian',
  'Georg',
  'Hans',
  'Jakob',
  'Jan',
  'Jonas',
  'Julian',
  'Klaus',
  'Lukas',
  'Marco',
  'Markus',
  'Martin',
  'Matthias',
  'Michael',
  'Nicolas',
  'Patrick',
  'Peter',
  'Philipp',
  'Robert',
  'Sebastian',
  'Stefan',
  'Thomas',
  'Tim',
  'Tobias',
  'Uwe',
  'Valentin',
  'Werner',
  'Wolfgang',
  'Leon',
  'Maximilian',
  'Simon',
  'Niklas',
  'Kevin',
  'Moritz',
  'Dominik',
  'Erik',
  'Lars',
  'Sven',
  'Kai',
  'Timo',
  'René',
  'Jens',
];
const FIRST_NAMES_F = [
  'Anna',
  'Christina',
  'Elisabeth',
  'Eva',
  'Hannah',
  'Jana',
  'Julia',
  'Katharina',
  'Laura',
  'Lena',
  'Lisa',
  'Maria',
  'Marie',
  'Melanie',
  'Nicole',
  'Sandra',
  'Sarah',
  'Sophie',
  'Stefanie',
  'Susanne',
  'Tanja',
  'Vanessa',
  'Katrin',
  'Sabine',
  'Petra',
  'Andrea',
  'Claudia',
  'Monika',
  'Ursula',
  'Brigitte',
  'Heike',
  'Karin',
  'Anja',
  'Franziska',
  'Lea',
  'Emma',
  'Mia',
  'Lara',
  'Nele',
  'Charlotte',
  'Johanna',
  'Clara',
  'Amelie',
  'Luisa',
  'Emilia',
  'Leonie',
  'Isabelle',
  'Natalie',
  'Bianca',
  'Verena',
];
const LAST_NAMES = [
  'Müller',
  'Schmidt',
  'Schneider',
  'Fischer',
  'Weber',
  'Meyer',
  'Wagner',
  'Becker',
  'Schulz',
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
  'Schulze',
  'Maier',
  'Köhler',
  'Herrmann',
  'König',
  'Walter',
  'Mayer',
  'Huber',
  'Kaiser',
  'Fuchs',
  'Peters',
  'Lang',
  'Scholz',
  'Möller',
  'Weiß',
  'Jung',
  'Hahn',
  'Schubert',
  'Vogel',
  'Friedrich',
  'Keller',
  'Günther',
  'Frank',
  'Berger',
];

let nameIdx = 0;
function nextName(): { firstName: string; lastName: string } {
  nameIdx++;
  const gender = nameIdx % 2 === 0 ? 'M' : 'F';
  const firstNames = gender === 'M' ? FIRST_NAMES_M : FIRST_NAMES_F;
  return {
    firstName: firstNames[nameIdx % firstNames.length],
    lastName: LAST_NAMES[nameIdx % LAST_NAMES.length],
  };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '.');
}

function toEmail(firstName: string, lastName: string, domain: string, idx: number): string {
  return `${slug(firstName)}.${slug(lastName)}.${idx}@${domain}`;
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

async function cleanup() {
  console.log('\n🗑️  Cleanup...');

  // Paginate through all auth users (API max 1000/page)
  let allAuthUsers: { id: string }[] = [];
  for (let page = 1; ; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data?.users?.length) break;
    allAuthUsers = [...allAuthUsers, ...data.users];
    if (data.users.length < 1000) break;
  }
  const toDelete = allAuthUsers.filter((u) => u.id !== OWNER_ID);
  log(`Deleting ${toDelete.length} auth users...`);
  for (let i = 0; i < toDelete.length; i += 10) {
    await Promise.all(toDelete.slice(i, i + 10).map((u) => supabase.auth.admin.deleteUser(u.id)));
  }

  // Tables with standard uuid `id` column
  const tablesById = [
    'audit_logs',
    'hours_logs',
    'trainer_billings',
    'trainer_profiles',
    'trainer_availabilities',
    'trainer_availability',
    'trainer_feedback',
    'trainer_hourly_rates',
    'trainer_member_notes',
    'trainer_absences',
    'user_training_preferences',
    'member_schedule_preferences',
    'season_planning_configs',
    'seasons',
    'bookings',
    'sessions',
    'schedules',
    'season_plan_entries',
    'user_club_memberships',
    'notifications',
    'messages',
    'invoices',
    'payments',
    'trial_trainings',
    'courts',
  ];
  for (const tbl of tablesById) {
    const { error } = await supabase
      .from(tbl as 'clubs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) log(`  warn ${tbl}: ${error.message}`);
  }
  // Junction tables without id — delete by FK column
  await supabase
    .from('trainer_club' as 'clubs')
    .delete()
    .neq('trainer_id', '00000000-0000-0000-0000-000000000000');
  await supabase
    .from('trainer_clubs' as 'clubs')
    .delete()
    .neq('trainer_id', '00000000-0000-0000-0000-000000000000');
  await supabase
    .from('trainer_rating_summary' as 'clubs')
    .delete()
    .neq('trainer_id', '00000000-0000-0000-0000-000000000000');

  await supabase.from('users').delete().neq('id', OWNER_ID);
  await supabase.from('trainers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const seedIds = [
    'a1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000002',
    'c3000000-0000-0000-0000-000000000003',
  ];
  await supabase.from('clubs').delete().in('id', seedIds);
  await supabase.from('clubs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Owner: alle falschen Memberships entfernen, korrekte owner-Rolle ohne club_id setzen
  await supabase.from('user_club_memberships').delete().eq('user_id', OWNER_ID);
  await supabase.from('user_club_memberships').insert({
    user_id: OWNER_ID,
    role: 'owner',
    club_id: null,
    is_active: true,
    joined_at: new Date().toISOString(),
  });
  log('✓ Owner-Rolle gesetzt (keine club_id)');

  log('✓ Cleanup done');
}

async function createClubs() {
  console.log('\n🏟️  Creating clubs...');
  const features = {
    members: true,
    trainers: true,
    seasons: true,
    finance: true,
    courts: true,
    tournaments: false,
    league_lineup: false,
    trial_training: true,
    shop: false,
    ai_matchmaking: false,
    weather_integration: false,
    work_duty: false,
  };
  const now = new Date().toISOString();
  const oh = {
    mo: '07:00-22:00',
    di: '07:00-22:00',
    mi: '07:00-22:00',
    do: '07:00-22:00',
    fr: '07:00-22:00',
    sa: '08:00-20:00',
    so: '08:00-18:00',
  };

  const clubs = [
    {
      id: 'a1000000-0000-0000-0000-000000000001',
      name: 'TC Rheinland e.V.',
      city: 'Köln',
      address: 'Tennisstraße 12, 50667 Köln',
      email: 'info@tc-rheinland.de',
      phone: '+49 221 1234567',
      website: 'https://tc-rheinland.de',
      slug: 'tc-rheinland',
      bundesland: 'Nordrhein-Westfalen',
      max_members: 300,
      default_hourly_rate: 18.0,
      opening_hours: oh,
      features,
      setup_completed_at: now,
    },
    {
      id: 'b2000000-0000-0000-0000-000000000002',
      name: 'TC Blau-Weiß Münster',
      city: 'Münster',
      address: 'Am Sportpark 5, 48145 Münster',
      email: 'info@tc-muenster.de',
      phone: '+49 251 9876543',
      website: 'https://tc-bw-muenster.de',
      slug: 'tc-bw-muenster',
      bundesland: 'Nordrhein-Westfalen',
      max_members: 250,
      default_hourly_rate: 16.0,
      opening_hours: oh,
      features,
      setup_completed_at: now,
    },
    {
      id: 'c3000000-0000-0000-0000-000000000003',
      name: 'TSV Dortmund Tennis',
      city: 'Dortmund',
      address: 'Hohe Straße 88, 44139 Dortmund',
      email: 'tennis@tsv-dortmund.de',
      phone: '+49 231 5551234',
      website: 'https://tsv-dortmund-tennis.de',
      slug: 'tsv-dortmund-tennis',
      bundesland: 'Nordrhein-Westfalen',
      max_members: 280,
      default_hourly_rate: 17.0,
      opening_hours: oh,
      features,
      setup_completed_at: now,
    },
  ];

  const { error } = await supabase.from('clubs').upsert(clubs, { onConflict: 'id' });
  if (error) throw new Error(`clubs: ${error.message}`);
  log('✓ 3 Clubs angelegt');
  return clubs;
}

async function createAuthUser(email: string, fullName: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 2000));

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (!error) {
      await supabase.from('users').upsert({ id: data.user.id, email, full_name: fullName });
      return data.user.id;
    }

    const msg = error.message ?? '';
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      // Find across all pages
      for (let pg = 1; ; pg++) {
        const { data: list } = await supabase.auth.admin.listUsers({ page: pg, perPage: 1000 });
        if (!list?.users?.length) break;
        const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (existing) {
          await supabase.from('users').upsert({ id: existing.id, email, full_name: fullName });
          return existing.id;
        }
        if (list.users.length < 1000) break;
      }
    }

    lastError = error;
  }
  throw new Error(`auth ${email}: ${JSON.stringify(lastError)}`);
}

async function createDbUser(email: string, fullName: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .insert({ email, full_name: fullName })
    .select('id')
    .single();
  if (error) throw new Error(`dbUser ${email}: ${error.message}`);
  return data.id;
}

async function addMembership(userId: string, clubId: string, role: string) {
  await supabase.from('user_club_memberships').insert({
    user_id: userId,
    club_id: clubId,
    role,
    is_active: true,
    joined_at: new Date().toISOString(),
  });
}

async function createTrainer(
  userId: string,
  fullName: string,
  email: string,
  clubId: string
): Promise<string> {
  const specialtySets = [
    ['Grundlagentraining', 'Einzel'],
    ['Jugendtraining', 'Gruppentraining'],
    ['Leistungstraining', 'Turniervorbereitung'],
    ['Anfänger', 'Grundlagentraining'],
    ['Doppeltraining', 'Taktik'],
  ];
  const contractHours = TRAINER_CONTRACT_HOURS[nameIdx % TRAINER_CONTRACT_HOURS.length];
  const { data, error } = await supabase
    .from('trainers')
    .insert({
      user_id: userId,
      email,
      name: fullName,
      specialties: specialtySets[nameIdx % specialtySets.length],
      max_hours_per_week: contractHours,
      is_active: true,
    })
    .select('id')
    .single();
  if (error) throw new Error(`trainer ${email}: ${error.message}`);
  await supabase.from('trainer_club').insert({ trainer_id: data.id, club_id: clubId });
  const nameParts = fullName.split(' ');
  await supabase
    .from('trainer_profiles')
    .upsert(
      {
        user_id: userId,
        club_id: clubId,
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(' ') || nameParts[0],
        email,
        phone: '00000',
        date_of_birth: '1985-01-01',
        qualifications: [],
        specializations: [],
        experience: { years: 5, achievements: [], previousClubs: [] },
        status: 'active',
        availability: {},
        preferred_time_slots: [],
        languages: ['Deutsch'],
        emergency_contact: { name: '', phone: '', relationship: '' },
        contracted_hourly_rate: contractHours,
      },
      { onConflict: 'user_id,club_id' }
    )
    .then(() => {});
  return data.id;
}

// dow: 0=So 1=Mo 2=Di 3=Mi 4=Do 5=Fr 6=Sa — variiert realistisch pro Trainer
const TRAINER_AVAIL_PATTERNS: Array<Array<{ dow: number; start: string; end: string }>> = [
  // Vollzeit Mo/Mi/Fr ganztags + Sa vormittags
  [
    { dow: 1, start: '09:00', end: '18:00' },
    { dow: 3, start: '09:00', end: '18:00' },
    { dow: 5, start: '09:00', end: '18:00' },
    { dow: 6, start: '09:00', end: '13:00' },
  ],
  // Di/Do ganztags + Sa
  [
    { dow: 2, start: '09:00', end: '19:00' },
    { dow: 4, start: '09:00', end: '19:00' },
    { dow: 6, start: '09:00', end: '14:00' },
  ],
  // Nur nachmittags/abends Mo–Fr (Nebenerwerb)
  [
    { dow: 1, start: '14:00', end: '20:00' },
    { dow: 2, start: '14:00', end: '20:00' },
    { dow: 3, start: '14:00', end: '20:00' },
    { dow: 4, start: '14:00', end: '20:00' },
    { dow: 5, start: '14:00', end: '20:00' },
  ],
  // Mo/Di/Mi + Sa — klassische Teilzeit
  [
    { dow: 1, start: '09:00', end: '17:00' },
    { dow: 2, start: '09:00', end: '17:00' },
    { dow: 3, start: '09:00', end: '17:00' },
    { dow: 6, start: '09:00', end: '13:00' },
  ],
  // Fr-Nachmittag + Wochenende (Freelancer)
  [
    { dow: 5, start: '15:00', end: '20:00' },
    { dow: 6, start: '09:00', end: '18:00' },
    { dow: 0, start: '09:00', end: '14:00' },
  ],
  // Mo–Do Früh (07–13 Uhr)
  [
    { dow: 1, start: '07:00', end: '13:00' },
    { dow: 2, start: '07:00', end: '13:00' },
    { dow: 3, start: '07:00', end: '13:00' },
    { dow: 4, start: '07:00', end: '13:00' },
  ],
];
// Vertraglich vereinbarte Stunden — variiert pro Trainer
const TRAINER_CONTRACT_HOURS = [8, 10, 12, 15, 20, 25];

async function createTrainerAvailability(trainerUserIds: string[]) {
  const slots: object[] = [];
  for (let i = 0; i < trainerUserIds.length; i++) {
    for (const s of TRAINER_AVAIL_PATTERNS[i % TRAINER_AVAIL_PATTERNS.length]) {
      slots.push({
        user_id: trainerUserIds[i],
        day_of_week: s.dow,
        start_time: s.start,
        end_time: s.end,
        is_available: true,
      });
    }
  }
  const { error } = await supabase.from('trainer_availability').insert(slots);
  if (error) log(`  warn trainer_availability: ${error.message}`);
}

async function createSeason(clubId: string, adminId: string): Promise<string> {
  const { data, error } = await supabase
    .from('seasons')
    .insert({
      club_id: clubId,
      name: 'Sommersaison 2026',
      season_type: 'summer',
      year: 2026,
      start_date: '2026-04-01',
      end_date: '2026-09-30',
      planning_status: 'collecting_preferences',
      preferences_deadline: '2026-03-15',
      preferences_open: true,
      is_active: true,
      created_by: adminId,
    })
    .select('id')
    .single();
  if (error) throw new Error(`season ${clubId}: ${error.message}`);
  return data.id;
}

// Member-Präferenzen: variierte Verfügbarkeiten + Level für realistische KI-Planung
type AvailSlot = { start: string; end: string };
type WeekAvail = Record<
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  AvailSlot[]
>;
const E: AvailSlot[] = [];
const MEMBER_PREFS: Array<{ avail: WeekAvail; level: string; maxPerWeek: number }> = [
  {
    avail: {
      monday: E,
      tuesday: [{ start: '18:00', end: '20:00' }],
      wednesday: E,
      thursday: [{ start: '18:00', end: '20:00' }],
      friday: E,
      saturday: [{ start: '09:00', end: '12:00' }],
      sunday: E,
    },
    level: 'intermediate',
    maxPerWeek: 2,
  },
  {
    avail: {
      monday: [{ start: '08:00', end: '11:00' }],
      tuesday: E,
      wednesday: [{ start: '08:00', end: '11:00' }],
      thursday: E,
      friday: [{ start: '08:00', end: '11:00' }],
      saturday: E,
      sunday: E,
    },
    level: 'beginner',
    maxPerWeek: 2,
  },
  {
    avail: {
      monday: E,
      tuesday: E,
      wednesday: E,
      thursday: E,
      friday: E,
      saturday: [{ start: '09:00', end: '14:00' }],
      sunday: [{ start: '10:00', end: '13:00' }],
    },
    level: 'beginner',
    maxPerWeek: 1,
  },
  {
    avail: {
      monday: [{ start: '09:00', end: '20:00' }],
      tuesday: [{ start: '09:00', end: '20:00' }],
      wednesday: [{ start: '09:00', end: '20:00' }],
      thursday: [{ start: '09:00', end: '20:00' }],
      friday: [{ start: '09:00', end: '20:00' }],
      saturday: [{ start: '09:00', end: '18:00' }],
      sunday: E,
    },
    level: 'advanced',
    maxPerWeek: 3,
  },
  {
    avail: {
      monday: [{ start: '19:00', end: '21:00' }],
      tuesday: E,
      wednesday: [{ start: '19:00', end: '21:00' }],
      thursday: E,
      friday: [{ start: '18:00', end: '21:00' }],
      saturday: E,
      sunday: E,
    },
    level: 'intermediate',
    maxPerWeek: 2,
  },
  {
    avail: {
      monday: E,
      tuesday: [{ start: '09:00', end: '16:00' }],
      wednesday: E,
      thursday: [{ start: '09:00', end: '16:00' }],
      friday: E,
      saturday: [{ start: '09:00', end: '13:00' }],
      sunday: E,
    },
    level: 'beginner',
    maxPerWeek: 2,
  },
];

async function createMemberPreferences(memberUserIds: string[], clubId: string, seasonId: string) {
  const now = new Date().toISOString();
  const prefs = memberUserIds.map((userId, i) => {
    const p = MEMBER_PREFS[i % MEMBER_PREFS.length];
    return {
      user_id: userId,
      club_id: clubId,
      season_id: seasonId,
      user_role: 'member',
      preferred_level: p.level,
      self_assessed_level: p.level,
      weekly_availability: p.avail,
      max_sessions_per_week: p.maxPerWeek,
      is_submitted: true,
      submitted_at: now,
    };
  });
  for (let i = 0; i < prefs.length; i += 50) {
    const { error } = await supabase
      .from('user_training_preferences')
      .insert(prefs.slice(i, i + 50));
    if (error) log(`  warn member_prefs (${i}): ${error.message}`);
  }
}

async function createSeasonPlanningConfig(clubId: string, seasonId: string) {
  await supabase.from('season_planning_configs').insert({
    club_id: clubId,
    season_id: seasonId,
    group_min_size: 1,
    group_max_size: 6,
    kids_group_min_size: 1,
    kids_group_max_size: 6,
    trainer_utilization_max_pct: 100,
    slot_failure_rate_threshold_pct: 20,
    waitlist_priority_rule: 'first_come_first_served',
    ai_clustering_enabled: true,
    prefer_historic_groups: false,
    avoid_high_failure_slots: true,
    slot_duration_minutes: 60,
    max_niveau_span_beginner_months: 12,
    max_niveau_span_advanced_months: 24,
    unassigned_rate_threshold: 0.15,
    backtrack_depth: 5,
    max_niveau_level_steps: 2,
  });
}

async function createCourts(clubId: string, count: number) {
  const { error } = await supabase.from('courts').insert(
    Array.from({ length: count }, (_, i) => ({
      club_id: clubId,
      name: `Platz ${i + 1}`,
      surface: ['Sand', 'Sand', 'Hartplatz', 'Rasen'][i % 4],
      has_indoor: i >= count - 2,
      is_active: true,
    }))
  );
  if (error) log(`  warn courts: ${error.message}`);
}

async function seedClub(
  club: { id: string; name: string },
  adminEmail: string,
  adminName: string,
  trainerAuthCount: number,
  trainerTotalCount: number,
  memberTotalCount: number,
  trainerDomain: string,
  memberDomain: string,
  extraMemberships?: Array<{ userId: string; role: string }>,
  courtCount = 6
): Promise<{ adminId: string; trainerUserIds: string[]; memberUserIds: string[] }> {
  console.log(`\n🎾  ${club.name}`);

  const adminId = await createAuthUser(adminEmail, adminName);
  await addMembership(adminId, club.id, 'admin');
  log(`✓ Admin: ${adminEmail}`);

  for (const m of extraMemberships ?? []) {
    await addMembership(m.userId, club.id, m.role);
  }

  const trainerUserIds: string[] = [];

  for (let i = 1; i <= trainerAuthCount; i++) {
    const email = `trainer.${i}@${trainerDomain}`;
    const { firstName, lastName } = nextName();
    const uid = await createAuthUser(email, `${firstName} ${lastName}`);
    await addMembership(uid, club.id, 'trainer');
    await createTrainer(uid, `${firstName} ${lastName}`, email, club.id);
    trainerUserIds.push(uid);
  }
  log(`✓ Trainer 1-${trainerAuthCount} (mit Login)`);

  for (let i = trainerAuthCount + 1; i <= trainerTotalCount; i++) {
    const email = `trainer.${i}@${trainerDomain}`;
    const { firstName, lastName } = nextName();
    const uid = await createDbUser(email, `${firstName} ${lastName}`);
    await addMembership(uid, club.id, 'trainer');
    await createTrainer(uid, `${firstName} ${lastName}`, email, club.id);
    trainerUserIds.push(uid);
  }
  log(`✓ Trainer ${trainerAuthCount + 1}-${trainerTotalCount} (DB-only)`);

  const { firstName: mfn, lastName: mln } = nextName();
  const member1Id = await createAuthUser(`mitglied.1@${memberDomain}`, `${mfn} ${mln}`);
  await addMembership(member1Id, club.id, 'member');
  log(`✓ Mitglied 1 (mit Login): mitglied.1@${memberDomain}`);

  const memberRows = [];
  for (let i = 2; i <= memberTotalCount; i++) {
    const { firstName, lastName } = nextName();
    memberRows.push({
      email: toEmail(firstName, lastName, memberDomain, i),
      full_name: `${firstName} ${lastName}`,
    });
  }
  const { data: mUsers, error: mErr } = await supabase
    .from('users')
    .insert(memberRows)
    .select('id');
  if (mErr) throw new Error(`members ${club.name}: ${mErr.message}`);
  const allMemberIds = [member1Id, ...mUsers!.map((u) => u.id)];
  await supabase.from('user_club_memberships').insert(
    mUsers!.map((u) => ({
      user_id: u.id,
      club_id: club.id,
      role: 'member',
      is_active: true,
      joined_at: new Date().toISOString(),
    }))
  );
  log(`✓ Mitglieder 1-${memberTotalCount}`);

  await createCourts(club.id, courtCount);
  log(`✓ ${courtCount} Plätze angelegt`);

  return { adminId, trainerUserIds, memberUserIds: allMemberIds };
}

async function main() {
  console.log('🚀 SwingZ Seed — 3 Clubs');
  console.log('=========================');

  await cleanup();
  const [rheinland, muenster, dortmund] = await createClubs();

  // ── TC Rheinland ─────────────────────────────────────────────────────
  const rh = await seedClub(
    rheinland,
    'admin@rheinland-tennis.de',
    'Klaus Weber',
    3,
    12,
    150,
    'tc-rheinland.de',
    'tc-rheinland.de',
    [],
    8
  );
  const rhSeasonId = await createSeason(rheinland.id, rh.adminId);
  await createTrainerAvailability(rh.trainerUserIds);
  await createMemberPreferences(rh.memberUserIds, rheinland.id, rhSeasonId);
  await createSeasonPlanningConfig(rheinland.id, rhSeasonId);
  log(`✓ Saison + Verfügbarkeiten + Member-Präferenzen (TC Rheinland)`);

  // ── TS Westfalen ──────────────────────────────────────────────────────
  const superadminId = await createAuthUser('superadmin@ts-westfalen.de', 'Heinrich Braun');
  log(`✓ Superadmin: superadmin@ts-westfalen.de`);

  const ms = await seedClub(
    muenster,
    'admin@tc-muenster.de',
    'Petra Hoffmann',
    1,
    10,
    120,
    'tc-muenster.de',
    'tc-muenster.de',
    [{ userId: superadminId, role: 'superadmin' }],
    6
  );
  const msSeasonId = await createSeason(muenster.id, ms.adminId);
  await createTrainerAvailability(ms.trainerUserIds);
  await createMemberPreferences(ms.memberUserIds, muenster.id, msSeasonId);
  await createSeasonPlanningConfig(muenster.id, msSeasonId);
  log(`✓ Saison + Verfügbarkeiten + Member-Präferenzen (TC Münster)`);

  const do_ = await seedClub(
    dortmund,
    'admin@tsv-dortmund.de',
    'Wolfgang Schulz',
    1,
    10,
    130,
    'tsv-dortmund.de',
    'tsv-dortmund.de',
    [{ userId: superadminId, role: 'superadmin' }],
    7
  );
  const doSeasonId = await createSeason(dortmund.id, do_.adminId);
  await createTrainerAvailability(do_.trainerUserIds);
  await createMemberPreferences(do_.memberUserIds, dortmund.id, doSeasonId);
  await createSeasonPlanningConfig(dortmund.id, doSeasonId);
  log(`✓ Saison + Verfügbarkeiten + Member-Präferenzen (TSV Dortmund)`);

  console.log('\n✅  Seed abgeschlossen!');
  console.log('\n📋  Login-Accounts (Passwort: Test2026!)');
  console.log('─────────────────────────────────────────────────');
  console.log('  admin@swingz.com              → owner');
  console.log('  admin@rheinland-tennis.de         → admin  (TC Rheinland)');
  console.log('  trainer.1-3@tc-rheinland.de   → trainer (TC Rheinland)');
  console.log('  mitglied.1@tc-rheinland.de    → member  (TC Rheinland)');
  console.log('  superadmin@ts-westfalen.de    → superadmin (beide TS-Clubs)');
  console.log('  admin@tc-muenster.de          → admin  (TC Münster)');
  console.log('  trainer.1@tc-muenster.de      → trainer (TC Münster)');
  console.log('  mitglied.1@tc-muenster.de     → member  (TC Münster)');
  console.log('  admin@tsv-dortmund.de         → admin  (TSV Dortmund)');
  console.log('  trainer.1@tsv-dortmund.de     → trainer (TSV Dortmund)');
  console.log('  mitglied.1@tsv-dortmund.de    → member  (TSV Dortmund)');
}

main().catch((err) => {
  console.error('\n❌ Seed fehlgeschlagen:', err.message ?? err);
  process.exit(1);
});
