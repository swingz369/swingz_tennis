#!/usr/bin/env npx tsx
/**
 * Testdaten für den Saisonplanungs-Durchlauf.
 *
 * Der Verein selbst wird bewusst NICHT mehr hier angelegt — er entsteht über die
 * echten Oberflächen (Owner legt Verein an → Admin einladen → Onboarding-Wizard →
 * Mitglieder-CSV importieren). Genau dieser Weg war ungetestet, solange das Skript
 * Verein und Nutzer per Service-Client direkt in die Datenbank schrieb.
 *
 * Ablauf:
 *   1) npx tsx scripts/seed-qa-club.ts --csv > mitglieder.csv
 *      → Mitgliederliste, die der Admin unter /admin/members importiert
 *   2) Admin legt in der UI eine Saison an
 *   3) npx tsx scripts/seed-qa-club.ts --prefs <seasonId>
 *      → Präferenzen für alle Mitglieder und Trainer dieses Vereins
 *   4) npx tsx scripts/seed-qa-club.ts --purge <clubId>
 *      → Verein samt Nutzern restlos entfernen
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

// ponytail: eigener Client statt @/lib/supabase/service — dort steckt `server-only`
// drin, das unter tsx sofort wirft.
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const MAIL_DOMAIN = 'bgmoers.example.com'; // example.com stellt nie zu — keine echten Mails

type Slot = { start: string; end: string };
type WeekSchedule = Partial<Record<string, Slot[]>>;

const EMPTY_WEEK = {
  monday: [] as Slot[],
  tuesday: [] as Slot[],
  wednesday: [] as Slot[],
  thursday: [] as Slot[],
  friday: [] as Slot[],
  saturday: [] as Slot[],
  sunday: [] as Slot[],
};
const week = (s: WeekSchedule) => ({ ...EMPTY_WEEK, ...s });

// ─────────────────────────── Archetypen ───────────────────────────

type Archetype = {
  label: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  ageGroup: 'kids' | 'adult' | 'senior';
  maxSessionsPerWeek: number;
  priority: number;
  birthDate: string;
  schedule: WeekSchedule;
};

const ARCHETYPES: Record<string, Archetype> = {
  kind: {
    label: 'Kind (Schulkind, nachmittags)',
    level: 'beginner',
    ageGroup: 'kids',
    maxSessionsPerWeek: 1,
    priority: 5,
    birthDate: '14.05.2015',
    schedule: week({
      monday: [{ start: '15:00', end: '18:00' }],
      wednesday: [{ start: '15:00', end: '18:00' }],
      friday: [{ start: '15:00', end: '17:00' }],
    }),
  },
  jugend: {
    label: 'Jugendlicher (Mannschaft)',
    level: 'intermediate',
    ageGroup: 'kids',
    maxSessionsPerWeek: 2,
    priority: 7,
    birthDate: '03.09.2010',
    schedule: week({
      tuesday: [{ start: '16:00', end: '19:00' }],
      thursday: [{ start: '16:00', end: '19:00' }],
      saturday: [{ start: '10:00', end: '13:00' }],
    }),
  },
  berufstaetig: {
    label: 'Berufstätig (nur abends)',
    level: 'intermediate',
    ageGroup: 'adult',
    maxSessionsPerWeek: 1,
    priority: 5,
    birthDate: '22.07.1988',
    schedule: week({
      monday: [{ start: '18:00', end: '21:00' }],
      tuesday: [{ start: '18:00', end: '21:00' }],
      thursday: [{ start: '18:00', end: '21:00' }],
    }),
  },
  ambitioniert: {
    label: 'Ambitioniert (Medenspieler)',
    level: 'advanced',
    ageGroup: 'adult',
    maxSessionsPerWeek: 2,
    priority: 8,
    birthDate: '11.02.1993',
    schedule: week({
      tuesday: [{ start: '18:00', end: '21:00' }],
      thursday: [{ start: '18:00', end: '21:00' }],
      saturday: [{ start: '09:00', end: '13:00' }],
    }),
  },
  senior: {
    label: 'Senior (vormittags)',
    level: 'intermediate',
    ageGroup: 'senior',
    maxSessionsPerWeek: 1,
    priority: 4,
    birthDate: '30.11.1958',
    schedule: week({
      wednesday: [{ start: '09:00', end: '12:00' }],
      friday: [{ start: '09:00', end: '12:00' }],
    }),
  },
};

/** `submits: false` = gibt keine Präferenzen ab (im Verein der Normalfall für einige). */
const MEMBERS: { name: string; archetype: keyof typeof ARCHETYPES; submits: boolean }[] = [
  { name: 'Lina Hoffmann', archetype: 'kind', submits: true },
  { name: 'Ben Krüger', archetype: 'kind', submits: true },
  { name: 'Mia Schäfer', archetype: 'kind', submits: true },
  { name: 'Noah Lehmann', archetype: 'kind', submits: true },
  { name: 'Emma Zimmermann', archetype: 'kind', submits: true },
  { name: 'Luis Franke', archetype: 'kind', submits: false },
  { name: 'Jonas Wendt', archetype: 'jugend', submits: true },
  { name: 'Marie Böhm', archetype: 'jugend', submits: true },
  { name: 'Til Kaufmann', archetype: 'jugend', submits: true },
  { name: 'Sophie Reimann', archetype: 'jugend', submits: true },
  { name: 'Andreas Pohl', archetype: 'berufstaetig', submits: true },
  { name: 'Katrin Seibert', archetype: 'berufstaetig', submits: true },
  { name: 'Michael Dörr', archetype: 'berufstaetig', submits: true },
  { name: 'Nadine Ulrich', archetype: 'berufstaetig', submits: true },
  { name: 'Sven Brandt', archetype: 'berufstaetig', submits: true },
  { name: 'Julia Mertens', archetype: 'berufstaetig', submits: true },
  { name: 'Dirk Haase', archetype: 'berufstaetig', submits: false },
  { name: 'Petra Lindner', archetype: 'berufstaetig', submits: false },
  { name: 'Marcel Kern', archetype: 'ambitioniert', submits: true },
  { name: 'Yvonne Stark', archetype: 'ambitioniert', submits: true },
  { name: 'Robert Ziegler', archetype: 'ambitioniert', submits: true },
  { name: 'Helga Sommer', archetype: 'senior', submits: true },
  { name: 'Werner Alt', archetype: 'senior', submits: true },
  { name: 'Ingrid Bauer', archetype: 'senior', submits: false },
];

