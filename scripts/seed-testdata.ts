#!/usr/bin/env npx tsx
/**
 * Einzige Quelle für Testdaten. Ersetzt die 14 alten seed-*-Skripte.
 *
 * LANE-KONZEPT
 * ------------
 * Testvereine gehören genau einer "Lane" — dem Eigentümer der Daten:
 *
 *   user   → Spielwiese des Menschen. Ein Agent (Claude & Co.) fasst diese
 *            Vereine NIE schreibend an. E-Mail-Domain: *.swingz.test
 *   agent  → Spielwiese der KI. Hier wird getestet, kaputtgemacht und
 *            zurückgesetzt. E-Mail-Domain: *.claude.test
 *
 * Dadurch kann jede Seite ihren eigenen Sandkasten zurücksetzen, ohne die
 * Daten der anderen zu zerstören:
 *
 *   npx tsx scripts/seed-testdata.ts                    Ist-Zustand zeigen, nichts ändern
 *   npx tsx scripts/seed-testdata.ts --docs-only        nur Zugangsdaten-Doku neu, keine Datenänderung
 *   npx tsx scripts/seed-testdata.ts --lane=agent --yes  nur Claude-Vereine neu
 *   npx tsx scripts/seed-testdata.ts --lane=user  --yes  nur Nutzer-Vereine neu
 *   npx tsx scripts/seed-testdata.ts --all        --yes  DB komplett platt + alles neu
 *
 * --all löscht ALLE Vereine, Nutzer und Auth-Accounts außer dem Owner.
 * Global-Referenzdaten (Schulferien, Basiszinssätze, globale system_settings)
 * bleiben erhalten.
 *
 * Nach jedem Lauf wird docs/TEST-CREDENTIALS.md neu geschrieben — die Doku kann
 * also nicht vom echten DB-Zustand abweichen.
 */
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ── Konfiguration ─────────────────────────────────────────────────────────

/** Einheitliches Passwort aller Seed-Accounts. Nur Testdaten, nie Produktion. */
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'SwingZ-Test-2026!';

/** Der einzige echte Zugang — wird nie gelöscht. */
const OWNER_EMAIL = 'admin@swingz.com';

/**
 * Tabellen, die ein Reset nie anfassen darf: globale Referenzdaten — und
 * `schema_migrations`, sonst löscht jeder Seed-Lauf die Migrations-Buchführung
 * und die DB behauptet danach, keine Migration sei je angewendet worden.
 */
const GLOBAL_TABLES = ['school_holidays', 'base_interest_rates', 'schema_migrations'];

type Lane = 'user' | 'agent';

interface ClubSpec {
  key: string;
  name: string;
  city: string;
  bundesland: string;
  domain: string;
  lane: Lane;
  purpose: string;
  /** null = kein eigener Admin, wird vom Superadmin mitverwaltet */
  adminLocal: string | null;
  courts: number;
  trainers: number;
  members: number;
  /** Wie viele Mitglieder einen echten Login bekommen (Rest nur DB-Profil). */
  memberLogins: number;
  season: 'none' | 'draft' | 'collecting_preferences' | 'manual_review' | 'published';
  preferences: boolean;
  finance: boolean;
  /** Zusätzlich aktivierte optionale Module (Core-Module sind immer an). */
  extraFeatures: string[];
  /**
   * Optionales Mitglied mit echter DTB-ID aus einer öffentlichen nuLiga-
   * Meldeliste — Fixture für den Liga-Kader-Import (nur Agent-Lane).
   */
  leagueTester?: { email: string; name: string; dtbId: string };
}

const CLUBS: ClubSpec[] = [
  {
    key: 'rheinland',
    name: 'TC Rheinland e.V.',
    city: 'Düsseldorf',
    bundesland: 'Nordrhein-Westfalen',
    domain: 'tc-rheinland.swingz.test',
    lane: 'user',
    purpose: 'Vollverein — laufende Saison, alle Kernmodule bestückt. Hauptdemo.',
    adminLocal: 'admin',
    courts: 6,
    trainers: 6,
    members: 60,
    memberLogins: 3,
    season: 'published',
    preferences: true,
    finance: true,
    extraFeatures: ['trial_training', 'partner_finder', 'league_lineup'],
  },
  {
    key: 'dortmund',
    name: 'TSV Dortmund',
    city: 'Dortmund',
    bundesland: 'Nordrhein-Westfalen',
    domain: 'tsv-dortmund.swingz.test',
    lane: 'user',
    purpose: 'Mittlerer Verein in der Präferenz-Erfassung. Testfall Mitglieder-Wünsche.',
    adminLocal: 'admin',
    courts: 4,
    trainers: 3,
    members: 25,
    memberLogins: 3,
    season: 'collecting_preferences',
    preferences: true,
    finance: true,
    extraFeatures: ['trial_training'],
  },
  {
    key: 'bochum',
    name: 'SV Bochum 08',
    city: 'Bochum',
    bundesland: 'Nordrhein-Westfalen',
    domain: 'sv-bochum.swingz.test',
    lane: 'user',
    purpose:
      'Kleiner Verein OHNE eigenen Admin — nur über Superadmin erreichbar. Testfall Club-Switcher.',
    adminLocal: null,
    courts: 3,
    trainers: 2,
    members: 12,
    memberLogins: 2,
    season: 'draft',
    preferences: false,
    finance: false,
    extraFeatures: [],
  },
  {
    key: 'koeln',
    name: 'TC Grün-Weiß Köln',
    city: 'Köln',
    bundesland: 'Nordrhein-Westfalen',
    domain: 'tc-gw-koeln.swingz.test',
    lane: 'user',
    purpose:
      'Fertig geplante Saison kurz vor der Veröffentlichung + Finanzen. Testfall Publish-Übergang.',
    adminLocal: 'admin',
    courts: 4,
    trainers: 3,
    members: 20,
    memberLogins: 2,
    season: 'manual_review',
    preferences: true,
    finance: true,
    extraFeatures: ['shop', 'work_duty'],
  },
  {
    key: 'neuland',
    name: 'TC Neuland e.V.',
    city: 'Essen',
    bundesland: 'Nordrhein-Westfalen',
    domain: 'tc-neuland.swingz.test',
    lane: 'user',
    purpose:
      'KOMPLETT LEER — nur Verein + Admin-Login. Für den Erstlogin/Onboarding von Hand. NICHT bestücken.',
    adminLocal: 'admin',
    courts: 0,
    trainers: 0,
    members: 0,
    memberLogins: 0,
    season: 'none',
    preferences: false,
    finance: false,
    extraFeatures: [],
  },
  {
    key: 'claude-alpha',
    name: 'Claude Sandbox Alpha',
    city: 'Testhausen',
    bundesland: 'Nordrhein-Westfalen',
    domain: 'alpha.claude.test',
    lane: 'agent',
    purpose:
      'Arbeitsverein der KI — bestückt, laufende Saison mit Sessions und Buchungen. Hier testet und ändert ausschließlich Claude.',
    adminLocal: 'admin',
    courts: 4,
    trainers: 3,
    members: 20,
    memberLogins: 2,
    // Von `manual_review` auf `published` gewechselt: den Review-Übergang
    // deckt TC Grün-Weiß Köln in der Nutzer-Lane bereits ab. Ein Arbeitsverein
    // mit laufender Saison ist als Agenten-Sandkasten nützlicher — nur so
    // entstehen überhaupt Sessions und Buchungen zum Anschauen.
    season: 'published',
    preferences: true,
    finance: true,
    extraFeatures: ['trial_training', 'league_lineup'],
    // DTB-ID aus einer öffentlichen RLSW-Meldeliste — Fixture für
    // tests/e2e/league-real-sync.spec.ts (Kader-Import mit echten Daten).
    leagueTester: {
      email: 'ann-katrin.fries@alpha.claude.test',
      name: 'Ann-Katrin Fries',
      dtbId: '29100829',
    },
  },
  {
    key: 'claude-beta',
    name: 'Claude Sandbox Beta',
    city: 'Testhausen',
    bundesland: 'Nordrhein-Westfalen',
    domain: 'beta.claude.test',
    lane: 'agent',
    purpose: 'Leerer Zweitverein der KI — für Onboarding-, Migrations- und CSV-Import-Tests.',
    adminLocal: 'admin',
    courts: 0,
    trainers: 0,
    members: 0,
    memberLogins: 0,
    season: 'none',
    preferences: false,
    finance: false,
    extraFeatures: [],
  },
];

