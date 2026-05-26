/**
 * Seed-Skript: 5 Test-Trainer mit allen Details anlegen
 *
 * Erstellt in:
 *   - users (Auth-User)
 *   - trainers (Trainer-Record)
 *   - trainer_club (Club-Verknüpfung)
 *   - user_club_memberships (Rollen-Verknüpfung)
 *   - trainer_profiles (Detail-Profil mit Qualifikationen)
 *   - trainer_availabilities (Verfügbarkeiten)
 *   - user_training_preferences (Saison-Präferenzen)
 */

import { createServiceClient } from '@/lib/supabase/service';

const CLUB_ID = 'e7cb492c-8e16-4b89-b62d-12d46fba8bbf';
const SEASON_ID = '6bd8f187-48b8-45eb-af39-e0813e8af088';

interface TrainerDef {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  specialties: string[];
  qualifications: Array<{
    id: string;
    name: string;
    issuer: string;
    issuedDate: string;
    expiryDate?: string;
    verified: boolean;
  }>;
  experience: {
    years: number;
    previousClubs: string[];
    achievements: string[];
  };
  bio: string;
  languages: string[];
  maxHoursPerWeek: number;
  hourlyRate: number;
  availability: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  preferredTimeSlots: Array<{ start: string; end: string }>;
}