const TRAINERS = [
  {
    name: 'Miriam Vogt',
    specialties: ['Anfänger', 'Fortgeschrittene', 'Leistungssport'],
    maxSessionsPerWeek: 18,
    // Cheftrainerin: breite Verfügbarkeit über die ganze Woche
    schedule: week({
      monday: [{ start: '14:00', end: '21:00' }],
      tuesday: [{ start: '14:00', end: '21:00' }],
      wednesday: [
        { start: '09:00', end: '13:00' },
        { start: '15:00', end: '21:00' },
      ],
      thursday: [{ start: '14:00', end: '21:00' }],
      friday: [{ start: '14:00', end: '19:00' }],
      saturday: [{ start: '09:00', end: '14:00' }],
    }),
  },
  {
    name: 'Kai Brenner',
    specialties: ['Kindertraining', 'Jugendtraining', 'Anfänger'],
    maxSessionsPerWeek: 14,
    // Jugendtrainer: nachmittags, wenn die Kinder aus der Schule kommen
    schedule: week({
      monday: [{ start: '15:00', end: '19:00' }],
      tuesday: [{ start: '15:00', end: '19:00' }],
      wednesday: [{ start: '15:00', end: '19:00' }],
      thursday: [{ start: '15:00', end: '19:00' }],
      saturday: [{ start: '10:00', end: '14:00' }],
    }),
  },
  {
    name: 'Tomasz Nowak',
    specialties: ['Fortgeschrittene', 'Turniervorbereitung'],
    maxSessionsPerWeek: 6,
    // Teilzeit neben dem Hauptberuf: nur zwei Abende — der knappe Trainer, an dem
    // sich Konflikterkennung und Auslastung zeigen müssen.
    schedule: week({
      tuesday: [{ start: '18:00', end: '21:00' }],
      thursday: [{ start: '18:00', end: '21:00' }],
    }),
  },
];

// ─────────────────────────── Helfer ───────────────────────────

const log = (icon: string, msg: string) => console.error(`  ${icon} ${msg}`);
const section = (t: string) => console.error(`\n${'─'.repeat(64)}\n  ${t}\n${'─'.repeat(64)}`);

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z ]/g, '')
    .split(' ')
    .join('.');

const emailFor = (name: string) => `${slug(name)}@${MAIL_DOMAIN}`;

// ─────────────────────────── CSV ───────────────────────────

/** Schreibt die Mitgliederliste nach stdout — Import über /admin/members. */
function emitCsv() {
  const headers = ['E-Mail', 'Name', 'Rolle', 'Telefon', 'Geburtsdatum'];
  const rows = MEMBERS.map((m) => [
    emailFor(m.name),
    m.name,
    'Mitglied',
    '',
    ARCHETYPES[m.archetype].birthDate,
  ]);
  console.log([headers.join(','), ...rows.map((r) => r.join(','))].join('\n'));
  log('✅', `${rows.length} Mitglieder als CSV ausgegeben`);
}

