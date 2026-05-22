/**
 * Seed-Skript: Squash Club Munich – 75 Mitglieder + 5 Trainer mit Präferenzen
 * 
 * Führt die Wizard-Schritte 1-3 aus (Mitglieder anlegen, Präferenzen setzen,
 * Trainer einrichten) als Vorbereitung für die Cluster-API (Schritte 4-7).
 */

import { createClient } from '@supabase/supabase-js';

const CLUB_ID = 'e7cb492c-8e16-4b89-b62d-12d46fba8bbf';
const SEASON_ID = '6bd8f187-48b8-45eb-af39-e0813e8af088';

const FIRST_NAMES_MALE = [
  'Lukas', 'Felix', 'Maximilian', 'Leon', 'Paul', 'Jonas', 'Tim', 'Niklas',
  'Finn', 'Julian', 'Luis', 'Mats', 'Elias', 'Simon', 'Oskar', 'David',
  'Noah', 'Ben', 'Tom', 'Samuel', 'Philipp', 'Fabian', 'Jan', 'Moritz',
  'Lennart', 'Rafael', 'Adrian', 'Vincent', 'Nico', 'Jannik', 'Marco',
  'Daniel', 'Alexander', 'Stefan', 'Christian', 'Michael', 'Andreas',
  'Thomas', 'Markus', 'Johannes', 'Matthias', 'Sebastian', 'Florian',
  'Patrick', 'Dominik', 'Lars', 'Sven', 'Oliver', 'Tobias', 'Benjamin'
];

const FIRST_NAMES_FEMALE = [
  'Anna', 'Laura', 'Sarah', 'Lisa', 'Julia', 'Emma', 'Sophie', 'Marie',
  'Lena', 'Hannah', 'Mia', 'Emily', 'Lina', 'Lea', 'Nele', 'Amelie',
  'Lara', 'Leonie', 'Johanna', 'Maya', 'Paula', 'Marlene', 'Ida', 'Clara',
  'Theresa', 'Alina', 'Katharina', 'Sabrina', 'Nadine', 'Vanessa'
];

const LAST_NAMES = [
  'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker',
  'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf',
  'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger',
  'Hofmann', 'Hartmann', 'Lange', 'Schmitt', 'Werner', 'Schmitz', 'Krause',
  'Meier', 'Lehmann', 'Schmid', 'Huber', 'Mayer', 'Herrmann', 'König',
  'Walter', 'Lang', 'Jung', 'Hahn', 'Keller', 'Vogel', 'Schubert',
  'Roth', 'Frank', 'Berger', 'Winkler', 'Peters', 'Scholz', 'Möller',
  'Weiß', 'Graf', 'Friedrich', 'Pohl', 'Seidel', 'Engel', 'Haas'
];

const TRAINERS = [
  { firstName: 'Thomas', lastName: 'Steiner', specialties: ['Anfänger', 'Fortgeschrittene', 'Kindertraining'] },
  { firstName: 'Sabine', lastName: 'Winkler', specialties: ['Fortgeschrittene', 'Leistungssport', 'Einzeltraining'] },
  { firstName: 'Michael', lastName: 'Bergmann', specialties: ['Anfänger', 'Breitensport', 'Mannschaftstraining'] },
  { firstName: 'Julia', lastName: 'Hartmann', specialties: ['Kindertraining', 'Jugendtraining', 'Anfänger'] },
  { firstName: 'Christian', lastName: 'Lange', specialties: ['Fortgeschrittene', 'Leistungssport', 'Turniervorbereitung'] },
];

function randomLevel(): string {
  const levels = ['beginner', 'beginner', 'intermediate', 'intermediate', 'intermediate', 'advanced', 'advanced', 'pro'];
  return levels[Math.floor(Math.random() * levels.length)];
}

function randomExperience(level: string): number {
  switch (level) {
    case 'beginner': return Math.floor(Math.random() * 6) + 1; // 1-6 Monate
    case 'intermediate': return Math.floor(Math.random() * 24) + 12; // 12-36 Monate
    case 'advanced': return Math.floor(Math.random() * 36) + 36; // 36-72 Monate
    case 'pro': return Math.floor(Math.random() * 60) + 60; // 60-120 Monate
    default: return 12;
  }
}