/**
 * Superadmins verwalten mehrere Vereine (Tennisschule-Rolle). Jede Lane hat
 * einen eigenen — sonst müssten die E2E-Tests in fremde Vereine greifen.
 */
const SUPERADMINS = [
  {
    email: 'superadmin@ts-westfalen.swingz.test',
    name: 'Sabine Westfalen',
    clubs: ['dortmund', 'bochum'],
    lane: 'user' as Lane,
  },
  {
    email: 'superadmin@claude.test',
    name: 'Claude Superadmin',
    clubs: ['claude-alpha', 'claude-beta'],
    lane: 'agent' as Lane,
  },
];

// ── Stammdaten-Generatoren (deterministisch) ──────────────────────────────

const FIRST = [
  'Lukas',
  'Marie',
  'Jonas',
  'Anna',
  'Felix',
  'Lea',
  'Paul',
  'Emma',
  'Tim',
  'Sophie',
  'Max',
  'Laura',
  'Ben',
  'Mia',
  'Noah',
  'Hannah',
  'Elias',
  'Lina',
  'Finn',
  'Clara',
];
const LAST = [
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
  'Koch',
  'Bauer',
  'Richter',
  'Klein',
  'Wolf',
  'Schröder',
  'Neumann',
  'Braun',
  'Werner',
  'Krüger',
];

const LEVELS = ['beginner', 'intermediate', 'advanced', 'professional'] as const;
const AGE_GROUPS = ['youth', 'adult', 'senior'] as const;
const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

function person(i: number) {
  // Beide Namensteile dürfen nicht nur von (i mod 20) abhängen — sonst gibt es
  // trotz zweier 20er-Listen nur 20 verschiedene Namen und in einem 60er-Verein
  // heißt jeder Dritte gleich. Der `floor(i/20)`-Term verschiebt die Nachnamen
  // pro Runde um eins: 20 × 20 = 400 unterschiedliche Kombinationen.
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length];
  return { first, last, name: `${first} ${last}` };
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Geburtsdatum passend zur Altersgruppe — youth muss wirklich minderjährig sein. */
function birthDate(ageGroup: string, i: number): string {
  const age =
    ageGroup === 'youth' ? 8 + (i % 9) : ageGroup === 'senior' ? 60 + (i % 15) : 22 + (i % 35);
  return `${2026 - age}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`;
}

/** Verfügbarkeit: 2–4 Wochentage mit realistischen Abendslots. */
function weeklyAvailability(
  i: number,
  isTrainer = false
): Record<string, { start: string; end: string }[]> {
  const out: Record<string, { start: string; end: string }[]> = Object.fromEntries(
    DAYS.map((d) => [d, [] as { start: string; end: string }[]])
  );
  const dayCount = isTrainer ? 5 : 2 + (i % 3);
  for (let n = 0; n < dayCount; n++) {
    const day = DAYS[(i + n * 2) % 5]; // Mo–Fr
    out[day] = isTrainer
      ? [{ start: '14:00', end: '21:00' }]
      : [{ start: `${16 + (i % 3)}:00`, end: `${19 + (i % 3)}:00` }];
  }
  if (i % 4 === 0) out.saturday = [{ start: '09:00', end: '13:00' }];
  return out;
}

const OPENING_HOURS = {
  monday: { open: '07:00', close: '22:00' },
  tuesday: { open: '07:00', close: '22:00' },
  wednesday: { open: '07:00', close: '22:00' },
  thursday: { open: '07:00', close: '22:00' },
  friday: { open: '07:00', close: '22:00' },
  saturday: { open: '08:00', close: '20:00' },
  sunday: { open: '09:00', close: '18:00' },
};

// ── Infrastruktur ─────────────────────────────────────────────────────────

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.DATABASE_SSL === 'require' ? 'require' : false,
  max: 4,
  prepare: false,
});

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const log = (msg: string) => console.log(msg);

/** Anlegen eines echten Login-Accounts + Profilzeile. Gibt die user_id zurück. */
async function createLogin(email: string, fullName: string, extra: Record<string, unknown> = {}) {
  let { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  // Leiche aus einem abgebrochenen Lauf: entfernen und neu anlegen, statt den
  // gesamten Seed an einem einzelnen Restaccount scheitern zu lassen.
  if (error?.message?.includes('already been registered')) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const stale = list?.users?.find((u) => u.email === email);
    if (stale) await admin.auth.admin.deleteUser(stale.id);
    ({ data, error } = await admin.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }));
  }

  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
  const id = data.user.id;
  await sql`insert into users ${sql({ id, email, full_name: fullName, ...extra })}
            on conflict (id) do update set full_name = excluded.full_name`;
  return id;
}

/** Profilzeile ohne Login — für Massen-Mitglieder. */
async function createProfile(email: string, fullName: string, extra: Record<string, unknown> = {}) {
  const [row] = await sql<{ id: string }[]>`
    insert into users ${sql({ email, full_name: fullName, ...extra })} returning id`;
  return row.id;
}

