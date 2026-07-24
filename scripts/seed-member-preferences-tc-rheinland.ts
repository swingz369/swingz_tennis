#!/usr/bin/env npx tsx
/**
 * Realistic Member-Preferences-Seed für TC Rheinland e.V. (Sommer 2026).
 *
 * Befüllt die Tabelle `user_training_preferences` (user_role='member')
 * für die ca. 150 planungs-aktiven Mitglieder.
 *
 * Diese Tabelle ist die kanonische Quelle für die AI-Saisonplanung;
 * sie überschreibt als saison-spezifischer Input die
 * `member_schedule_preferences` (Long-Term-Backup).
 *
 * Archetypen (differenziert):
 *   • Senior-Vormittag       (Ruhestand, Mo–Do 08–12)
 *   • Berufstätige-Abends    (Wo-tags 17–21)
 *   • Berufstätige-Mittag    (12–14 Lunch-Breaker)
 *   • Jugend-Schule          (Mo–Fr 16–19, Wochenende Turniere)
 *   • Jugend-Camp            (Sa/So Vormittag, intensiv)
 *   • Hausfrauen/Teilzeit    (Vormittag Mo–Fr)
 *   • Leistung                (3–4× / Wo, später Abend + Wochenende)
 *   • Hobby-Familie           (Sa/So Vormittag)
 *   • Wochenend-Hobbyspieler  (Sa/So großzügig)
 *   • Student                 (Nachmittag Mo–Fr)
 *
 * Verteilung (deterministisch via Array-Flattening):
 *   15× Senior-Vormittag      (10%)
 *   23× Berufstätige-Abends   (15%)
 *   12× Berufstätige-Mittag   (8%)
 *   23× Jugend-Schule         (15%)
 *   10× Jugend-Camp           (7%)
 *   15× Hausfrauen            (10%)
 *    8× Leistung              (5%)
 *   15× Hobby-Familie         (10%)
 *   15× Wochenend             (10%)
 *   14× Student               (9%)
 *   ───────────────────────────────
 *  150×  total
 *
 * Skill-Level-Verteilung:
 *   beginner    ~40% (Senioren, Anfänger-Kinder, Schnupper-Mitglieder)
 *   intermediate~45% (Hobby-Spieler, Berufstätige, Jugend)
 *   advanced    ~15% (Leistung, Mannschaft, Turnierspieler)
 *
 * Age-Group (kids vs adults vs senior für Clustering-Engine):
 *   kids     ~17% (Jugendliche)
 *   adult    ~50% (Berufstätige, Studenten, Familien)
 *   senior   ~33% (Senioren, Hausfrauen, Hobby-Familien mit Großeltern)
 *
 * Day-of-week: 0=Sonntag, 6=Samstag (PG-Konvention).
 * Time-Format weekly_availability: {monday:[{start,end}],...}.
 *
 * Usage: npx tsx scripts/seed-member-preferences-tc-rheinland.ts
 *
 * Idempotent über Pre-Check auf (season_id, user_id, user_role).
 *
 * NOTE: `preferred_age_group` Runtime-Werte sind `'kids' | 'adult' | 'senior'`.
 * Der Migrations-Kommentar in `20260506_season_planning_system.sql` ist STALE
 * (`'junior', 'senior'`). NICHT ändern — `lib/season-planning/clustering-engine.ts`
 * (Zeile ~380) hängt am Wert `'kids'` für die Kids-vs-Adult-Verzweigung.
 */
import 'dotenv/config';
import { createServiceClient } from '@/lib/supabase/service';

const CLUB_NAME = 'TC Rheinland e.V.';
const SEASON_TYPE = 'summer';
const SEASON_YEAR = 2026;

// ───────────────────────── Type-Defs ─────────────────────────
type Slot = { start: string; end: string }; // HH:MM
type DayKey = number; // 0=So, 1=Mo, …, 6=Sa
type WeekSchedule = Partial<Record<DayKey, Slot[]>>;

type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
type AgeGroup = 'kids' | 'adult' | 'senior';

type MemberArchetype = {
  label: string;
  preferredLevel: SkillLevel;
  preferredAgeGroup: AgeGroup;
  maxSessionsPerWeek: number;
  priority: number;
  schedule: WeekSchedule;
  notes: string;
};