function getAvailabilityDays(): number[] {
  // Generate 2-4 random weekdays
  const weekdays = [1, 2, 3, 4, 5]; // Mon-Fri
  const count = Math.floor(Math.random() * 3) + 2; // 2-4 days
  const shuffled = [...weekdays].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);
  // Sometimes include Saturday
  if (Math.random() > 0.5) selected.push(6);
  return selected;
}

function generateAvailability(days: number[]): Record<string, Array<{ start: string; end: string }>> {
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const timeSlots = [
    { start: '15:00', end: '17:00' },
    { start: '17:00', end: '19:00' },
    { start: '19:00', end: '21:00' },
  ];
  
  const availability: Record<string, Array<{ start: string; end: string }>> = {
    monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
  };
  
  for (const day of days) {
    const dayName = dayNames[day - 1];
    // Pick 1-2 time slots for this day
    const slotCount = Math.floor(Math.random() * 2) + 1;
    const shuffledSlots = [...timeSlots].sort(() => Math.random() - 0.5);
    availability[dayName] = shuffledSlots.slice(0, slotCount);
  }
  
  return availability;
}

function generateWishPartners(currentIndex: number, total: number): string[] {
  // Some members have wish partners
  if (Math.random() > 0.4) return [];
  const count = Math.floor(Math.random() * 2) + 1; // 1-2 wish partners
  const partners: number[] = [];
  for (let i = 0; i < count; i++) {
    let partner = Math.floor(Math.random() * total);
    // Avoid pairing with self
    if (partner === currentIndex) {
      partner = (partner + 1) % total;
    }
    // Avoid duplicates
    const partnerId = `${CLUB_ID.slice(0, 8)}-${partner.toString().padStart(4, '0')}-${'0'.repeat(12)}`;
    if (!partners.includes(partner)) {
      partners.push(partner);
    }
  }
  return partners.map(p => p.toString());
}