// ─────────────────────────── Präferenzen ───────────────────────────

async function seedPreferences(seasonId: string) {
  const { data: season } = await sb
    .from('seasons')
    .select('id,name,club_id')
    .eq('id', seasonId)
    .maybeSingle();
  if (!season) {
    log('❌', `Saison ${seasonId} nicht gefunden`);
    process.exit(1);
  }
  const clubId = season.club_id as string;

  section(`Präferenzen für "${season.name}"`);

  // Nutzer kommen aus der Mitgliedschaft des Vereins, nicht aus einer Liste im
  // Skript — so passen die Präferenzen zu dem, was der Import tatsächlich angelegt hat.
  // Der Embed braucht den Beziehungsnamen: user_club_memberships hat ZWEI
  // Fremdschlüssel auf users (user_id und deactivated_by), ein blankes `users(...)`
  // beantwortet PostgREST mit PGRST201 statt mit Daten.
  const { data: memberships, error: membershipErr } = await sb
    .from('user_club_memberships')
    .select('user_id, role, users!user_club_memberships_user_id_fkey(full_name, email)')
    .eq('club_id', clubId)
    .eq('is_active', true);
  if (membershipErr) {
    log('❌', `Mitgliedschaften: ${membershipErr.message}`);
    process.exit(1);
  }

  const byName = new Map<string, { userId: string; role: string }>();
  for (const m of memberships ?? []) {
    const u = m.users as unknown as { full_name: string | null } | null;
    if (u?.full_name)
      byName.set(u.full_name, { userId: m.user_id as string, role: m.role as string });
  }

  const rows: Record<string, unknown>[] = [];

  for (const m of MEMBERS) {
    if (!m.submits) continue;
    const hit = byName.get(m.name);
    if (!hit) {
      log('⚠️', `${m.name} ist kein Mitglied dieses Vereins — übersprungen`);
      continue;
    }
    const a = ARCHETYPES[m.archetype];
    rows.push({
      season_id: seasonId,
      user_id: hit.userId,
      club_id: clubId,
      user_role: 'member',
      preferred_level: a.level,
      preferred_age_group: a.ageGroup,
      preferred_group_ids: [],
      weekly_availability: a.schedule,
      unavailable_dates: [],
      max_sessions_per_week: a.maxSessionsPerWeek,
      preferred_court_ids: [],
      can_teach_groups: [],
      priority: a.priority,
      special_requests: null,
      notes: a.label,
      is_submitted: true,
    });
  }

  for (const t of TRAINERS) {
    const hit = byName.get(t.name);
    if (!hit) {
      log('⚠️', `${t.name} ist kein Trainer dieses Vereins — übersprungen`);
      continue;
    }
    rows.push({
      season_id: seasonId,
      user_id: hit.userId,
      club_id: clubId,
      user_role: 'trainer',
      preferred_level: 'intermediate',
      preferred_age_group: 'adult',
      preferred_group_ids: [],
      weekly_availability: t.schedule,
      unavailable_dates: [],
      max_sessions_per_week: t.maxSessionsPerWeek,
      preferred_court_ids: [],
      can_teach_groups: t.specialties,
      priority: 5,
      special_requests: null,
      notes: `Trainer — ${t.specialties.join(', ')}`,
      is_submitted: true,
    });
  }

  let written = 0;
  for (const row of rows) {
    const { data: existing } = await sb
      .from('user_training_preferences')
      .select('id')
      .match({
        season_id: seasonId,
        user_id: row.user_id as string,
        user_role: row.user_role as string,
      })
      .maybeSingle();
    if (existing) continue;
    const { error } = await sb.from('user_training_preferences').insert(row);
    if (error) log('❌', `${row.user_role}: ${error.message}`);
    else written++;
  }

  const abstained = MEMBERS.filter((m) => !m.submits).length;
  log('✅', `${written} Präferenzen geschrieben (${abstained} Mitglieder geben bewusst nichts ab)`);

  // Die Trainer-Verknüpfung ist die häufigste stille Fehlerquelle: ohne
  // trainers.user_id joint planning/trainers/route.ts ins Leere und der Trainer
  // gilt dauerhaft als "Präferenzen ausstehend".
  for (const t of TRAINERS) {
    const hit = byName.get(t.name);
    if (!hit) continue;
    const { data: tr } = await sb
      .from('trainers')
      .select('id, user_id')
      .eq('user_id', hit.userId)
      .maybeSingle();
    if (!tr) log('⚠️', `${t.name}: keine Zeile in trainers mit user_id — Planung sieht ihn nicht`);
  }
}