async function addMembership(userId: string, clubId: string | null, role: string, extra = {}) {
  await sql`insert into user_club_memberships ${sql({
    user_id: userId,
    club_id: clubId,
    role,
    is_active: true,
    ...extra,
  })}`;
}

// ── Wipe ──────────────────────────────────────────────────────────────────

/** Kompletter Reset: alles außer Owner und globalen Referenzdaten. */
async function wipeAll() {
  log('\n🗑️  Kompletter Reset...');

  const [found] = await sql<
    { id: string }[]
  >`select id from auth.users where email = ${OWNER_EMAIL}`;

  // Auf einer frischen DB (lokaler Stack) existiert der Owner noch nicht. Er war
  // der einzige Account, den der Seed voraussetzte statt ihn anzulegen — damit
  // war ein lokales Erstsetup nicht möglich.
  let owner = found;
  if (!owner) {
    log(`  Owner ${OWNER_EMAIL} fehlt — wird angelegt`);
    owner = { id: await createLogin(OWNER_EMAIL, 'Platform Owner') };
  } else {
    await sql`insert into users ${sql({ id: owner.id, email: OWNER_EMAIL, full_name: 'Platform Owner' })}
              on conflict (id) do nothing`;
  }

  const tables = await sql<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> all(${GLOBAL_TABLES})`;
  const list = tables.map((t) => `public."${t.tablename}"`).join(', ');

  // Alles in EINER Transaktion: der Supavisor poolt im Transaction-Mode, außerhalb
  // einer Transaktion landet jedes Statement potenziell auf einer anderen
  // Backend-Connection — Temp-Tabellen wären dann unsichtbar bzw. blieben liegen.
  await sql.begin(async (tx) => {
    // Reste eines abgebrochenen Laufs, die auf einer gepoolten Connection liegen.
    await tx`drop table if exists _keep_user, _keep_settings, _keep_court_types`;

    // Globale Zeilen retten: TRUNCATE ... CASCADE würde sie über FKs mitreißen.
    await tx`create temp table _keep_user on commit drop as
             select * from users where id = ${owner.id}`;
    await tx`create temp table _keep_settings on commit drop as
             select * from system_settings where club_id is null`;
    await tx`create temp table _keep_court_types on commit drop as
             select * from court_types where club_id is null`;

    // Ein TRUNCATE über alle Tabellen gleichzeitig — CASCADE-Reihenfolge egal.
    await tx.unsafe(`truncate table ${list} restart identity cascade`);

    await tx`insert into users select * from _keep_user`;
    await tx`insert into system_settings select * from _keep_settings`;
    await tx`insert into court_types select * from _keep_court_types`;
    await tx`insert into user_club_memberships ${tx({
      user_id: owner.id,
      club_id: null,
      role: 'owner',
      is_active: true,
    })}`;
  });
  log(`  ${tables.length} Tabellen geleert`);
  log('  Owner + globale Referenzdaten wiederhergestellt');

  const del = await sql`delete from auth.users where id <> ${owner.id} returning id`;
  log(`  ${del.length} Auth-Accounts gelöscht`);
}

/** Nur eine Lane zurücksetzen — die andere bleibt unangetastet. */
async function wipeLane(lane: Lane) {
  log(`\n🗑️  Reset Lane "${lane}"...`);
  const names = CLUBS.filter((c) => c.lane === lane).map((c) => c.name);
  const clubs = await sql<{ id: string }[]>`select id from clubs where name = any(${names})`;
  const ids = clubs.map((c) => c.id);

  // Ohne führenden Punkt: erwischt auch Accounts direkt auf der Domain
  // (superadmin@claude.test), nicht nur auf Subdomains (admin@alpha.claude.test).
  const suffix = lane === 'agent' ? 'claude.test' : 'swingz.test';
  const emailPattern = `%@%${suffix}`;

  if (ids.length) {
    // Generisch statt Handliste: jede Tabelle mit club_id wird lane-scoped geleert.
    const scoped = await sql<{ table_name: string }[]>`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'club_id'`;
    for (const { table_name } of scoped) {
      // ponytail: Reihenfolge ignoriert, FK-Fehler werden geschluckt und in
      // Runde 2 aufgelöst. Bei tieferen FK-Ketten auf topologische Sortierung
      // umstellen.
      for (let round = 0; round < 2; round++) {
        try {
          await sql.unsafe(`delete from public."${table_name}" where club_id = any($1)`, [ids]);
          break;
        } catch {
          /* nächste Runde */
        }
      }
    }
  }

  // Tabellen, die `users` referenzieren, aber ohne club_id leben (z. B.
  // audit_logs.actor_id mit club_id=NULL, decision_votes.voter_id,
  // family_accounts.user_id). Die club_id-Schleife oben erwischt sie nicht —
  // ohne diesen Pass scheitert `delete from users` am FK.
  // Attributions-FKs („wer hat's getan") werden nur genullt statt gelöscht —
  // sonst löscht man bei clubs.deleted_by den fremden Verein mit.
  const ATTRIBUTION_COLUMNS = new Set([
    'actor_id',
    'author_id',
    'approved_by',
    'created_by',
    'deactivated_by',
    'deleted_by',
    'dispute_resolved_by',
    'moderated_by',
    'organizer_id',
    'recorded_by',
    'resolved_by',
    'reviewed_by',
    'substitute_trainer_id',
    'updated_by',
  ]);
  const userFks = await sql<{ table_name: string; column_name: string }[]>`
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.constraint_schema = tc.constraint_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.constraint_schema = tc.constraint_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_name = 'users'`;
  for (const { table_name, column_name } of userFks) {
    const laneUsers = `(select id from users where email like $1)`;
    if (ATTRIBUTION_COLUMNS.has(column_name)) {
      try {
        await sql.unsafe(
          `update public."${table_name}" set "${column_name}" = null where "${column_name}" in ${laneUsers}`,
          [emailPattern]
        );
      } catch {
        // NOT NULL-Attribution (z. B. board_decisions.created_by): die Zeile
        // gehört ohnehin dem Verein — löschen statt nullen.
        await sql.unsafe(
          `delete from public."${table_name}" where "${column_name}" in ${laneUsers}`,
          [emailPattern]
        );
      }
    } else {
      await sql.unsafe(
        `delete from public."${table_name}" where "${column_name}" in ${laneUsers}`,
        [emailPattern]
      );
    }
  }

  await sql`delete from trainers where email like ${emailPattern}`;
  await sql`delete from users where email like ${emailPattern}`;
  if (ids.length) await sql`delete from clubs where id = any(${ids})`;

  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const victims = (data?.users ?? []).filter((u) => u.email?.endsWith(suffix));
  for (const u of victims) await admin.auth.admin.deleteUser(u.id);
  log(`  ${ids.length} Vereine, ${victims.length} Auth-Accounts gelöscht`);
}

// ── Seed ──────────────────────────────────────────────────────────────────

interface SeededAccount {
  role: string;
  email: string;
  name: string;
  note?: string;
}

async function seedClub(spec: ClubSpec): Promise<{ clubId: string; accounts: SeededAccount[] }> {
  const accounts: SeededAccount[] = [];
  log(`\n🎾 ${spec.name} (${spec.lane})`);

  const features: Record<string, boolean> = {
    members: true,
    trainers: true,
    seasons: true,
    finance: true,
  };
  for (const f of spec.extraFeatures) features[f] = true;

  const [club] = await sql<{ id: string }[]>`
    insert into clubs ${sql({
      name: spec.name,
      slug: slugify(spec.name),
      city: spec.city,
      bundesland: spec.bundesland,
      address: `Am Tennisplatz ${1 + (spec.courts || 1)}, ${spec.city}`,
      email: `info@${spec.domain}`,
      phone: '+49 211 1234567',
      opening_hours: OPENING_HOURS,
      features,
      description: spec.purpose,
      max_members: Math.max(50, spec.members * 3),
      // Der leere Verein muss das Onboarding noch durchlaufen.
      setup_completed_at: spec.members === 0 ? null : new Date().toISOString(),
    })} returning id`;
  const clubId = club.id;

  // ── Admin ───────────────────────────────────────────────────────────
  if (spec.adminLocal) {
    const email = `${spec.adminLocal}@${spec.domain}`;
    const name = `Admin ${spec.name}`;
    const uid = await createLogin(email, name);
    await addMembership(uid, clubId, 'admin');
    accounts.push({ role: 'admin', email, name });
    log(`  Admin: ${email}`);
  } else {
    log('  Kein eigener Admin (nur über Superadmin erreichbar)');
  }

  if (spec.courts === 0 && spec.members === 0) {
    log('  → bewusst leer gelassen');
    return { clubId, accounts };
  }

  // ── Plätze ──────────────────────────────────────────────────────────
  const courtIds: string[] = [];
  for (let i = 1; i <= spec.courts; i++) {
    const [c] = await sql<{ id: string }[]>`
      insert into courts ${sql({
        club_id: clubId,
        name: `Platz ${i}`,
        number: i,
        surface: i <= spec.courts - 1 ? 'clay' : 'hard',
        has_indoor: i > spec.courts - 2,
        has_lighting: i % 2 === 0,
        usable_for_training: true,
      })} returning id`;
    courtIds.push(c.id);
  }
  log(`  ${courtIds.length} Plätze`);

  // ── Beitragskategorien ──────────────────────────────────────────────
  const feeIds: Record<string, string> = {};
  if (spec.finance) {
    const fees = [
      { name: 'Erwachsene', type: 'membership', amount: 240, billing_cycle: 'yearly' },
      { name: 'Jugend (bis 18)', type: 'membership', amount: 90, billing_cycle: 'yearly' },
      { name: 'Senioren', type: 'membership', amount: 180, billing_cycle: 'yearly' },
      { name: 'Trainingsbeitrag Gruppe', type: 'training', amount: 45, billing_cycle: 'monthly' },
    ];
    for (const f of fees) {
      const [row] = await sql<{ id: string }[]>`
        insert into fee_configurations ${sql({ club_id: clubId, ...f, is_active: true })} returning id`;
      feeIds[f.name] = row.id;
    }
    log(`  ${fees.length} Beitragskategorien`);
  }

  // ── Trainer ─────────────────────────────────────────────────────────
  const trainerIds: string[] = [];
  for (let i = 0; i < spec.trainers; i++) {
    const p = person(i + 100);
    const email = `trainer${i + 1}@${spec.domain}`;
    const uid = await createLogin(email, p.name, { skill_level: 'professional' });
    await addMembership(uid, clubId, 'trainer');

    const [t] = await sql<{ id: string }[]>`
      insert into trainers ${sql({
        email,
        name: p.name,
        user_id: uid,
        specialties: JSON.stringify([LEVELS[i % LEVELS.length], AGE_GROUPS[i % AGE_GROUPS.length]]),
        max_hours_per_week: 20 + (i % 3) * 5,
        is_active: true,
      })} returning id`;
    trainerIds.push(t.id);

    await sql`insert into trainer_club ${sql({ trainer_id: t.id, club_id: clubId })}`;
    await sql`insert into trainer_profiles ${sql({
      club_id: clubId,
      user_id: uid,
      first_name: p.first,
      last_name: p.last,
      email,
      phone: `+49 170 ${1000000 + i}`,
      date_of_birth: birthDate('adult', i + 5),
      bio: `Lizenzierte:r Tennistrainer:in mit Schwerpunkt ${LEVELS[i % LEVELS.length]}.`,
      qualifications: JSON.stringify(['DTB C-Lizenz', ...(i % 2 ? ['DTB B-Lizenz'] : [])]),
      specializations: JSON.stringify([AGE_GROUPS[i % AGE_GROUPS.length]]),
      hourly_rate: 35 + (i % 4) * 5,
      contracted_hourly_rate: 30 + (i % 4) * 5,
      status: 'active',
      availability: JSON.stringify({
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: i % 2 === 0,
        sunday: false,
      }),
    })}`;

    // Wiederkehrende Verfügbarkeit Mo–Fr
    for (let d = 0; d < 5; d++) {
      const date = new Date(Date.UTC(2026, 3, 6 + d)); // KW 15/2026, Mo–Fr
      await sql`insert into trainer_availabilities ${sql({
        trainer_id: t.id,
        date: date.toISOString(),
        start_time: '14:00',
        end_time: '21:00',
        status: 'available',
        recurring_pattern: JSON.stringify({ type: 'weekly', interval: 1 }),
      })}`;
    }
    accounts.push({ role: 'trainer', email, name: p.name });
  }
  if (spec.trainers) log(`  ${spec.trainers} Trainer (alle mit Login + Verfügbarkeit)`);

  // ── Mitglieder ──────────────────────────────────────────────────────
  const memberIds: string[] = [];
  const memberMeta: { id: string; level: string; ageGroup: string }[] = [];
  for (let i = 0; i < spec.members; i++) {
    const p = person(i);
    const ageGroup = AGE_GROUPS[i % 3 === 0 ? 0 : i % 7 === 0 ? 2 : 1];
    const level = LEVELS[i % LEVELS.length];
    const hasLogin = i < spec.memberLogins;
    const email = hasLogin
      ? `mitglied${i + 1}@${spec.domain}`
      : `${slugify(p.first)}.${slugify(p.last)}${i}@${spec.domain}`;

    const profile = {
      phone: `+49 171 ${2000000 + i}`,
      city: spec.city,
      date_of_birth: birthDate(ageGroup, i),
      skill_level: level,
      experience_months: (i % 8) * 12,
    };
    const uid = hasLogin
      ? await createLogin(email, p.name, profile)
      : await createProfile(email, p.name, profile);

    const feeName =
      ageGroup === 'youth' ? 'Jugend (bis 18)' : ageGroup === 'senior' ? 'Senioren' : 'Erwachsene';
    await addMembership(uid, clubId, 'member', {
      fee_configuration_id: spec.finance ? feeIds[feeName] : null,
      include_in_planning: true,
    });

    memberIds.push(uid);
    memberMeta.push({ id: uid, level, ageGroup });
    if (hasLogin) accounts.push({ role: 'member', email, name: p.name });
  }
  if (spec.members) {
    log(`  ${spec.members} Mitglieder (${spec.memberLogins} mit Login, Rest nur Profil)`);
  }

  // ── Liga-Testspielerin ──────────────────────────────────────────────
  // Ein Mitglied, dessen DTB-ID exakt einem Eintrag in einer ÖFFENTLICHEN
  // nuLiga-Meldeliste entspricht. Nur damit lässt sich der Kader-Import samt
  // Zuordnung gegen echte Verbandsdaten prüfen (tests/e2e/league-real-sync).
  if (spec.leagueTester) {
    const t = spec.leagueTester;
    const uid = await createLogin(t.email, t.name, { dtb_id: t.dtbId, city: spec.city });
    await addMembership(uid, clubId, 'member', { include_in_planning: true });
    memberIds.push(uid);
    accounts.push({ role: 'member', email: t.email, name: t.name });
    log(`  Liga-Testspielerin ${t.name} (DTB-ID ${t.dtbId})`);
  }

  // ── Gruppen ─────────────────────────────────────────────────────────
  const groupIds: string[] = [];
  if (spec.members >= 8) {
    const combos: { level: string; ageGroup: string }[] = [
      { level: 'beginner', ageGroup: 'youth' },
      { level: 'intermediate', ageGroup: 'youth' },
      { level: 'beginner', ageGroup: 'adult' },
      { level: 'intermediate', ageGroup: 'adult' },
      { level: 'advanced', ageGroup: 'adult' },
      { level: 'intermediate', ageGroup: 'senior' },
    ];
    const labelAge: Record<string, string> = {
      youth: 'Jugend',
      adult: 'Erwachsene',
      senior: 'Senioren',
    };
    const labelLvl: Record<string, string> = {
      beginner: 'Anfänger',
      intermediate: 'Fortgeschritten',
      advanced: 'Leistung',
      professional: 'Elite',
    };
    for (const c of combos) {
      const mem = memberMeta
        .filter((m) => m.level === c.level && m.ageGroup === c.ageGroup)
        .slice(0, 8)
        .map((m) => m.id);
      if (mem.length < 2) continue;
      const [g] = await sql<{ id: string }[]>`
        insert into groups ${sql({
          club_id: clubId,
          name: `${labelAge[c.ageGroup]} ${labelLvl[c.level]}`,
          level: c.level,
          age_group: c.ageGroup,
          max_members: c.ageGroup === 'youth' ? 6 : 10,
          max_size: c.ageGroup === 'youth' ? 6 : 10,
          member_ids: JSON.stringify(mem),
          is_active: true,
        })} returning id`;
      groupIds.push(g.id);
    }
    log(`  ${groupIds.length} Trainingsgruppen`);
  }

  // ── Saison ──────────────────────────────────────────────────────────
  if (spec.season !== 'none') {
    // DB-Constraint: preferences_deadline <= start_date. Wer jetzt (August)
    // Präferenzen sammelt, sammelt für die Wintersaison — sonst läge die
    // Deadline zwangsläufig in der Vergangenheit.
    const isOpen = spec.season === 'collecting_preferences';
    const seasonDef = isOpen
      ? {
          name: 'Wintersaison 2026/27',
          season_type: 'winter',
          year: 2026,
          start_date: '2026-10-01',
          end_date: '2027-03-31',
          deadline: '2026-09-15',
        }
      : {
          name: 'Sommersaison 2026',
          season_type: 'summer',
          year: 2026,
          start_date: '2026-04-01',
          end_date: '2026-09-30',
          deadline: '2026-03-15',
        };

    const [season] = await sql<{ id: string }[]>`
      insert into seasons ${sql({
        club_id: clubId,
        name: seasonDef.name,
        season_type: seasonDef.season_type,
        year: seasonDef.year,
        start_date: seasonDef.start_date,
        end_date: seasonDef.end_date,
        planning_status: spec.season,
        preferences_open: isOpen,
        preferences_deadline: seasonDef.deadline,
        auto_plan_enabled: true,
        is_active: spec.season === 'published',
        published_at: spec.season === 'published' ? new Date().toISOString() : null,
        description: `Saison im Status "${spec.season}".`,
      })} returning id`;

    await sql`insert into season_planning_configs ${sql({
      club_id: clubId,
      season_id: season.id,
      group_min_size: 3,
      group_max_size: 10,
      kids_group_max_size: 6,
      slot_duration_minutes: 90,
    })}`;

    // Stundenplan-Einträge nur, wenn geplant wurde. day_of_week: 0 = Montag.
    if (
      ['manual_review', 'published'].includes(spec.season) &&
      trainerIds.length &&
      groupIds.length
    ) {
      let n = 0;
      for (const groupId of groupIds) {
        const trainerId = trainerIds[n % trainerIds.length];
        const courtId = courtIds[n % courtIds.length];
        const day = n % 5;
        const hour = 16 + (n % 3);
        await sql`insert into season_plan_entries ${sql({
          season_id: season.id,
          club_id: clubId,
          trainer_id: trainerId,
          court_id: courtId,
          group_id: groupId,
          day_of_week: day,
          start_time: `${String(hour).padStart(2, '0')}:00:00`,
          end_time: `${String(hour + 1).padStart(2, '0')}:30:00`,
          duration_minutes: 90,
          entry_type: 'training',
          planning_source: 'auto',
          max_participants: 10,
          status: spec.season === 'published' ? 'published' : 'planned',
        })}`;
        n++;
      }
      log(`  Saison "${spec.season}" mit ${n} Stundenplan-Einträgen`);

      // ── Sessions + Buchungen ────────────────────────────────────────
      // Eine veröffentlichte Saison hatte bisher Plan-Einträge, aber keine
      // einzige `sessions`-Zeile — der Publish-Übergang, der aus dem Plan
      // konkrete Termine macht, fehlte im Seed komplett. Dashboard-Kacheln
      // („Sessions heute", „Letzte Buchungen", Platzbelegung) standen dadurch
      // in JEDEM Testverein dauerhaft auf 0, obwohl die Saison „läuft".
      //
      // Es werden drei Wochen erzeugt — Vorwoche, laufende Woche, Folgewoche.
      // Die laufende Woche ist die, auf die das Dashboard schaut; die beiden
      // anderen sorgen dafür, dass Wochen-Navigation nicht ins Leere läuft.
      if (spec.season === 'published') {
        const [schedule] = await sql<{ id: string }[]>`
          insert into schedules ${sql({
            club_id: clubId,
            season_type: seasonDef.season_type,
            season_year: seasonDef.year,
            season_start_date: seasonDef.start_date,
            season_end_date: seasonDef.end_date,
            is_active: true,
          })} returning id`;

        // Montag der laufenden Woche als Anker.
        const monday = new Date();
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        monday.setHours(0, 0, 0, 0);

        const entries = await sql<
          {
            trainer_id: string;
            court_id: string;
            group_id: string;
            day_of_week: number;
            start_time: string;
          }[]
        >`select trainer_id, court_id, group_id, day_of_week, start_time
            from season_plan_entries where season_id = ${season.id}`;

        const sessionIds: { id: string; courtId: string; startsAt: Date }[] = [];
        for (let weekOffset = -1; weekOffset <= 1; weekOffset++) {
          for (const e of entries) {
            const start = new Date(monday);
            start.setDate(start.getDate() + weekOffset * 7 + e.day_of_week);
            const [h, m] = e.start_time.split(':').map(Number);
            start.setHours(h, m, 0, 0);
            const end = new Date(start.getTime() + 90 * 60 * 1000);

            const [s] = await sql<{ id: string }[]>`
              insert into sessions ${sql({
                schedule_id: schedule.id,
                trainer_id: e.trainer_id,
                court_id: e.court_id,
                group_ids: JSON.stringify([e.group_id]),
                week_number: weekOffset + 2,
                timeslot_start: start.toISOString(),
                timeslot_end: end.toISOString(),
                max_participants: 10,
              })} returning id`;
            sessionIds.push({ id: s.id, courtId: e.court_id, startsAt: start });
          }
        }

        // Buchungen nur auf die laufende Woche — die Vorwoche als „gebucht"
        // zu zeigen wäre irreführend, die liegt in der Vergangenheit.
        let bookingCount = 0;
        const thisWeek = sessionIds.filter((s) => {
          const diff = (s.startsAt.getTime() - monday.getTime()) / 86_400_000;
          return diff >= 0 && diff < 7;
        });
        for (const [i, s] of thisWeek.entries()) {
          if (!memberIds.length) break;
          await sql`insert into bookings ${sql({
            club_id: clubId,
            member_id: memberIds[i % memberIds.length],
            schedule_id: schedule.id,
            session_id: s.id,
            court_id: s.courtId,
            status: 'confirmed',
            session_start_time: s.startsAt.toISOString(),
            booked_at: new Date(s.startsAt.getTime() - 3 * 86_400_000).toISOString(),
          })}`;
          bookingCount++;
        }

        log(`  ${sessionIds.length} Sessions (3 Wochen), ${bookingCount} Buchungen`);
      }
    } else {
      log(`  Saison "${spec.season}" (ohne Stundenplan)`);
    }

    // ── Präferenzen ───────────────────────────────────────────────────
    if (spec.preferences) {
      let pn = 0;
      for (const m of memberMeta.slice(0, Math.ceil(memberMeta.length * 0.7))) {
        const avail = weeklyAvailability(pn);
        // Wunschpartner: ein anderes Mitglied derselben Gruppe.
        const partner = memberMeta.find((x) => x.id !== m.id && x.level === m.level);
        await sql`insert into user_training_preferences ${sql({
          season_id: season.id,
          user_id: m.id,
          club_id: clubId,
          user_role: 'member',
          preferred_level: m.level,
          preferred_age_group: m.ageGroup,
          self_assessed_level: m.level,
          weekly_availability: JSON.stringify(avail),
          wish_partner_ids: JSON.stringify(partner && pn % 3 === 0 ? [partner.id] : []),
          max_sessions_per_week: 1 + (pn % 2),
          priority: 5,
          is_submitted: true,
          submitted_at: new Date().toISOString(),
          special_requests: pn % 5 === 0 ? 'Bitte nicht vor 17 Uhr.' : null,
        })}`;
        await sql`insert into member_schedule_preferences ${sql({
          user_id: m.id,
          club_id: clubId,
          preferred_level: m.level,
          preferred_age_group: m.ageGroup,
          weekly_availability: JSON.stringify(avail),
          preferred_court_ids: JSON.stringify(courtIds.slice(0, 2)),
          max_sessions_per_week: 1 + (pn % 2),
        })}`;
        pn++;
      }

      // Trainer-Präferenzen für dieselbe Saison
      for (let i = 0; i < trainerIds.length; i++) {
        const [tr] = await sql<{ user_id: string }[]>`
          select user_id from trainers where id = ${trainerIds[i]}`;
        if (!tr?.user_id) continue;
        await sql`insert into user_training_preferences ${sql({
          season_id: season.id,
          user_id: tr.user_id,
          club_id: clubId,
          user_role: 'trainer',
          weekly_availability: JSON.stringify(weeklyAvailability(i, true)),
          can_teach_groups: JSON.stringify(groupIds.slice(0, 3)),
          max_sessions_per_week: 12,
          priority: 5,
          is_submitted: true,
          submitted_at: new Date().toISOString(),
        })}`;
      }
      log(`  ${pn} Mitglieder- + ${trainerIds.length} Trainer-Präferenzen`);
    }
  }

  return { clubId, accounts };
}

// ── Doku ──────────────────────────────────────────────────────────────────

function writeCredentialsDoc(
  seeded: { spec: ClubSpec; clubId: string; accounts: SeededAccount[] }[],
  superadmins: { email: string; lane: Lane; clubs: string[] }[]
) {
  const today = new Date().toISOString().slice(0, 10);
  const L: string[] = [];

  L.push('# Testzugänge SwingZ');
  L.push('');
  L.push(
    `> Generiert von \`scripts/seed-testdata.ts\` am ${today}. **Nicht von Hand editieren** —`
  );
  L.push('> die Datei wird bei jedem Seed-Lauf überschrieben.');
  L.push('> Nicht in Git (siehe `.gitignore`), weil sie Klartext-Passwörter enthält.');
  L.push('');
  L.push('## Lane-Konzept');
  L.push('');
  L.push('Jeder Testverein gehört genau einer Seite. Das verhindert, dass KI-Agent und Mensch');
  L.push('sich gegenseitig die Testdaten unterm Hintern wegziehen.');
  L.push('');
  L.push('| Lane | E-Mail-Domain | Eigentümer | Regel |');
  L.push('| --- | --- | --- | --- |');
  L.push(
    '| `user` | `*.swingz.test` | Mensch | Ein Agent liest hier höchstens — **niemals schreiben**. |'
  );
  L.push(
    '| `agent` | `*.claude.test` | Claude | Freie Spielwiese der KI. Mensch muss hier nichts erwarten. |'
  );
  L.push('');
  L.push('Jede Lane lässt sich einzeln zurücksetzen, ohne die andere zu berühren:');
  L.push('');
  L.push('```bash');
  L.push('npx tsx scripts/seed-testdata.ts                     # nur Ist-Zustand zeigen');
  L.push('npx tsx scripts/seed-testdata.ts --lane=agent --yes  # nur Claude-Vereine neu');
  L.push('npx tsx scripts/seed-testdata.ts --lane=user  --yes  # nur Nutzer-Vereine neu');
  L.push('npx tsx scripts/seed-testdata.ts --all        --yes  # DB komplett platt + alles neu');
  L.push('```');
  L.push('');
  L.push('## Passwort');
  L.push('');
  L.push(`Alle unten genannten Accounts nutzen dasselbe Passwort: \`${SEED_PASSWORD}\``);
  L.push('');
  L.push('Änderbar über `SEED_PASSWORD` in `.env.local` vor dem Seed-Lauf.');
  L.push('');
  L.push('## Plattform-Owner');
  L.push('');
  L.push(`| Rolle | E-Mail | Passwort |`);
  L.push(`| --- | --- | --- |`);
  // Der Seed ändert das Owner-Passwort nie — er dokumentiert es nur, wenn es in
  // .env.local hinterlegt ist. Ohne diese Zeile stünde es nach jedem Doku-Lauf
  // wieder nicht drin, weil diese Datei bei jedem Lauf neu geschrieben wird.
  const ownerPw = process.env.OWNER_PASSWORD;
  L.push(
    `| owner | \`${OWNER_EMAIL}\` | ${ownerPw ? `\`${ownerPw}\`` : 'nicht hinterlegt (OWNER_PASSWORD in .env.local setzen)'} |`
  );
  L.push('');
  if (superadmins.length) {
    L.push('## Superadmins (Tennisschule, mehrere Vereine)');
    L.push('');
    L.push('| Lane | E-Mail | Verwaltet |');
    L.push('| --- | --- | --- |');
    for (const sa of superadmins) {
      const names = sa.clubs.map((k) => CLUBS.find((c) => c.key === k)!.name).join(', ');
      L.push(`| \`${sa.lane}\` | \`${sa.email}\` | ${names} |`);
    }
    L.push('');
    L.push('Testet den Club-Switcher und die Mehr-Vereins-Sicht.');
    L.push('');
  }

  L.push('## Vereine im Überblick');
  L.push('');
  L.push('| Verein | Lane | Zweck | Plätze | Trainer | Mitglieder | Saison |');
  L.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const s of seeded) {
    L.push(
      `| ${s.spec.name} | \`${s.spec.lane}\` | ${s.spec.purpose} | ${s.spec.courts} | ` +
        `${s.spec.trainers} | ${s.spec.members} | ${s.spec.season} |`
    );
  }
  L.push('');

  for (const s of seeded) {
    L.push(`## ${s.spec.name}`);
    L.push('');
    L.push(
      `- **Lane:** \`${s.spec.lane}\` — ${s.spec.lane === 'agent' ? 'Claude arbeitet hier' : 'Spielwiese des Menschen'}`
    );
    L.push(`- **Zweck:** ${s.spec.purpose}`);
    L.push(`- **Club-ID:** \`${s.clubId}\``);
    L.push(
      `- **Module:** Kern (Mitglieder, Trainer, Saison, Finanzen)` +
        (s.spec.extraFeatures.length ? ` + ${s.spec.extraFeatures.join(', ')}` : '')
    );
    L.push('');
    if (!s.accounts.length) {
      L.push('_Keine Accounts — dieser Verein ist bewusst leer._');
      L.push('');
      continue;
    }
    L.push('| Rolle | E-Mail | Name |');
    L.push('| --- | --- | --- |');
    for (const a of s.accounts) L.push(`| ${a.role} | \`${a.email}\` | ${a.name} |`);
    L.push('');
    if (s.spec.members > s.spec.memberLogins) {
      L.push(
        `_Weitere ${s.spec.members - s.spec.memberLogins} Mitglieder existieren nur als Profil ` +
          `(ohne Login) — sie füllen Listen, Planung und Abrechnung, brauchen aber keine Anmeldung._`
      );
      L.push('');
    }
  }

  L.push('## Automatisierte Tests');
  L.push('');
  L.push('Die `TEST_*`-Variablen in `.env.local` (Playwright/E2E) zeigen bewusst auf die');
  L.push('**Agent-Lane** (Claude Sandbox Alpha). E2E-Tests schreiben Daten — sie dürfen die');
  L.push('Vereine des Menschen nicht anfassen. Nach einem `--lane=agent`-Reset sind die');
  L.push('Accounts identisch benannt, aber neue UUIDs: `TEST_MEMBER_UUID` neu setzen.');
  L.push('');
  L.push('## Was der Seed bewusst NICHT anlegt');
  L.push('');
  L.push(
    '- **Rechnungen und SEPA-Mandate** — Beitragskategorien und Mitglieder-Zuordnungen sind da,'
  );
  L.push(
    '  die Rechnungen erzeugst du über die Oberfläche. Genau dieser Weg soll getestet werden.'
  );
  L.push(
    '- **Veröffentlichte Sessions/Buchungen** — die entstehen beim Veröffentlichen einer Saison.'
  );
  L.push('  TC Grün-Weiß Köln steht absichtlich direkt davor (`manual_review`).');
  L.push('- **TC Neuland e.V.** bleibt komplett leer: kein Platz, kein Trainer, kein Mitglied,');
  L.push('  `setup_completed_at = NULL`. Das ist der Erstlogin-/Onboarding-Testfall.');
  L.push('');

  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/TEST-CREDENTIALS.md', L.join('\n'));
  log('\n📄 docs/TEST-CREDENTIALS.md geschrieben');
}

