// scripts/seed-users.ts
// Aufruf: npx tsx scripts/seed-users.ts
// NIEMALS ins Repo committen – nur lokal/CI mit .env.local

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Nur Server-seitig!
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Passwörter werden ZUFÄLLIG generiert – nie hardcoded!
function generatePassword(): string {
  return crypto.randomBytes(16).toString('base64url') + '!A1';
}

const seedUsers = [
  { email: 'superadmin@swingz.local', role: 'superadmin' },
  { email: 'admin@swingz.local', role: 'admin' },
  { email: 'trainer@swingz.local', role: 'trainer' },
  { email: 'member@swingz.local', role: 'member' },
  { email: 'demo@swingz.local', role: 'demo' },
];

async function seedDatabase() {
  console.log('🌱 Seeding users...\n');

  for (const user of seedUsers) {
    const password = generatePassword();

    // User erstellen
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { role: user.role },
    });

    if (error) {
      console.error(`❌ Failed to create ${user.email}:`, error.message);
      continue;
    }

    // Profil in profiles-Tabelle anlegen (oder users, je nach Schema)
    // Anpassen an dein Schema!
    try {
      await supabase.from('users').upsert({
        id: data.user.id,
        email: user.email,
        full_name: user.role.charAt(0).toUpperCase() + user.role.slice(1),
        role: user.role,
        created_at: new Date().toISOString(),
      });
    } catch (e: any) {
      console.warn(`⚠️  Profile insert failed (maybe different schema): ${e.message}`);
    }

    // Passwort NUR in der Konsole ausgeben – niemals in Datei schreiben!
    console.log(`✅ ${user.role.padEnd(12)} | ${user.email.padEnd(30)} | PW: ${password}`);
  }

  console.log('\n⚠️  Speichere diese Passwörter in deinem Passwort-Manager!');
  console.log('⚠️  Sie werden NICHT gespeichert und können nicht wiederhergestellt werden.');
}

seedDatabase().catch(console.error);
