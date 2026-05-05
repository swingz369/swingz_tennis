import 'dotenv/config';
import { Pool } from 'pg';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const dbUrl = process.env.DATABASE_URL!.split('?')[0];

async function ensureAdmin() {
  // 1. Get or create admin user in Supabase Auth
  const adminEmail = 'admin@swingz.com';
  const getRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(adminEmail)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );
  if (!getRes.ok) {
    throw new Error(`Failed to fetch admin user: ${getRes.status} ${await getRes.text()}`);
  }
  const data = await getRes.json();
  let userId: string;
  if (data.users && data.users.length > 0) {
    userId = data.users[0].id;
    console.log('✓ Found admin user in auth.users:', userId);
  } else {
    // Create admin user
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: adminEmail,
        password: 'admin123', // change after first login!
        email_confirm: true,
      }),
    });
    if (!createRes.ok) {
      throw new Error(`Failed to create admin user: ${createRes.status} ${await createRes.text()}`);
    }
    const createData = await createRes.json();
    userId = createData.user.id;
    console.log('✓ Created admin user in auth.users:', userId);
  }

  // 2. Get first club ID from clubs table
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    const clubsRes = await client.query('SELECT id FROM clubs ORDER BY id LIMIT 1');
    if (clubsRes.rows.length === 0) {
      throw new Error('No clubs found in database. Please seed clubs first.');
    }
    const clubId = clubsRes.rows[0].id;
    console.log('✓ Using club ID:', clubId);

    // 3. Insert admin membership in club_members (role = 'admin')
    const existing = await client.query(
      'SELECT 1 FROM club_members WHERE user_id = $1 AND club_id = $2',
      [userId, clubId]
    );
    if (existing.rowCount === 0) {
      await client.query(
        `INSERT INTO club_members (user_id, club_id, role, is_active, join_date)
         VALUES ($1, $2, 'admin', true, NOW())`,
        [userId, clubId]
      );
      console.log('✓ Added admin@swingz.com as admin to club');
    } else {
      console.log('✓ Admin already member of this club');
    }

    // 4. Also ensure at least one superadmin exists for the platform (using a fixed UUID for demo)
    const superadminId = '550e8400-e29b-41d4-a716-446655440000';
    const superExisting = await client.query(
      'SELECT 1 FROM club_members WHERE user_id = $1 AND club_id = $2',
      [superadminId, clubId]
    );
    if (superExisting.rowCount === 0) {
      await client.query(
        `INSERT INTO club_members (user_id, club_id, role, is_active, join_date)
         VALUES ($1, $2, 'superadmin', true, NOW())`,
        [superadminId, clubId]
      );
      console.log('✓ Added demo superadmin (fixed UUID) to club');
      console.log('  Note: This superadmin UUID does not have an auth.users entry.');
    } else {
      console.log('✓ Demo superadmin already exists');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

ensureAdmin().catch((e) => {
  console.error(e);
  process.exit(1);
});
