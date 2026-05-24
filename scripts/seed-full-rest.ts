// scripts/seed-full-rest.ts
// Nutzt NUR die Supabase REST API (HTTPS) — kein direktes Postgres
// Cloudflare blockiert Port 5432, aber HTTPS auf 443 funktioniert
// Aufruf: npx tsx scripts/seed-full-rest.ts

import { createServiceClient } from '@/lib/supabase/service';
import crypto from 'crypto';

const supabase = createServiceClient();

function generatePassword(): string {
  return crypto.randomBytes(16).toString('base64url') + '!A1';
}

// Feste Passwörter für einfacheren Test-Zugriff
const FIXED_PASSWORDS: Record<string, string> = {
  'superadmin@swingz.local': 'SuperAdmin123!',
  'admin@swingz.local': 'TestAdmin123!',
  'trainer@swingz.local': 'Trainer123!',
  'member@swingz.local': 'Member123!',
};

interface AuthUser {
  id: string;
  email: string;
}

async function findOrCreateAuthUser(
  email: string,
  password: string,
  role: string
): Promise<AuthUser | null> {
  // Prüfen ob bereits vorhanden
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (!listError) {
    const existing = users?.users.find((u) => u.email === email);
    if (existing) {
      console.log(`  ✓ Auth-User existiert bereits: ${email}`);
      return { id: existing.id, email };
    }
  }

  // Neu erstellen
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  });

  if (error) {
    console.error(`  ✗ Fehler bei Auth-Erstellung ${email}:`, error.message);
    return null;
  }

  console.log(`  ✓ Auth-User erstellt: ${email}`);
  return { id: data.user.id, email };
}