// ───────────────────────── Archetype-Definitionen ─────────────────────────

// 1. Senior-Vormittag — 15 Mitglieder
const A_SENIOR_MORNING: MemberArchetype = {
  label: 'Senior-Vormittag (Ruhestand)',
  preferredLevel: 'intermediate',
  preferredAgeGroup: 'senior',
  maxSessionsPerWeek: 3,
  priority: 4,
  schedule: {
    1: [{ start: '09:00', end: '12:00' }],
    2: [{ start: '09:00', end: '12:00' }],
    3: [{ start: '09:00', end: '12:00' }],
    4: [{ start: '09:00', end: '12:00' }],
  },
  notes: 'Hobbysenior, Mo–Do vormittags. Senioren-Mannschaft H50/H70.',
};

// 2. Berufstätige-Abends — 23 Mitglieder
const A_BUSY_EVENING: MemberArchetype = {
  label: 'Berufstätige (Abend)',
  preferredLevel: 'intermediate',
  preferredAgeGroup: 'adult',
  maxSessionsPerWeek: 2,
  priority: 6,
  schedule: {
    1: [{ start: '18:00', end: '21:30' }],
    3: [{ start: '18:00', end: '21:30' }],
    5: [{ start: '18:00', end: '21:30' }],
  },
  notes: 'Voll berufstätig, 3× abends pro Woche. Mixed/Doppel-Gruppe.',
};

// 3. Berufstätige-Mittag — 12 Mitglieder (Home-Office / Praxen / Selbstständige)
const A_BUSY_LUNCH: MemberArchetype = {
  label: 'Berufstätige (Lunch-Breaker)',
  preferredLevel: 'intermediate',
  preferredAgeGroup: 'adult',
  maxSessionsPerWeek: 2,
  priority: 5,
  schedule: {
    2: [{ start: '12:00', end: '13:30' }],
    4: [{ start: '12:00', end: '13:30' }],
  },
  notes: 'Home-Office / Selbstständige, Mittagspause als Sport-Slot.',
};

// 4. Jugend-Schule — 23 Mitglieder (Mo–Fr nach Schulschluss)
const A_JUNIOR_AFTERSCHOOL: MemberArchetype = {
  label: 'Jugend-Schule (Mo–Fr)',
  preferredLevel: 'intermediate',
  preferredAgeGroup: 'kids',
  maxSessionsPerWeek: 3,
  priority: 8,
  schedule: {
    1: [{ start: '16:30', end: '18:30' }],
    2: [{ start: '16:30', end: '18:30' }],
    3: [{ start: '16:30', end: '18:30' }],
    4: [{ start: '16:30', end: '18:30' }],
    5: [{ start: '16:30', end: '18:30' }],
  },
  notes: 'Schüler U14/U16, nach Schulschluss. Jugend-Mannschaftstraining.',
};

// 5. Jugend-Camp — 10 Mitglieder (Wochenende intensiv)
const A_JUNIOR_CAMP: MemberArchetype = {
  label: 'Jugend-Camp (Wochenende)',
  preferredLevel: 'advanced',
  preferredAgeGroup: 'kids',
  maxSessionsPerWeek: 3,
  priority: 9,
  schedule: {
    6: [
      { start: '10:00', end: '13:00' },
      { start: '14:00', end: '17:00' },
    ],
    0: [{ start: '10:00', end: '13:00' }],
    3: [{ start: '17:00', end: '19:30' }],
  },
  notes: 'Leistungs-Jugend U18, Wochenende-Camps + Midweek-Late.',
};

// 6. Hausfrauen/Teilzeit — 15 Mitglieder
const A_PARTTIME_MORNING: MemberArchetype = {
  label: 'Teilzeit/Hausfrauen (Vormittag)',
  preferredLevel: 'beginner',
  preferredAgeGroup: 'adult',
  maxSessionsPerWeek: 2,
  priority: 4,
  schedule: {
    1: [{ start: '10:00', end: '12:00' }],
    3: [{ start: '10:00', end: '12:00' }],
    5: [{ start: '10:00', end: '12:00' }],
  },
  notes: 'Teilzeit berufstätig / Hausfrauen, vormittags frei.',
};

