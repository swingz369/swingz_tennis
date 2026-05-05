import 'dotenv/config';
import { Pool } from 'pg';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const dbUrl = process.env.DATABASE_URL!.split('?')[0];

async function ensureAdmin() {
  // Get or create admin user in Supabase Auth
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
  if (!getRes.ok)
    throw new Error(`Failed to fetch admin user: ${getRes.status} ${await getRes.text()}`);
  const data = await getRes.json();
  let userId: string;
  if (data.users && data.users.length > 0) {
    userId = data.users[0].id;
    console.log('✓ Found admin user in auth.users:', userId);
  } else {
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: adminEmail,
        password: 'admin123',
        email_confirm: true,
      }),
    });
    if (!createRes.ok)
      throw new Error(`Failed to create admin user: ${createRes.status} ${await createRes.text()}`);
    const createData = await createRes.json();
    userId = createData.user.id;
    console.log('✓ Created admin user in auth.users:', userId);
  }

  // Get first club ID
  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const clubsRes = await client.query('SELECT id FROM clubs ORDER BY id LIMIT 1');
    if (clubsRes.rows.length === 0) throw new Error('No clubs found');
    const clubId = clubsRes.rows[0].id;
    console.log('✓ Using club ID:', clubId);

    // Insert admin membership if not exists
    const existing = await client.query(
      'SELECT 1 FROM user_club_memberships WHERE user_id = $1 AND club_id = $2',
      [userId, clubId]
    );
    if (existing.rowCount === 0) {
      await client.query(
        `INSERT INTO user_club_memberships (user_id, club_id, role, is_active, joined_at)
         VALUES ($1, $2, 'admin', true, NOW())`,
        [userId, clubId]
      );
      console.log('✓ Added admin@swingz.com as admin to club');
    } else {
      console.log('✓ Admin already member of this club');
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