const TEST_TRAINERS: TrainerDef[] = [
  {
    firstName: 'Markus',
    lastName: 'Kowalski',
    email: 'markus.kowalski@swingz.com',
    phone: '+49 151 12345678',
    dateOfBirth: '1985-03-15',
    specialties: ['Anfänger', 'Fortgeschrittene', 'Kindertraining', 'Schnuppertraining'],
    qualifications: [
      {
        id: 'qual-1',
        name: 'DTB B-Trainer Lizenz',
        issuer: 'Deutscher Tennis Bund',
        issuedDate: '2010-06-15',
        expiryDate: '2027-06-15',
        verified: true,
      },
      {
        id: 'qual-2',
        name: 'Cardio Tennis Instructor',
        issuer: 'ITF Academy',
        issuedDate: '2015-09-01',
        verified: true,
      },
      {
        id: 'qual-3',
        name: 'Erste-Hilfe-Zertifikat',
        issuer: 'DRK München',
        issuedDate: '2024-01-20',
        expiryDate: '2026-01-20',
        verified: true,
      },
    ],
    experience: {
      years: 18,
      previousClubs: ['TC Rot-Weiß München', 'MTV München von 1879'],
      achievements: ['Bayerischer Meister 2008 (Herren 30)', 'Jugendtrainer des Jahres 2019'],
    },
    bio: 'Leidenschaftlicher Tennistrainer mit Fokus auf Technikentwicklung. Ich glaube an spielerisches Lernen und individuelles Coaching.',
    languages: ['Deutsch', 'Englisch', 'Polnisch'],
    maxHoursPerWeek: 30,
    hourlyRate: 45.0,
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false,
    },
    preferredTimeSlots: [
      { start: '08:00', end: '13:00' },
      { start: '15:00', end: '20:00' },
    ],
  },
  {
    firstName: 'Sabine',
    lastName: 'Winkler',
    email: 'sabine.winkler@swingz.com',
    phone: '+49 152 23456789',
    dateOfBirth: '1990-07-22',
    specialties: ['Fortgeschrittene', 'Leistungssport', 'Einzeltraining', 'Turniervorbereitung'],
    qualifications: [
      {
        id: 'qual-4',
        name: 'DTB A-Trainer Lizenz',
        issuer: 'Deutscher Tennis Bund',
        issuedDate: '2015-04-10',
        expiryDate: '2028-04-10',
        verified: true,
      },
      {
        id: 'qual-5',
        name: 'Mental Coach Zertifikat',
        issuer: 'IST Düsseldorf',
        issuedDate: '2018-11-01',
        verified: true,
      },
    ],
    experience: {
      years: 13,
      previousClubs: ['TC Großhesselohe', 'TennisBase Oberhaching'],
      achievements: ['Ehemalige WTA-Spielerin (Top 300)', 'Coach von 3 nationalen Jugendmeistern'],
    },
    bio: 'Als ehemalige Profispielerin weiß ich, was es braucht, um auf höchstem Niveau zu spielen. Spezialisiert auf Technik-Feinabstimmung und Wettkampfvorbereitung.',
    languages: ['Deutsch', 'Englisch', 'Französisch'],
    maxHoursPerWeek: 25,
    hourlyRate: 55.0,
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false,
    },
    preferredTimeSlots: [
      { start: '09:00', end: '14:00' },
      { start: '16:00', end: '21:00' },
    ],
  },
  {
    firstName: 'Thomas',
    lastName: 'Bergmann',
    email: 'thomas.bergmann@swingz.com',
    phone: '+49 153 34567890',
    dateOfBirth: '1978-11-05',
    specialties: ['Anfänger', 'Breitensport', 'Seniorentraining', 'Mannschaftstraining'],
    qualifications: [
      {
        id: 'qual-6',
        name: 'DTB C-Trainer Lizenz',
        issuer: 'Deutscher Tennis Bund',
        issuedDate: '2008-03-20',
        expiryDate: '2026-03-20',
        verified: true,
      },
      {
        id: 'qual-7',
        name: 'Sportmanagement (B.A.)',
        issuer: 'TU München',
        issuedDate: '2005-09-01',
        verified: true,
      },
      {
        id: 'qual-8',
        name: 'Beach Tennis Instructor',
        issuer: 'ITF Academy',
        issuedDate: '2020-05-15',
        verified: true,
      },
    ],
    experience: {
      years: 20,
      previousClubs: ['TC Ismaning', 'SV Lohhof', 'TC Neufahrn'],
      achievements: [
        'Mannschaftsmeister Bezirksliga 2016',
        'Aufbau der Jugendabteilung TC Ismaning (200 Mitglieder)',
      ],
    },
    bio: 'Tennis ist meine Leidenschaft seit 35 Jahren. Ich liebe es, Anfänger an den Sport heranzuführen und Mannschaften zu formen.',
    languages: ['Deutsch', 'Englisch'],
    maxHoursPerWeek: 28,
    hourlyRate: 40.0,
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
    preferredTimeSlots: [
      { start: '08:00', end: '12:00' },
      { start: '17:00', end: '22:00' },
    ],
  },
  {
    firstName: 'Julia',
    lastName: 'Hartmann',
    email: 'julia.hartmann@swingz.com',
    phone: '+49 154 45678901',
    dateOfBirth: '1993-04-30',
    specialties: ['Kindertraining', 'Jugendtraining', 'Anfänger', 'Schnuppertraining'],
    qualifications: [
      {
        id: 'qual-9',
        name: 'DTB B-Trainer Lizenz',
        issuer: 'Deutscher Tennis Bund',
        issuedDate: '2017-08-15',
        expiryDate: '2027-08-15',
        verified: true,
      },
      {
        id: 'qual-10',
        name: 'Kinder- und Jugendcoach',
        issuer: 'Landessportverband Bayern',
        issuedDate: '2018-06-01',
        verified: true,
      },
      {
        id: 'qual-11',
        name: 'Sportwissenschaften (M.Sc.)',
        issuer: 'TU München',
        issuedDate: '2019-03-01',
        verified: true,
      },
    ],
    experience: {
      years: 9,
      previousClubs: ['TC Großhesselohe', 'Münchner Sportclub'],
      achievements: [
        'Entwicklung eines Kindertennis-Curriculums für 4-12 Jährige',
        'Jugend-Bezirksmeister U12 2021 (als Coach)',
      ],
    },
    bio: 'Ich bin überzeugt, dass Kinder mit der richtigen Methodik und viel Spaß zu großartigen Tennisspielern werden können. Meine Trainingseinheiten sind spielerisch und motivierend.',
    languages: ['Deutsch', 'Englisch', 'Spanisch'],
    maxHoursPerWeek: 30,
    hourlyRate: 42.0,
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false,
    },
    preferredTimeSlots: [{ start: '14:00', end: '18:00' }],
  },
  {
    firstName: 'Christian',
    lastName: 'Lange',
    email: 'christian.lange@swingz.com',
    phone: '+49 155 56789012',
    dateOfBirth: '1987-09-18',
    specialties: ['Fortgeschrittene', 'Leistungssport', 'Turniervorbereitung', 'Fitness-Training'],
    qualifications: [
      {
        id: 'qual-12',
        name: 'DTB A-Trainer Lizenz',
        issuer: 'Deutscher Tennis Bund',
        issuedDate: '2014-02-01',
        expiryDate: '2028-02-01',
        verified: true,
      },
      {
        id: 'qual-13',
        name: 'Athletik-Trainer Zertifikat',
        issuer: 'IST Düsseldorf',
        issuedDate: '2016-10-01',
        verified: true,
      },
      {
        id: 'qual-14',
        name: 'Video Analyse Coach',
        issuer: 'ITF Academy',
        issuedDate: '2021-07-01',
        verified: true,
      },
    ],
    experience: {
      years: 15,
      previousClubs: ['TC Rot-Weiß München', 'TC Piding'],
      achievements: [
        'Coach von 2 ATP-Spielern (Top 500)',
        'Bayerischer Meister 2012 (Herren)',
        'Teilnahme ATP Challenger Tour als Spieler (2006-2010)',
      ],
    },
    bio: 'Hochleistungssport erfordert Präzision in Technik, Taktik und Athletik. Ich kombiniere moderne Videoanalyse mit bewährten Trainingsmethoden.',
    languages: ['Deutsch', 'Englisch'],
    maxHoursPerWeek: 24,
    hourlyRate: 60.0,
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true,
    },
    preferredTimeSlots: [
      { start: '08:00', end: '12:00' },
      { start: '15:00', end: '20:00' },
    ],
  },
];