// ── Status ────────────────────────────────────────────────────────────────

async function showStatus() {
  const [c] = await sql<{ clubs: number; users: number; auth: number }[]>`
    select (select count(*) from clubs) clubs,
           (select count(*) from users) users,
           (select count(*) from auth.users) auth`;
  log('\n📊 Ist-Zustand');
  log(`  Vereine: ${c.clubs}   Profile: ${c.users}   Auth-Accounts: ${c.auth}`);

  for (const lane of ['user', 'agent'] as Lane[]) {
    const names = CLUBS.filter((x) => x.lane === lane).map((x) => x.name);
    const rows = await sql<{ name: string; mitglieder: number }[]>`
      select c.name,
             (select count(*) from user_club_memberships m
               where m.club_id = c.id and m.role = 'member') mitglieder
      from clubs c where c.name = any(${names}) order by c.name`;
    log(`\n  Lane "${lane}":`);
    for (const r of rows) log(`    ${r.name} — ${r.mitglieder} Mitglieder`);
    const missing = names.filter((n) => !rows.some((r) => r.name === n));
    if (missing.length) log(`    (fehlt: ${missing.join(', ')})`);
  }
  log('\nNichts geändert. Zum Ausführen eine Option angeben:');
  log('  --all --yes            komplett zurücksetzen und alle Vereine neu anlegen');
  log('  --lane=agent --yes     nur die Claude-Sandboxen neu');
  log('  --lane=user --yes      nur die Nutzer-Vereine neu');
}