async function seed() {
  console.log('🚀 Starte Seed für Squash Club Munich...\n');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ─── Schritt 1: Bestehende Daten prüfen ─────────────────────────
  const { data: existingMembers } = await supabase
    .from('user_club_memberships')
    .select('user_id')
    .eq('club_id', CLUB_ID);
  
  const existingUserIds = (existingMembers || []).map(m => m.user_id);
  console.log(`📊 Bestehende Mitglieder: ${existingUserIds.length}`);
  
  // ─── Schritt 2: Trainer anlegen (in trainers + users) ───────────
  const trainerUserIds: string[] = [];
  const trainerIds: string[] = [];

  for (const trainer of TRAINERS) {
    const email = `trainer.${trainer.firstName.toLowerCase()}.${trainer.lastName.toLowerCase()}@swingz.com`;
    
    // Create user
    const { data: newUser, error: userErr } = await supabase
      .from('users')
      .insert({
        email,
        full_name: `${trainer.firstName} ${trainer.lastName}`,
        skill_level: 'advanced',
        experience_months: 120,
        subscription_tier: 'free',
        subscription_status: 'active',
      })
      .select('id')
      .maybeSingle();

    if (userErr && !userErr.message.includes('duplicate') && !userErr.message.includes('exists')) {
      // Check if already exists
      const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
      if (existing) {
        trainerUserIds.push(existing.id);
        console.log(`  ⚠️ Trainer ${email} existiert bereits`);
        continue;
      }
    }

    if (newUser) {
      trainerUserIds.push(newUser.id);
      console.log(`  ✅ Trainer ${trainer.firstName} ${trainer.lastName} (${email}) angelegt`);
    }
  }

  // Create trainer records in trainers table
  for (let i = 0; i < TRAINERS.length; i++) {
    const trainer = TRAINERS[i];
    const email = `trainer.${trainer.firstName.toLowerCase()}.${trainer.lastName.toLowerCase()}@swingz.com`;
    
    const { data: newTrainer, error: tErr } = await supabase
      .from('trainers')
      .insert({
        email,
        name: `${trainer.firstName} ${trainer.lastName}`,
        specialties: trainer.specialties,
        max_hours_per_week: 25,
        is_active: true,
      })
      .select('id')
      .single();

    if (tErr) {
      if (tErr.message.includes('duplicate')) {
        const { data: existing } = await supabase.from('trainers').select('id').eq('email', email).single();
        if (existing) trainerIds.push(existing.id);
        continue;
      }
      console.error(`  ❌ Fehler bei trainer record ${email}:`, tErr.message);
      continue;
    }

    if (newTrainer) {
      trainerIds.push(newTrainer.id);
    }
  }

  // Link trainers to club
  for (const tId of trainerIds) {
    const { error: tcErr } = await supabase
      .from('trainer_club')
      .insert({ trainer_id: tId, club_id: CLUB_ID })
      .maybeSingle();

    if (tcErr && !tcErr.message.includes('duplicate')) {
      console.error(`  ❌ Fehler bei trainer_club:`, tcErr.message);
    }
  }

  // Add trainers to user_club_memberships
  for (const uId of trainerUserIds) {
    // Check if exists first
    const { data: existingMembership } = await supabase
      .from('user_club_memberships')
      .select('id')
      .match({ user_id: uId, club_id: CLUB_ID })
      .maybeSingle();
    
    if (!existingMembership) {
      await supabase.from('user_club_memberships').insert({
        user_id: uId,
        club_id: CLUB_ID,
        role: 'trainer',
        is_active: true,
        include_in_planning: true,
      });
    }
  }

  console.log(`\n✅ ${trainerIds.length} Trainer angelegt/verknüpft`);
  console.log(`✅ ${trainerUserIds.length} Trainer-User angelegt`);

  // ─── Schritt 3: 75 Mitglieder anlegen ───────────────────────────
  const allNames: Array<{ first: string; last: string }> = [];
  const namePool = [
    ...FIRST_NAMES_MALE.map(n => ({ first: n, gender: 'M' as const })),
    ...FIRST_NAMES_FEMALE.map(n => ({ first: n, gender: 'F' as const })),
  ];

  for (let i = 0; i < 75; i++) {
    const entry = namePool[Math.floor(Math.random() * namePool.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    allNames.push({ first: entry.first, last: lastName });
  }

  // Remove duplicates
  const uniqueNames = allNames.filter((n, idx, self) => 
    idx === self.findIndex(s => s.first === n.first && s.last === n.last)
  );

  // Fill up to 75
  while (uniqueNames.length < 75) {
    const entry = namePool[Math.floor(Math.random() * namePool.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const candidate = { first: entry.first, last: lastName };
    if (!uniqueNames.find(n => n.first === candidate.first && n.last === candidate.last)) {
      uniqueNames.push(candidate);
    }
  }

  const memberUserIds: string[] = [];
  const memberNames: Array<{ id: string; name: string; level: string; experience: number }> = [];

  for (let i = 0; i < uniqueNames.length; i++) {
    const name = uniqueNames[i];
    const email = `member.${name.first.toLowerCase()}.${name.last.toLowerCase()}.${i}@swingz.com`;
    const level = randomLevel();
    const experience = randomExperience(level);

    const { data: newUser, error: uErr } = await supabase
      .from('users')
      .insert({
        email,
        full_name: `${name.first} ${name.last}`,
        subscription_tier: 'free',
        subscription_status: 'active',
      })
      .select('id')
      .maybeSingle();

    if (uErr && !uErr.message.includes('duplicate') && !uErr.message.includes('already exists')) {
      console.error(`  ❌ Fehler bei ${email}:`, uErr.message.substring(0, 100));
      continue;
    }

    if (!newUser) {
      // Try to find existing
      const { data: existing } = await supabase.from('users').select('id, full_name').eq('email', email).maybeSingle();
      if (existing) {
        memberUserIds.push(existing.id);
        memberNames.push({ 
          id: existing.id, 
          name: existing.full_name || `${name.first} ${name.last}`,
          level,
          experience,
        });
      }
      continue;
    }

    if (newUser) {
      memberUserIds.push(newUser.id);
      memberNames.push({ 
        id: newUser.id, 
        name: `${name.first} ${name.last}`,
        level,
        experience,
      });
    }

    if (i % 25 === 0) console.log(`  ... ${i}/${uniqueNames.length} Mitglieder angelegt`);
  }

  console.log(`\n✅ ${memberUserIds.length} Mitglieder in users-Tabelle angelegt`);
  console.log(`   Level-Verteilung:`, {
    beginner: memberNames.filter(m => m.level === 'beginner').length,
    intermediate: memberNames.filter(m => m.level === 'intermediate').length,
    advanced: memberNames.filter(m => m.level === 'advanced').length,
    pro: memberNames.filter(m => m.level === 'pro').length,
  });

  // ─── Schritt 4: Mitglieder in user_club_memberships verknüpfen ──
  let membershipCount = 0;
  for (const userId of memberUserIds) {
    const { data: existing } = await supabase
      .from('user_club_memberships')
      .select('id')
      .match({ user_id: userId, club_id: CLUB_ID })
      .maybeSingle();

    if (!existing) {
      const { error: mErr } = await supabase.from('user_club_memberships').insert({
        user_id: userId,
        club_id: CLUB_ID,
        role: 'member',
        is_active: true,
        include_in_planning: true,
      });
      if (!mErr) membershipCount++;
    }
  }
  console.log(`✅ ${membershipCount} Mitgliedschaften verknüpft`);

  // ─── Schritt 5: Season-Status aktualisieren ─────────────────────
  await supabase
    .from('seasons')
    .update({
      planning_status: 'collecting_preferences',
      preferences_open: true,
      preferences_deadline: new Date('2026-05-21').toISOString(),
      is_active: true,
    })
    .eq('id', SEASON_ID);
  console.log(`✅ Season auf 'collecting_preferences' gesetzt`);

  // ─── Schritt 6: Training Preferences für alle Mitglieder ────────
  let prefCount = 0;
  for (let i = 0; i < memberNames.length; i++) {
    const member = memberNames[i];
    const days = getAvailabilityDays();
    const availability = generateAvailability(days);
    
    // Some members have wish partners
    let wishPartners: string[] = [];
    if (Math.random() > 0.6) {
      const partnerCount = Math.floor(Math.random() * 2) + 1;
      for (let p = 0; p < partnerCount; p++) {
        const partnerIdx = Math.floor(Math.random() * memberNames.length);
        if (partnerIdx !== i && !wishPartners.includes(memberNames[partnerIdx].id)) {
          wishPartners.push(memberNames[partnerIdx].id);
        }
      }
    }

    const { error: pErr } = await supabase.from('user_training_preferences').insert({
      season_id: SEASON_ID,
      user_id: member.id,
      club_id: CLUB_ID,
      user_role: 'member',
      preferred_level: member.level,
      weekly_availability: availability,
      is_submitted: true,
      submitted_at: new Date().toISOString(),
      priority: Math.floor(Math.random() * 5) + 3, // 3-7
    }).maybeSingle();

    if (pErr && !pErr.message.includes('duplicate')) {
      if (i % 20 === 0) console.error(`  ❌ Prefs error at ${i}:`, pErr.message.substring(0, 100));
    } else {
      prefCount++;
    }
  }
  console.log(`✅ ${prefCount} Training Preferences angelegt`);

  // ─── Schritt 7: Trainer Preferences anlegen ─────────────────────
  let trainerPrefCount = 0;
  for (const trainerId of trainerUserIds) {
    const trainer = TRAINERS[trainerPrefCount % TRAINERS.length];
    const availability = {
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '17:00' }],
      thursday: [{ start: '09:00', end: '17:00' }],
      friday: [{ start: '09:00', end: '17:00' }],
      saturday: [{ start: '10:00', end: '14:00' }],
      sunday: [],
    };

    const { error: pErr } = await supabase.from('user_training_preferences').insert({
      season_id: SEASON_ID,
      user_id: trainerId,
      club_id: CLUB_ID,
      user_role: 'trainer',
      preferred_level: 'advanced',
      weekly_availability: availability,
      max_sessions_per_week: 15,
      can_teach_groups: trainer.specialties,
      is_submitted: true,
      submitted_at: new Date().toISOString(),
      priority: 10,
    }).maybeSingle();

    if (pErr && !pErr.message.includes('duplicate')) {
      console.error(`  ❌ Trainer Prefs error:`, pErr.message.substring(0, 100));
    } else {
      trainerPrefCount++;
    }
  }
  console.log(`✅ ${trainerPrefCount} Trainer Preferences angelegt`);

  // ─── Schritt 8: Season auf member_selection setzen ──────────────
  await supabase
    .from('seasons')
    .update({ planning_status: 'member_selection' })
    .eq('id', SEASON_ID);
  console.log(`✅ Season auf 'member_selection' gesetzt`);

  // ─── Schritt 9: Admin Member auswählen (alle aktiven Mitglieder) ─
  const allMemberIds = [...memberUserIds, ...trainerUserIds];
  
  // Set include_in_planning for members
  for (const uid of allMemberIds) {
    await supabase
      .from('user_club_memberships')
      .update({ include_in_planning: true })
      .match({ user_id: uid, club_id: CLUB_ID });
  }
  console.log(`✅ ${allMemberIds.length} Mitglieder für Planung selektiert`);

  // ─── Schritt 10: Planning Config erstellen ──────────────────────
  const { data: existingConfig } = await supabase
    .from('season_planning_configs')
    .select('id')
    .eq('season_id', SEASON_ID)
    .maybeSingle();

  if (!existingConfig) {
    await supabase.from('season_planning_configs').insert({
      club_id: CLUB_ID,
      season_id: SEASON_ID,
      max_niveau_span_beginner_months: 4,
      max_niveau_span_advanced_months: 8,
      trainer_utilization_max_pct: 80,
      group_min_size: 3,
      group_max_size: 12,
      ai_clustering_enabled: true,
      prefer_historic_groups: true,
      avoid_high_failure_slots: true,
      slot_failure_rate_threshold_pct: 30,
      waitlist_priority_rule: 'registration_time',
      proven_group_attendance_threshold_pct: 80,
    });
    console.log(`✅ Planning Config erstellt`);
  } else {
    console.log(`✅ Planning Config existiert bereits`);
  }

  // ─── Zusammenfassung ────────────────────────────────────────────
  const { count: totalMembers } = await supabase
    .from('user_club_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', CLUB_ID)
    .eq('is_active', true);

  const { count: totalPrefs } = await supabase
    .from('user_training_preferences')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', SEASON_ID);

  const { count: allTrainers } = await supabase
    .from('trainers')
    .select('*', { count: 'exact', head: true });

  console.log('\n' + '='.repeat(50));
  console.log('📋 SEED-ZUSAMMENFASSUNG');
  console.log('='.repeat(50));
  console.log(`Verein:    Squash Club Munich`);
  console.log(`Season:    Sommer 2026 (${SEASON_ID})`);
  console.log(`Gesamt Mitglieder: ${totalMembers}`);
  console.log(`  - davon aktive Mitgliedschaften: ${totalMembers}`);
  console.log(`  - davon Mitglieder (member role): ${memberUserIds.length}`);
  console.log(`  - davon Trainer (trainer role): ${trainerUserIds.length}`);
  console.log(`Preferences: ${totalPrefs}`);
  console.log(`Trainer (DB): ${allTrainers}`);
  console.log('='.repeat(50));
  console.log('\n✅ Seed abgeschlossen! Jetzt können die Wizard-APIs aufgerufen werden.');
  console.log('   Nächste Schritte:');
  console.log('   1. POST /api/seasons/{id}/planning/cluster  (Clustering)');
  console.log('   2. POST /api/seasons/{id}/planning/conflicts (Konflikte)');
  console.log('   3. POST /api/seasons/{id}/planning/confirm   (Veröffentlichen)\n');
}

seed().catch((err) => {
  console.error('❌ Seed fehlgeschlagen:', err);
  process.exit(1);
});