function generateWeeklyAvailability(
  days: string[]
): Record<string, Array<{ start: string; end: string }>> {
  const result: Record<string, Array<{ start: string; end: string }>> = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
  for (const day of days) {
    result[day] = [
      { start: '09:00', end: '12:00' },
      { start: '17:00', end: '21:00' },
    ];
  }
  return result;
}

async function seed() {
  console.log('🚀 Starte Seed für 5 Test-Trainer...\n');

  const supabase = createServiceClient();

  // Prüfe Club
  const { data: club } = await supabase.from('clubs').select('id, name').eq('id', CLUB_ID).single();

  if (!club) {
    console.error('❌ Club nicht gefunden! Bitte CLUB_ID prüfen.');
    process.exit(1);
  }
  console.log(`🏟️  Club: ${club.name} (${CLUB_ID})`);

  // Prüfe Season
  const { data: season } = await supabase
    .from('seasons')
    .select('id, name')
    .eq('id', SEASON_ID)
    .single();

  if (!season) {
    console.warn('⚠️  Season nicht gefunden. Trainer-Präferenzen werden ohne Season-ID angelegt.');
  } else {
    console.log(`📅 Season: ${season.name} (${SEASON_ID})`);
  }

  let trainersCreated = 0;
  let profilesCreated = 0;
  let membershipsCreated = 0;
  let availabilitiesCreated = 0;
  let preferencesCreated = 0;

  for (const trainer of TEST_TRAINERS) {
    const fullName = `${trainer.firstName} ${trainer.lastName}`;
    console.log(`\n👤 Verarbeite ${fullName}...`);

    // ── Schritt 1: User anlegen (falls nicht existiert) ─────────────
    let userId: string;
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', trainer.email)
      .maybeSingle();

    if (existingUser) {
      userId = existingUser.id;
      console.log(`  ⏭️  User existiert bereits: ${trainer.email}`);
    } else {
      const { data: newUser, error: userErr } = await supabase
        .from('users')
        .insert({
          email: trainer.email,
          full_name: fullName,
          phone: trainer.phone,
          skill_level: 'advanced',
          experience_months: trainer.experience.years * 12,
          subscription_tier: 'free',
          subscription_status: 'active',
        })
        .select('id')
        .single();

      if (userErr) {
        console.error(`  ❌ Fehler bei User ${trainer.email}:`, userErr.message);
        continue;
      }
      userId = newUser.id;
      console.log(`  ✅ User angelegt: ${userId.substring(0, 8)}`);
    }

    // ── Schritt 2: Trainer-Record anlegen ────────────────────────────
    let trainerId: string;
    const { data: existingTrainer } = await supabase
      .from('trainers')
      .select('id')
      .eq('email', trainer.email)
      .maybeSingle();

    if (existingTrainer) {
      trainerId = existingTrainer.id;
      console.log(`  ⏭️  Trainer existiert bereits`);

      // Update existing trainer details
      await supabase
        .from('trainers')
        .update({
          name: fullName,
          specialties: trainer.specialties,
          max_hours_per_week: trainer.maxHoursPerWeek,
          is_active: true,
        })
        .eq('id', trainerId);
    } else {
      const { data: newTrainer, error: tErr } = await supabase
        .from('trainers')
        .insert({
          email: trainer.email,
          name: fullName,
          specialties: trainer.specialties,
          max_hours_per_week: trainer.maxHoursPerWeek,
          is_active: true,
        })
        .select('id')
        .single();

      if (tErr) {
        console.error(`  ❌ Fehler bei trainer record:`, tErr.message);
        continue;
      }
      trainerId = newTrainer.id;
      console.log(`  ✅ Trainer-Record angelegt: ${trainerId.substring(0, 8)}`);
      trainersCreated++;
    }

    // ── Schritt 3: Trainer-Club Verknüpfung ─────────────────────────
    const { data: existingLink } = await supabase
      .from('trainer_club')
      .select('*')
      .match({ trainer_id: trainerId, club_id: CLUB_ID })
      .maybeSingle();

    if (!existingLink) {
      const { error: tcErr } = await supabase.from('trainer_club').insert({
        trainer_id: trainerId,
        club_id: CLUB_ID,
      });

      if (tcErr) {
        console.error(`  ❌ Fehler bei trainer_club:`, tcErr.message);
      } else {
        console.log(`  ✅ Trainer-Club verknüpft`);
      }
    } else {
      console.log(`  ⏭️  Trainer-Club-Verknüpfung existiert bereits`);
    }

    // ── Schritt 4: User-Club-Membership ─────────────────────────────
    const { data: existingMembership } = await supabase
      .from('user_club_memberships')
      .select('id')
      .match({ user_id: userId, club_id: CLUB_ID })
      .maybeSingle();

    if (!existingMembership) {
      const { error: mErr } = await supabase.from('user_club_memberships').insert({
        user_id: userId,
        club_id: CLUB_ID,
        role: 'trainer',
        is_active: true,
        include_in_planning: true,
      });

      if (mErr) {
        console.error(`  ❌ Fehler bei membership:`, mErr.message);
      } else {
        console.log(`  ✅ Membership angelegt (role=trainer)`);
        membershipsCreated++;
      }
    } else {
      // Update existing
      await supabase
        .from('user_club_memberships')
        .update({ role: 'trainer', is_active: true, include_in_planning: true })
        .match({ user_id: userId, club_id: CLUB_ID });
      console.log(`  ⏭️  Membership existiert bereits (aktualisiert)`);
    }

    // ── Schritt 5: Trainer-Profil ───────────────────────────────────
    // NOTE: trainer_profiles.user_id references auth.users, not public.users.
    // Skip for now — profiles are created through the /api/trainer-profiles endpoint.
    console.log(`  ⏭️  Trainer-Profil übersprungen (wird über API erstellt)`);

    // ── Schritt 6: Trainer-Verfügbarkeiten ─────────────────────────
    // Weekly recurring availability for next 4 weeks
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const availableDays = Object.entries(trainer.availability)
      .filter(([, v]) => v)
      .map(([day]) => day);

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    // Find the start of the current week (Monday)
    const dayOfWeek = startDate.getDay();
    const monday = new Date(startDate);
    monday.setDate(monday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    for (const day of availableDays) {
      const targetDay = dayMap[day];
      for (let week = 0; week < 4; week++) {
        const date = new Date(monday);
        date.setDate(date.getDate() + targetDay + week * 7);

        const dateStr = date.toISOString().split('T')[0];

        // Check if availability already exists
        const { data: existingAvail } = await supabase
          .from('trainer_availabilities')
          .select('id')
          .match({
            trainer_id: trainerId,
            date: dateStr,
          })
          .maybeSingle();

        if (!existingAvail) {
          const { error: aErr } = await supabase.from('trainer_availabilities').insert({
            trainer_id: trainerId,
            date: dateStr,
            start_time: '09:00',
            end_time: '17:00',
            status: 'available',
          });

          if (!aErr) {
            availabilitiesCreated++;
          }
        }
      }
    }

    if (availableDays.length > 0) {
      console.log(`  ✅ Verfügbarkeiten angelegt (${availableDays.length} Tage × 4 Wochen)`);
    }

    // ── Schritt 7: Training-Präferenzen für die Season ──────────────
    if (season) {
      const { data: existingPrefs } = await supabase
        .from('user_training_preferences')
        .select('id')
        .match({ season_id: SEASON_ID, user_id: userId })
        .maybeSingle();

      if (!existingPrefs) {
        const weeklyAvailability = generateWeeklyAvailability(availableDays);
        const { error: prefErr } = await supabase.from('user_training_preferences').insert({
          season_id: SEASON_ID,
          user_id: userId,
          club_id: CLUB_ID,
          user_role: 'trainer',
          preferred_level: 'advanced',
          weekly_availability: weeklyAvailability,
          max_sessions_per_week: Math.floor(trainer.maxHoursPerWeek / 1.5),
          can_teach_groups: trainer.specialties,
          is_submitted: true,
          submitted_at: new Date().toISOString(),
          priority: 10,
        });

        if (prefErr) {
          console.error(`  ❌ Fehler bei training preferences:`, prefErr.message);
        } else {
          console.log(`  ✅ Training-Präferenzen angelegt`);
          preferencesCreated++;
        }
      } else {
        console.log(`  ⏭️  Training-Präferenzen existieren bereits`);
      }
    }
  }

  // ── Zusammenfassung ─────────────────────────────────────────────
  const { count: totalTrainers } = await supabase
    .from('trainers')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const { count: totalProfiles } = await supabase
    .from('trainer_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', CLUB_ID);

  const { count: totalMemberships } = await supabase
    .from('user_club_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', CLUB_ID)
    .eq('role', 'trainer');

  console.log('\n' + '='.repeat(50));
  console.log('📋 SEED-ZUSAMMENFASSUNG');
  console.log('='.repeat(50));
  console.log(`Club:             ${club.name}`);
  console.log(`Season:           ${season?.name || 'Nicht gefunden'}`);
  console.log(`Trainer (DB):     ${totalTrainers}`);
  console.log(`  - neu erstellt: ${trainersCreated}`);
  console.log(`Trainer-Profile:  ${totalProfiles} (${profilesCreated} neu)`);
  console.log(`Memberships:      ${totalMemberships} (${membershipsCreated} neu)`);
  console.log(`Verfügbarkeiten:  ${availabilitiesCreated} Slots`);
  console.log(`Präferenzen:      ${preferencesCreated} neu`);
  console.log('='.repeat(50));
  console.log('\n✅ Seed abgeschlossen!');
}

seed().catch((err) => {
  console.error('❌ Seed fehlgeschlagen:', err);
  process.exit(1);
});
