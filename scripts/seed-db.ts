import { Pool } from 'pg';
import { readFileSync } from 'fs';

// Remove sslmode from DATABASE_URL and handle SSL manually
let dbUrl = process.env.DATABASE_URL!;
if (dbUrl.includes('?')) {
  dbUrl = dbUrl.split('?')[0];
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false, // Accept self-signed certs for Supabase
  },
});

async function run() {
  const client = await pool.connect();
  try {
    // Add role column if not exists
    await client.query(`
      ALTER TABLE club_members 
      ADD COLUMN IF NOT EXISTS role varchar(50) NOT NULL DEFAULT 'member';
    `);
    console.log('✓ Added role column to club_members');

    // Create index on role
    await client.query(`
      CREATE INDEX IF NOT EXISTS club_members_role_idx ON club_members(role);
    `);
    console.log('✓ Created role index');

    // Now insert seed data (modified to use correct table names)
    const seedSql = readFileSync('./drizzle/seed_3_clubs_with_members.sql', 'utf8').replace(
      /user_club_memberships/g,
      'club_members'
    );

    await client.query(seedSql);
    console.log('✓ Seeded database with clubs, users, and memberships');

    // Also add admin@swingz.com user if not exists
    const adminUserResult = await client.query(
      "SELECT id FROM users WHERE email = 'admin@swingz.com'"
    );
    if (adminUserResult.rows.length === 0) {
      const adminId = 'admin-swingz-001';
      await client.query(
        `INSERT INTO users (id, email, full_name, first_name, last_name, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [adminId, 'admin@swingz.com', 'SwingZ Admin', 'Admin', 'SwingZ']
      );
      console.log('✓ Created admin@swingz.com user');

      // Assign admin to all clubs as superadmin
      const clubResult = await client.query('SELECT id FROM clubs');
      for (const club of clubResult.rows) {
        await client.query(
          `INSERT INTO club_members (user_id, club_id, role, is_active, membership_start)
           VALUES ($1, $2, $3, true, NOW())
           ON CONFLICT DO NOTHING`,
          [adminId, club.id, 'superadmin']
        );
      }
      console.log(`✓ Assigned admin to ${clubResult.rows.length} clubs as superadmin`);
    } else {
      console.log('✓ admin@swingz.com already exists');
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
