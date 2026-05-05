/**
 * Setup test admin user memberships
 * Assigns admin@swingz.com and superadmin@swingz.com to all existing clubs
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { clubs, users, userClubMemberships } from '../src/infrastructure/persistence/schema';
import { eq, and } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function setupAdminMemberships() {
  console.log('🔍 Finding test admin users...');

  // Find admin users
  const adminUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@swingz.com'))
    .union(db.select().from(users).where(eq(users.email, 'superadmin@swingz.com')));

  if (adminUsers.length === 0) {
    console.log('❌ No admin users found. Please create them first.');
    process.exit(1);
  }

  console.log(`✅ Found ${adminUsers.length} admin user(s):`);
  adminUsers.forEach((u) => console.log(`  - ${u.email} (${u.id})`));

  // Find all clubs
  console.log('\n🔍 Finding clubs...');
  const allClubs = await db.select().from(clubs);

  if (allClubs.length === 0) {
    console.log('❌ No clubs found. Please create clubs first.');
    process.exit(1);
  }

  console.log(`✅ Found ${allClubs.length} club(s):`);
  allClubs.forEach((c) => console.log(`  - ${c.name} (${c.id})`));

  // Assign each admin user to all clubs
  console.log('\n🔧 Creating memberships...');

  for (const user of adminUsers) {
    const isSuperAdmin = user.email.includes('superadmin');
    const role = isSuperAdmin ? 'superadmin' : 'admin';

    for (const club of allClubs) {
      // Check if membership already exists
      const existing = await db
        .select()
        .from(userClubMemberships)
        .where(
          and(eq(userClubMemberships.user_id, user.id), eq(userClubMemberships.club_id, club.id))
        );

      if (existing.length > 0) {
        console.log(`  ⏭️  ${user.email} → ${club.name} (already exists)`);
        continue;
      }

      // Create membership
      await db.insert(userClubMemberships).values({
        user_id: user.id,
        club_id: club.id,
        role: role,
        is_active: true,
      });

      console.log(`  ✅ ${user.email} → ${club.name} (${role})`);
    }
  }

  console.log('\n✅ Admin memberships setup complete!');
}

setupAdminMemberships()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
