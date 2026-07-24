import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createServiceClient } from '@/lib/supabase/service';

// Load .env.local specifically
dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL!.split('?')[0];

const supabaseAdmin = createServiceClient();

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  const client = await pool.connect();

  try {
    // 1. Ensure clubs exist (fetch existing)
    const clubsRes = await client.query('SELECT id, name FROM clubs ORDER BY id');
    const clubs = clubsRes.rows;
    if (clubs.length === 0) {
      console.log('No clubs found. Please create clubs first.');
      return;
    }
    console.log(`Found ${clubs.length} clubs`);

    // 2. For each club, ensure members, trainers, admin exist in auth.users and user_club_memberships
    for (const club of clubs) {
      const clubId = club.id;
      console.log(`Processing club: ${club.name} (${clubId})`);

      // Check how many memberships already exist
      const countRes = await client.query(
        'SELECT COUNT(*) FROM user_club_memberships WHERE club_id = $1',
        [clubId]
      );
      const existingCount = parseInt(countRes.rows[0].count);
      if (existingCount >= 24) {
        // 20 members + 3 trainers + 1 admin
        console.log(`  Club already has ${existingCount} memberships, skipping`);
        continue;
      }

      // Create 20 members
      for (let i = 1; i <= 20; i++) {
        const email = `member${i}@club${clubId.slice(0, 4)}.example.com`;
        const fullName = `Member ${i} (Club ${club.name.slice(0, 10)})`;
        try {
          // Check if user exists first
          // `email` is not in Supabase PageParams but is accepted at runtime.
          const {
            data: { users },
          } = await supabaseAdmin.auth.admin.listUsers({ email } as never);
          let userId: string;
          if (users && users.length > 0) {
            userId = users[0].id;
          } else {
            // Create new user
            const {
              data: { user },
            } = await supabaseAdmin.auth.admin.createUser({
              email,
              password: 'member123',
              email_confirm: true,
              user_metadata: { full_name: fullName },
            });
            if (!user) throw new Error('User creation returned null');
            userId = user.id;
          }
          // Insert membership
          await client.query(
            `INSERT INTO user_club_memberships (user_id, club_id, role, is_active, joined_at)
             VALUES ($1, $2, 'member', true, NOW())
             ON CONFLICT DO NOTHING`,
            [userId, clubId]
          );
        } catch (e: any) {
          console.error(`  Error creating member ${email}:`, e.message);
        }
      }

      // Create 3 trainers
      for (let i = 1; i <= 3; i++) {
        const email = `trainer${i}@club${clubId.slice(0, 4)}.example.com`;
        const fullName = `Trainer ${i} (Club ${club.name.slice(0, 10)})`;
        try {
          // Check if user exists first
          // `email` is not in Supabase PageParams but is accepted at runtime.
          const {
            data: { users },
          } = await supabaseAdmin.auth.admin.listUsers({ email } as never);
          let userId: string;
          if (users && users.length > 0) {
            userId = users[0].id;
          } else {
            // Create new user
            const {
              data: { user },
            } = await supabaseAdmin.auth.admin.createUser({
              email,
              password: 'trainer123',
              email_confirm: true,
              user_metadata: { full_name: fullName },
            });
            if (!user) throw new Error('User creation returned null');
            userId = user.id;
          }
          // Insert membership
          await client.query(
            `INSERT INTO user_club_memberships (user_id, club_id, role, is_active, joined_at)
             VALUES ($1, $2, 'trainer', true, NOW())
             ON CONFLICT DO NOTHING`,
            [userId, clubId]
          );
        } catch (e: any) {
          console.error(`  Error creating trainer ${email}:`, e.message);
        }
      }

      // Create admin for this club
      // Use admin@swingz.com for the first club, otherwise generic admin
      const isFirstClub = clubs.indexOf(club) === 0;
      const adminEmail = isFirstClub
        ? 'admin@swingz.com'
        : `admin${clubId.slice(0, 4)}@example.com`;
      const adminFullName = isFirstClub ? 'SwingZ Admin' : `Admin ${club.name.slice(0, 10)}`;
      try {
        // Check if user exists first
        const {
          data: { users },
        } = await supabaseAdmin.auth.admin.listUsers({ email: adminEmail } as never);
        let userId: string;
        if (users && users.length > 0) {
          userId = users[0].id;
        } else {
          // Create new user
          const {
            data: { user },
          } = await supabaseAdmin.auth.admin.createUser({
            email: adminEmail,
            password: 'admin123',
            email_confirm: true,
            user_metadata: { full_name: adminFullName },
          });
          if (!user) throw new Error('User creation returned null');
          userId = user.id;
        }
        // Insert membership
        await client.query(
          `INSERT INTO user_club_memberships (user_id, club_id, role, is_active, joined_at)
           VALUES ($1, $2, 'admin', true, NOW())
           ON CONFLICT DO NOTHING`,
          [userId, clubId]
        );
        console.log(`  Created admin ${adminEmail} for club ${club.name}`);
      } catch (e: any) {
        console.error(`  Error creating admin ${adminEmail}:`, e.message);
      }
    }

    // 4. Ensure superadmin exists and assign to all clubs
    const superadminEmail = 'superadmin@swingz.com';
    try {
      // Check if user exists first
      const {
        data: { users },
      } = await supabaseAdmin.auth.admin.listUsers({ email: superadminEmail } as never);
      let superadminId: string;
      if (users && users.length > 0) {
        superadminId = users[0].id;
      } else {
        // Create new user
        const {
          data: { user },
        } = await supabaseAdmin.auth.admin.createUser({
          email: superadminEmail,
          password: 'superadmin123',
          email_confirm: true,
          user_metadata: { full_name: 'Platform Superadmin' },
        });
        if (!user) throw new Error('User creation returned null');
        superadminId = user.id;
      }
      for (const club of clubs) {
        await client.query(
          `INSERT INTO user_club_memberships (user_id, club_id, role, is_active, joined_at)
           VALUES ($1, $2, 'superadmin', true, NOW())
           ON CONFLICT DO NOTHING`,
          [superadminId, club.id]
        );
      }
      console.log(`  Ensured superadmin ${superadminEmail} exists and assigned to all clubs`);
    } catch (e: any) {
      console.error(`  Error with superadmin:`, e.message);
    }

    console.log('✅ Database seeding completed successfully!');
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