// ── Main ──────────────────────────────────────────────────────────────────

/**
 * Schreibt die Zugangsdaten-Doku aus dem Ist-Zustand der DB — ohne irgendetwas
 * zu verändern. Nötig, weil ein Teil-Lauf die Doku nicht erneuern darf, sie
 * aber trotzdem nicht veralten soll.
 */
async function regenerateDoc() {
  const seeded: { spec: ClubSpec; clubId: string; accounts: SeededAccount[] }[] = [];

  for (const spec of CLUBS) {
    const [club] = await sql<{ id: string }[]>`select id from clubs where name = ${spec.name}`;
    if (!club) {
      log(`  ⚠️  ${spec.name} existiert nicht in der DB — übersprungen`);
      continue;
    }
    // Nur Accounts mit echtem Login (Join auf auth.users) — Massen-Mitglieder
    // ohne Anmeldung gehören nicht in eine Zugangsdaten-Liste.
    const accounts = await sql<{ role: string; email: string; name: string }[]>`
      select m.role, u.email, coalesce(u.full_name, u.email) as name
      from users u
      join user_club_memberships m on m.user_id = u.id
      join auth.users au on au.id = u.id
      where m.club_id = ${club.id}
      order by case m.role when 'admin' then 1 when 'superadmin' then 2
                           when 'trainer' then 3 else 4 end, u.email`;
    seeded.push({ spec, clubId: club.id, accounts });
  }

  const supers: { email: string; lane: Lane; clubs: string[] }[] = [];
  for (const sa of SUPERADMINS) {
    const [row] = await sql<{ id: string }[]>`select id from auth.users where email = ${sa.email}`;
    if (row) supers.push({ email: sa.email, lane: sa.lane, clubs: sa.clubs });
  }

  writeCredentialsDoc(seeded, supers);
}