// ─────────────────────────── Aufräumen ───────────────────────────

async function purge(clubId: string) {
  const { data: club } = await sb.from('clubs').select('id,name').eq('id', clubId).maybeSingle();
  if (!club) {
    log('⚠️', 'Verein nicht gefunden — nichts zu tun');
    return;
  }
  section(`Aufräumen: ${club.name} (${clubId})`);

  const { data: seasons } = await sb.from('seasons').select('id').eq('club_id', clubId);
  const seasonIds = (seasons ?? []).map((s) => s.id);

  if (seasonIds.length > 0) {
    const { data: entries } = await sb
      .from('season_plan_entries')
      .select('id')
      .in('season_id', seasonIds);
    const entryIds = (entries ?? []).map((e) => e.id);

    if (entryIds.length > 0) {
      const { data: sess } = await sb.from('sessions').select('id').in('plan_entry_id', entryIds);
      const sessionIds = (sess ?? []).map((s) => s.id);
      if (sessionIds.length > 0) {
        await sb.from('bookings').delete().in('session_id', sessionIds);
        await sb.from('sessions').delete().in('id', sessionIds);
        log('🗑', `${sessionIds.length} Trainingseinheiten + Buchungen`);
      }
      await sb.from('season_plan_entries').delete().in('id', entryIds);
      log('🗑', `${entryIds.length} Planeinträge`);
    }
    await sb.from('planning_conflicts').delete().in('season_id', seasonIds);
    await sb.from('user_training_preferences').delete().in('season_id', seasonIds);
    await sb.from('seasons').delete().in('id', seasonIds);
    log('🗑', `${seasonIds.length} Saisons`);
  }

  // Rechnungen, Anwesenheit und RSVPs entstehen erst im Betrieb — ohne sie bliebe
  // nach --purge ein Rest zurück, der beim nächsten Durchlauf für Verwirrung sorgt.
  await sb.from('invoices').delete().eq('club_id', clubId);
  await sb.from('session_rsvps').delete().eq('club_id', clubId);
  await sb.from('bookings').delete().eq('club_id', clubId);
  await sb.from('sessions').delete().eq('club_id', clubId);
  await sb.from('schedules').delete().eq('club_id', clubId);
  await sb.from('courts').delete().eq('club_id', clubId);
  await sb.from('trainer_club').delete().eq('club_id', clubId);

  const { data: memberships } = await sb
    .from('user_club_memberships')
    .select('user_id')
    .eq('club_id', clubId);
  const userIds = [...new Set((memberships ?? []).map((m) => m.user_id))];
  await sb.from('user_club_memberships').delete().eq('club_id', clubId);
  await sb.from('clubs').delete().eq('id', clubId);
  log('🗑', 'Verein, Plätze, Mitgliedschaften');

  // Nutzer nur löschen, wenn sie zu diesem Testverein gehören (Mail-Domain)
  let removed = 0;
  for (const userId of userIds) {
    const { data: u } = await sb.from('users').select('email').eq('id', userId).maybeSingle();
    if (!u?.email?.endsWith(`@${MAIL_DOMAIN}`)) continue;
    await sb.from('trainers').delete().eq('email', u.email);
    await sb.from('users').delete().eq('id', userId);
    await sb.auth.admin.deleteUser(userId);
    removed++;
  }
  log('🗑', `${removed} Nutzer (inkl. Auth)`);
}

// ─────────────────────────── Einstieg ───────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--csv')) return emitCsv();

  const purgeIdx = args.indexOf('--purge');
  if (purgeIdx !== -1) {
    const clubId = args[purgeIdx + 1];
    if (!clubId) {
      log('❌', 'Verwendung: --purge <clubId>');
      process.exit(1);
    }
    return purge(clubId);
  }

  const prefsIdx = args.indexOf('--prefs');
  if (prefsIdx !== -1) {
    const seasonId = args[prefsIdx + 1];
    if (!seasonId) {
      log('❌', 'Verwendung: --prefs <seasonId>');
      process.exit(1);
    }
    return seedPreferences(seasonId);
  }

  console.error(`
  Verwendung:
    npx tsx scripts/seed-qa-club.ts --csv > mitglieder.csv   Mitgliederliste zum Import
    npx tsx scripts/seed-qa-club.ts --prefs <seasonId>       Präferenzen für die Saison
    npx tsx scripts/seed-qa-club.ts --purge <clubId>         Verein restlos entfernen
`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