// 7. Leistung — 8 Mitglieder (3–4× pro Woche)
const A_ADVANCED_HIGHFREQUENCY: MemberArchetype = {
  label: 'Leistungssportler (hohe Frequenz)',
  preferredLevel: 'advanced',
  preferredAgeGroup: 'adult',
  maxSessionsPerWeek: 4,
  priority: 10,
  schedule: {
    1: [{ start: '18:00', end: '21:00' }],
    3: [{ start: '18:00', end: '21:00' }],
    5: [{ start: '17:00', end: '20:00' }],
    6: [{ start: '09:00', end: '12:00' }],
  },
  notes: 'Mannschaftsspieler/In, Medenspiele Teilnehmer. Hohe Priorität.',
};

// 8. Hobby-Familie — 15 Mitglieder (Wochenende)
// preferredAgeGroup='adult': die aktiven Spieler sind Eltern (nicht Großeltern).
// KIDS werden in der Regel separat durch A_JUNIOR_AFTERSCHOOL/ CAMP erfasst.
const A_FAMILY_WEEKEND: MemberArchetype = {
  label: 'Hobby-Familie (Wochenende)',
  preferredLevel: 'beginner',
  preferredAgeGroup: 'adult',
  maxSessionsPerWeek: 2,
  priority: 4,
  schedule: {
    6: [{ start: '10:00', end: '12:00' }],
    0: [{ start: '10:00', end: '12:00' }],
  },
  notes: 'Familien-Slot Wochenende (Eltern + Kinder), Anfänger.',
};

// 9. Wochenend-Hobbyspieler — 15 Mitglieder
const A_WEEKEND_HOBBY: MemberArchetype = {
  label: 'Wochenend-Hobbyspieler',
  preferredLevel: 'intermediate',
  preferredAgeGroup: 'senior',
  maxSessionsPerWeek: 2,
  priority: 3,
  schedule: {
    6: [{ start: '14:00', end: '17:00' }],
    0: [{ start: '14:00', end: '17:00' }],
  },
  notes: 'Wochenend-Spieler, Doppelrunde, Hobby-Gruppe.',
};

// 10. Student — 14 Mitglieder
const A_STUDENT: MemberArchetype = {
  label: 'Student (Nachmittag)',
  preferredLevel: 'intermediate',
  preferredAgeGroup: 'adult',
  maxSessionsPerWeek: 3,
  priority: 6,
  schedule: {
    2: [{ start: '15:00', end: '18:00' }],
    4: [{ start: '15:00', end: '18:00' }],
    5: [{ start: '14:00', end: '17:00' }],
  },
  notes: 'Studenten – vorlesungsfreie Zeit, auch Semesterferien.',
};

// ───────────────────────── Deterministische 150er-Liste ─────────────────────────
// Archetype-Reihenfolge: 15× S-Mor, 23× B-Evening, 12× B-Lunch, 23× J-Schule, 10× J-Camp
// 15× Hausfrauen, 8× Leistung, 15× Familie, 15× Weekend-Hobby, 14× Student.
// Total: 150. Modulo-Order über User-Index garantiert stabiles Mapping.
function buildArchetypeQueue(): MemberArchetype[] {
  const seq: { arch: MemberArchetype; n: number }[] = [
    { arch: A_SENIOR_MORNING, n: 15 },
    { arch: A_BUSY_EVENING, n: 23 },
    { arch: A_BUSY_LUNCH, n: 12 },
    { arch: A_JUNIOR_AFTERSCHOOL, n: 23 },
    { arch: A_JUNIOR_CAMP, n: 10 },
    { arch: A_PARTTIME_MORNING, n: 15 },
    { arch: A_ADVANCED_HIGHFREQUENCY, n: 8 },
    { arch: A_FAMILY_WEEKEND, n: 15 },
    { arch: A_WEEKEND_HOBBY, n: 15 },
    { arch: A_STUDENT, n: 14 },
  ];
  const out: MemberArchetype[] = [];
  for (const { arch, n } of seq) {
    for (let i = 0; i < n; i++) out.push(arch);
  }
  if (out.length !== 150) {
    throw new Error(`Archetype-Verteilung muss 150 ergeben — hat aber ${out.length}`);
  }
  return out;
}

// ───────────────────────── Helpers ─────────────────────────

type Stats = { inserted: number; skipped: number; errors: number };
const stats: Stats = { inserted: 0, skipped: 0, errors: 0 };