async function seed() {
  console.log('\n🌱 SEED: Vollständige Testdatenbank\n');

  // =============================================
  // 1. AUTH-USERS (Supabase Auth)
  // =============================================
  console.log('\n📁 1. Auth-Users\n');

  const authUsers: Record<string, AuthUser> = {};

  const userDefs = [
    { email: 'superadmin@swingz.local', role: 'superadmin' },
    { email: 'admin@swingz.local', role: 'admin' },
    { email: 'trainer@swingz.local', role: 'trainer' },
    { email: 'member@swingz.local', role: 'member' },
  ];

  for (const def of userDefs) {
    const pw = FIXED_PASSWORDS[def.email] || generatePassword();
    const user = await findOrCreateAuthUser(def.email, pw, def.role);
    if (user) authUsers[def.role] = user;
  }

  if (Object.keys(authUsers).length === 0) {
    console.error('❌ Keine Auth-User erstellt. Abbruch.');
    return;
  }

  // =============================================
  // 2. USERS-TABLE (App-spezifisch)
  // =============================================
  console.log('\n📁 2. Users-Tabelle\n');

  const userProfiles = [
    { id: authUsers.superadmin!.id, email: 'superadmin@swingz.local', full_name: 'Super Admin' },
    { id: authUsers.admin!.id, email: 'admin@swingz.local', full_name: 'Test Admin' },
    { id: authUsers.trainer!.id, email: 'trainer@swingz.local', full_name: 'Test Trainer' },
    { id: authUsers.member!.id, email: 'member@swingz.local', full_name: 'Test Member' },
  ];

  for (const profile of userProfiles) {
    const { error } = await supabase.from('users').upsert(
      {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.error(`  ✗ Fehler bei User-Insert ${profile.email}:`, error.message);
    } else {
      console.log(`  ✓ User-Profil erstellt: ${profile.email}`);
    }
  }

  // =============================================
  // 3. CLUB
  // =============================================
  console.log('\n📁 3. Club\n');

  const openingHours = {
    monday: { open: '08:00', close: '22:00' },
    tuesday: { open: '08:00', close: '22:00' },
    wednesday: { open: '08:00', close: '22:00' },
    thursday: { open: '08:00', close: '22:00' },
    friday: { open: '08:00', close: '22:00' },
    saturday: { open: '09:00', close: '20:00' },
    sunday: { open: '09:00', close: '18:00' },
  };

  let clubId: string | null = null;

  // Prüfen ob Club bereits existiert
  const { data: existingClubs } = await supabase.from('clubs').select('id').limit(1);
  if (existingClubs && existingClubs.length > 0) {
    clubId = existingClubs[0].id;
    console.log(`  ✓ Club existiert bereits: ${clubId}`);
  } else {
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .insert({
        name: 'TC Grün-Weiß Berlin',
        slug: 'tc-gruen-weiss-berlin',
        timezone: 'Europe/Berlin',
        default_session_duration_minutes: 60,
        max_members: 500,
        opening_hours: openingHours,
        default_hourly_rate: '15.00',
        status: 'active',
      })
      .select('id')
      .single();

    if (clubError) {
      console.error('  ✗ Fehler bei Club-Erstellung:', clubError.message);
    } else {
      clubId = club.id;
      console.log(`  ✓ Club erstellt: TC Grün-Weiß Berlin (${clubId})`);
    }
  }

  if (!clubId) {
    console.error('❌ Kein Club vorhanden. Abbruch.');
    return;
  }

  // =============================================
  // 4. CLUB MEMBERSHIPS
  // =============================================
  console.log('\n📁 4. Club-Memberships\n');

  const memberships = [
    { user_id: authUsers.superadmin!.id, role: 'superadmin' },
    { user_id: authUsers.admin!.id, role: 'admin' },
    { user_id: authUsers.trainer!.id, role: 'trainer' },
    { user_id: authUsers.member!.id, role: 'member' },
  ];

  for (const m of memberships) {
    // In club_members
    const { error: err1 } = await supabase.from('club_members').upsert(
      {
        club_id: clubId,
        user_id: m.user_id,
        role: m.role,
        is_active: true,
      },
      { onConflict: undefined }
    );

    if (err1) {
      console.error(`  ✗ club_members ${m.role}:`, err1.message);
    } else {
      console.log(`  ✓ club_members: ${m.role}`);
    }

    // In user_club_memberships
    const { error: err2 } = await supabase.from('user_club_memberships').upsert(
      {
        user_id: m.user_id,
        club_id: clubId,
        role: m.role,
        is_active: true,
      },
      { onConflict: undefined }
    );

    if (err2) {
      console.error(`  ✗ user_club_memberships ${m.role}:`, err2.message);
    } else {
      // Nur loggen wenn nicht bereits erfolgreich
    }
  }

  // =============================================
  // 5. COURTS
  // =============================================
  console.log('\n📁 5. Courts\n');

  const { data: existingCourts } = await supabase.from('courts').select('id').limit(1);
  if (!existingCourts || existingCourts.length === 0) {
    const courts = [
      { club_id: clubId, name: 'Platz 1', surface: 'hard', has_indoor: true },
      { club_id: clubId, name: 'Platz 2', surface: 'hard', has_indoor: true },
      { club_id: clubId, name: 'Platz 3', surface: 'clay', has_indoor: false },
      { club_id: clubId, name: 'Platz 4', surface: 'clay', has_indoor: false },
    ];

    for (const court of courts) {
      const { error } = await supabase.from('courts').insert(court);
      if (error) {
        console.error(`  ✗ Court ${court.name}:`, error.message);
      } else {
        console.log(`  ✓ Court erstellt: ${court.name}`);
      }
    }
  } else {
    console.log(`  ✓ Courts existieren bereits (${existingCourts.length})`);
  }

  // =============================================
  // 6. TRAINER (trainers-Tabelle)
  // =============================================
  console.log('\n📁 6. Trainer\n');

  const { data: existingTrainers } = await supabase.from('trainers').select('id').limit(1);
  if (!existingTrainers || existingTrainers.length === 0) {
    const { data: trainer, error: trainerError } = await supabase
      .from('trainers')
      .insert({
        email: 'trainer@swingz.local',
        name: 'Test Trainer',
        specialties: ['Einzeltraining', 'Gruppentraining', 'Anfänger'],
        max_hours_per_week: 30,
        is_active: true,
      })
      .select('id')
      .single();

    if (trainerError) {
      console.error('  ✗ Trainer-Erstellung:', trainerError.message);
    } else {
      console.log(`  ✓ Trainer erstellt: Test Trainer (${trainer.id})`);

      // Trainer-Club-Zuordnung
      const { error: tcError } = await supabase.from('trainer_club').insert({
        trainer_id: trainer.id,
        club_id: clubId,
      });
      if (tcError) {
        console.error(`  ✗ Trainer-Club-Zuordnung:`, tcError.message);
      } else {
        console.log('  ✓ Trainer-Club-Zuordnung erstellt');
      }
    }
  } else {
    console.log(`  ✓ Trainer existieren bereits (${existingTrainers.length})`);
  }

  // =============================================
  // SUMMARY
  // =============================================
  console.log('\n' + '='.repeat(60));
  console.log('✅ SEED ABGESCHLOSSEN');
  console.log('='.repeat(60));
  console.log('\n📋 Test-Zugangsdaten:');
  console.log('   superadmin@swingz.local / SuperAdmin123!');
  console.log('   admin@swingz.local     / TestAdmin123!');
  console.log('   trainer@swingz.local   / Trainer123!');
  console.log('   member@swingz.local    / Member123!');
  console.log('\n⚠️  Speichere diese Passwörter sicher!');
  console.log('='.repeat(60));
}

seed().catch((e) => {
  console.error('❌ Seed fehlgeschlagen:', e);
  process.exit(1);
});