/**
 * Testdaten werden nur in eine lokale DB geschrieben (docs/ENVIRONMENTS.md).
 * Bis 16.08.2026 zeigte `.env.local` auf die Produktions-DB — `npm run seed:reset`
 * hätte dort jeden echten Verein gelöscht. Kein Override-Flag: einen Grund, den
 * Seed gegen Produktion laufen zu lassen, gibt es nicht.
 */
function assertNotProduction() {
  const host = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : '';
  if (['localhost', '127.0.0.1', '::1', 'db'].includes(host)) return;
  console.error(
    `\n⛔ Abbruch: DATABASE_URL zeigt auf "${host || '(leer)'}", nicht auf den lokalen Stack.\n` +
      '   Seed schreibt ausschließlich lokal — siehe docs/ENVIRONMENTS.md.\n' +
      '   Lokalen Stack starten: supabase start (DB dann auf 127.0.0.1:54322)\n'
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const yes = args.includes('--yes');
  const all = args.includes('--all');
  const docsOnly = args.includes('--docs-only');
  const laneArg = args.find((a) => a.startsWith('--lane='))?.split('=')[1] as Lane | undefined;

  if (docsOnly) {
    log('\n📄 Erzeuge Zugangsdaten-Doku aus dem Ist-Zustand (ändert keine Daten)...');
    await regenerateDoc();
    return;
  }

  if (!yes || (!all && !laneArg)) {
    await showStatus();
    return;
  }

  assertNotProduction();

  const lanes: Lane[] = all ? ['user', 'agent'] : [laneArg!];

  if (all) {
    await wipeAll();
  } else {
    await wipeLane(laneArg!);
  }

  const byKey = new Map<string, string>();

  for (const spec of CLUBS.filter((c) => lanes.includes(c.lane))) {
    const r = await seedClub(spec);
    byKey.set(spec.key, r.clubId);
  }

  // Superadmins über mehrere Vereine
  for (const sa of SUPERADMINS.filter((s) => lanes.includes(s.lane))) {
    const uid = await createLogin(sa.email, sa.name);
    for (const key of sa.clubs) {
      const cid = byKey.get(key);
      if (cid) await addMembership(uid, cid, 'superadmin');
    }
    // Onboarding als erledigt markieren. Ohne das leitet /superadmin auf den
    // Erstlogin-Wizard um — dann testet jeder Superadmin-Testfall den Wizard
    // statt der Funktion, die er zu testen glaubt (fiel bei der Navigations-
    // Suite auf: sie klickte in einer Sidebar, die auf dem Wizard lag).
    // Der Wizard-Testfall des Menschen ist TC Neuland, nicht dieser Account.
    await sql`update users set superadmin_setup_completed_at = now() where id = ${uid}`;
    log(`\n👔 Superadmin ${sa.email} → ${sa.clubs.join(', ')}`);
  }

  // Die E2E-Tests hängen an einer UUID, die sich bei jedem Reset ändert.
  // Automatisch nachziehen, sonst laufen sie nach jedem Seed ins Leere.
  if (lanes.includes('agent')) {
    const [m] = await sql<{ id: string }[]>`
      select id from users where email = 'mitglied1@alpha.claude.test'`;
    if (m && fs.existsSync('.env.local')) {
      const env = fs.readFileSync('.env.local', 'utf8');
      const next = env.replace(/^TEST_MEMBER_UUID=.*$/m, `TEST_MEMBER_UUID=${m.id}`);
      if (next !== env) {
        fs.writeFileSync('.env.local', next);
        log(`\n🔑 TEST_MEMBER_UUID in .env.local aktualisiert (${m.id})`);
      }
    }
  }

  // Immer aus dem Ist-Zustand erzeugen, auch nach einem Lane-Lauf: sonst
  // beschreibt die Doku nach jedem Teil-Lauf einen Zustand von gestern.
  await regenerateDoc();

  log('\n✅ Fertig.');
}

main()
  .catch((e) => {
    console.error('\n❌ Fehler:', e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