function log(icon: string, msg: string) {
  // eslint-disable-next-line no-console
  console.log(`  ${icon} ${msg}`);
}
function logSection(title: string) {
  // eslint-disable-next-line no-console
  console.log(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`);
}

const DAY_NAME_BY_INDEX: Record<
  DayKey,
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

function scheduleToJsonb(schedule: WeekSchedule): Record<string, Slot[]> {
  const out: Record<string, Slot[]> = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
  for (const [dayStr, slots] of Object.entries(schedule)) {
    if (!slots || slots.length === 0) continue;
    out[DAY_NAME_BY_INDEX[Number(dayStr)]] = slots;
  }
  return out;
}

// ───────────────────────── Main ─────────────────────────

async function main() {
  const sb = createServiceClient();

  // eslint-disable-next-line no-console
  console.log('\n🎾 SwingZ Member-Preferences Seed – TC Rheinland (Sommer 2026)');
  // eslint-disable-next-line no-console
  console.log('═'.repeat(60));
  // eslint-disable-next-line no-console
  console.log(`  Club:     ${CLUB_NAME}`);
  // eslint-disable-next-line no-console
  console.log(`  Saison:   Sommer ${SEASON_YEAR}`);
  // eslint-disable-next-line no-console
  console.log(`  Mitglieder: ~150 differenzierte Profile\n`);

  // ─── 0. Club + Sommer-Saison finden ─────────────────────────
  logSection('0. Club, Saison & aktive Mitglieder finden');

  const { data: club } = await sb
    .from('clubs')
    .select('id,name')
    .ilike('name', `%${CLUB_NAME}%`)
    .maybeSingle();
  if (!club) {
    // eslint-disable-next-line no-console
    console.error(`\n❌ Club "${CLUB_NAME}" nicht gefunden.`);
    process.exit(1);
  }
  const clubId = club.id;
  log('✅', `${club.name} (${clubId.slice(0, 8)}…)`);

  const { data: season } = await sb
    .from('seasons')
    .select('id,name,planning_status')
    .eq('club_id', clubId)
    .eq('season_type', SEASON_TYPE)
    .eq('year', SEASON_YEAR)
    .maybeSingle();
  if (!season) {
    // eslint-disable-next-line no-console
    console.error(`\n❌ Keine Sommer-${SEASON_YEAR}-Saison in ${CLUB_NAME} gefunden.`);
    process.exit(1);
  }
  log('✅', `Saison: ${season.name} (status=${season.planning_status})`);

  // Aktive planungs-Mitglieder holen (Reihenfolge = email-numerisch).
  // Memberships-Tabelle legt include_in_planning als Gate fest.
  const { data: memberships, error: memErr } = await sb
    .from('user_club_memberships')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('role', 'member')
    .eq('is_active', true)
    .eq('include_in_planning', true);
  if (memErr) {
    // eslint-disable-next-line no-console
    console.error(`\n❌ Memberships-Query fehlgeschlagen: ${memErr.message}`);
    process.exit(1);
  }
  const memberIds = (memberships ?? []).map((m) => m.user_id);
  log('✅', `${memberIds.length} aktive planungs-Members`);

  // Profile-Fields (full_name) für lesbaren Output ermitteln.
  const { data: users, error: uErr } = await sb
    .from('users')
    .select('id,email,full_name')
    .in('id', memberIds)
    .order('email');
  if (uErr) {
    // eslint-disable-next-line no-console
    console.error(`\n❌ Users-Query fehlgeschlagen: ${uErr.message}`);
    process.exit(1);
  }
  const nameById = new Map<string, string>();
  for (const u of users ?? []) nameById.set(u.id, u.full_name ?? u.email ?? u.id.slice(0, 8));
  log('ℹ️', `${(users ?? []).length} User-Profile geladen`);

  // Stable ordering: user_ids nach email sortiert + id-Tiebreak für null-Emails.
  // So bekommt jeder Index i immer denselben Archetype, auch wenn Emails fehlen.
  const orderedUsers = (users ?? []).slice().sort((a, b) => {
    const ea = a.email ?? '';
    const eb = b.email ?? '';
    return ea.localeCompare(eb, 'de') || a.id.localeCompare(b.id);
  });

  // Hinweis zur Idempotenz: user_training_preferences hat KEINEN UNIQUE-Constraint
  // auf (season_id, user_id, user_role) — Pre-Check ist die einzige Absicherung.
  // TOCTOU-Race ist für manuelles Seeding akzeptabel; bei paralleler Ausführung
  // könnten Doppelinserts entstehen. Der Plan ist, dies später in einer
  // eigenen Migration (ALTER TABLE ... ADD CONSTRAINT) abzusichern.
  // → https://github.com/swingz/swingz/issues/... (TODO: tracking issue)

  // ─── 1. Distribution zuweisen ─────────────────────────
  const archetypes = buildArchetypeQueue(); // length = 150
  if (orderedUsers.length !== archetypes.length) {
    log(
      '⚠️',
      `User-Anzahl (${orderedUsers.length}) ≠ Archetype-Slots (${archetypes.length}). ` +
        'Es werden die ersten N Mitglieder verarbeitet — Rest ignoriert. ' +
        'Bei weniger Usern als 150 kommt eine Warnung, das Skript crasht nicht.'
    );
  }
  const n = Math.min(orderedUsers.length, archetypes.length);

  // Verteilungs-Check: wie viel % kommen pro Archetype raus?
  const distCheck = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const a = archetypes[i];
    distCheck.set(a.label, (distCheck.get(a.label) ?? 0) + 1);
  }
  log('ℹ️', 'Verteilung:');
  for (const [label, cnt] of distCheck.entries()) {
    log('  ', `  · ${label}: ${cnt} Mitglieder`);
  }

  // ─── 2. user_training_preferences (user_role='member') befüllen ─
  logSection(`2. user_training_preferences (user_role='member', Saison=${season.name})`);

  for (let i = 0; i < n; i++) {
    const user = orderedUsers[i];
    const arch = archetypes[i];
    const dispName = user.full_name ?? user.email ?? user.id.slice(0, 8);

    // Idempotenz-Pre-Check
    const { data: existing } = await sb
      .from('user_training_preferences')
      .select('id,max_sessions_per_week,is_submitted')
      .eq('season_id', season.id)
      .eq('user_id', user.id)
      .eq('user_role', 'member')
      .maybeSingle();

    if (existing) {
      stats.skipped++;
      continue;
    }

    const totalSlots = Object.values(arch.schedule).flat().length;
    const insertRow: Record<string, unknown> = {
      season_id: season.id,
      user_id: user.id,
      club_id: clubId,
      user_role: 'member',
      preferred_level: arch.preferredLevel,
      preferred_age_group: arch.preferredAgeGroup,
      preferred_group_ids: [],
      weekly_availability: scheduleToJsonb(arch.schedule),
      unavailable_dates: [],
      max_sessions_per_week: arch.maxSessionsPerWeek,
      preferred_court_ids: [],
      can_teach_groups: [],
      priority: arch.priority,
      special_requests: null,
      notes: arch.notes,
      submitted_at: new Date().toISOString(),
      is_submitted: true,
    };

    const { error } = await sb
      .from('user_training_preferences')
      .insert(insertRow)
      .select('id')
      .single();

    if (error) {
      log('❌', `${dispName} (${arch.label}) — ${error.message}`);
      stats.errors++;
      continue;
    }

    stats.inserted++;
    log(
      '✅',
      `[${i + 1}/${n}] ${dispName} — ${arch.label} | ${arch.preferredLevel}/${arch.preferredAgeGroup} | ${totalSlots} Slots, max=${arch.maxSessionsPerWeek}/wk`
    );
  }

  // ─── 3. Zusammenfassung ─────────────────────────
  logSection('Zusammenfassung');
  // eslint-disable-next-line no-console
  console.log(`
  🏟️  Club:              ${club.name}
  🎾  Saison:            ${season.name}
  👥  Mitglieder:        ${n} verarbeitet (von ${orderedUsers.length} vorhanden)

  📊  user_training_preferences (member):
        +${stats.inserted} neu
         ${stats.skipped} bereits vorhanden (idempotent)
  ❗  Errors:            ${stats.errors}

  ⚡ Wiederverwendbar: jeder Lauf ist idempotent.
  ♻️  Verteilung anpassen: buildArchetypeQueue() in dieser Datei editieren.
`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('\n❌ FATAL:', e);
  process.exit(1);
});
