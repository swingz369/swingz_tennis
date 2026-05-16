import { Pool } from 'pg';

const dbUrl = (process.env.DATABASE_URL || '').split('?')[0];
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  const client = await pool.connect();
  try {
    // Ensure role column exists
    await client.query(`
      ALTER TABLE club_members 
      ADD COLUMN IF NOT EXISTS role varchar(50) NOT NULL DEFAULT 'member';
    `);
    console.log('✓ Added role column');

    // Get or create clubs
    let clubs = (await client.query('SELECT id FROM clubs')).rows.map((r) => r.id);
    if (clubs.length === 0) {
      const res = await client.query(
        `INSERT INTO clubs (id, name, max_members, status, opening_hours, default_hourly_rate, created_at, updated_at)
         VALUES
           (gen_random_uuid(), 'Tennis Club Berlin', 100, 'active',
            '{"monday":{"open":"09:00","close":"22:00"},"tuesday":{"open":"09:00","close":"22:00"},"wednesday":{"open":"09:00","close":"22:00"},"thursday":{"open":"09:00","close":"22:00"},"friday":{"open":"09:00","close":"22:00"},"saturday":{"open":"09:00","close":"22:00"},"sunday":{"open":"09:00","close":"22:00"}}',
            '15.00', NOW(), NOW()),
           (gen_random_uuid(), 'Squash Club Munich', 80, 'active',
            '{"monday":{"open":"09:00","close":"22:00"},"tuesday":{"open":"09:00","close":"22:00"},"wednesday":{"open":"09:00","close":"22:00"},"thursday":{"open":"09:00","close":"22:00"},"friday":{"open":"09:00","close":"22:00"},"saturday":{"open":"09:00","close":"22:00"},"sunday":{"open":"09:00","close":"22:00"}}',
            '15.00', NOW(), NOW()),
           (gen_random_uuid(), 'Badminton Club Hamburg', 60, 'active',
            '{"monday":{"open":"09:00","close":"22:00"},"tuesday":{"open":"09:00","close":"22:00"},"wednesday":{"open":"09:00","close":"22:00"},"thursday":{"open":"09:00","close":"22:00"},"friday":{"open":"09:00","close":"22:00"},"saturday":{"open":"09:00","close":"22:00"},"sunday":{"open":"09:00","close":"22:00"}}',
            '15.00', NOW(), NOW())
         RETURNING id`
      );
      clubs = res.rows.map((r) => r.id);
      console.log(`✓ Created ${clubs.length} clubs`);
    } else {
      console.log(`✓ Found ${clubs.length} existing clubs`);
    }

    // Seed club_members if empty
    const membersCount = parseInt(
      (await client.query('SELECT COUNT(*) FROM club_members')).rows[0].count
    );
    if (membersCount === 0) {
      const values: string[] = [];
      for (const clubId of clubs) {
        // members
        for (let i = 1; i <= 20; i++) {
          values.push(`(gen_random_uuid(), '${clubId}', 'member', true, NOW())`);
        }
        // trainers
        for (let i = 1; i <= 3; i++) {
          values.push(`(gen_random_uuid(), '${clubId}', 'trainer', true, NOW())`);
        }
        // admin per club
        values.push(`(gen_random_uuid(), '${clubId}', 'admin', true, NOW())`);
      }
      await client.query(
        `INSERT INTO club_members (user_id, club_id, role, is_active, join_date) VALUES ${values.join(',')} ON CONFLICT DO NOTHING`
      );
      console.log(`✓ Inserted ${values.length} club members`);

      // Superadmin (fixed UUID) - assign to all clubs
      const superadminId = '550e8400-e29b-41d4-a716-446655440000';
      for (const clubId of clubs) {
        await client.query(
          `INSERT INTO club_members (user_id, club_id, role, is_active, join_date)
           VALUES ($1, $2, 'superadmin', true, NOW()) ON CONFLICT DO NOTHING`,
          [superadminId, clubId]
        );
      }
      console.log('✓ Added superadmin to all clubs');
      console.log('  Superadmin UUID:', superadminId);
    } else {
      console.log('✓ Club members already seeded');
    }

    // Seed courts if empty
    const courtsCount = parseInt((await client.query('SELECT COUNT(*) FROM courts')).rows[0].count);
    if (courtsCount === 0) {
      for (const clubId of clubs) {
        for (let i = 1; i <= 2; i++) {
          await client.query(
            `INSERT INTO courts (id, club_id, name, surface, is_active, created_at)
             VALUES (gen_random_uuid(), $1, $2, 'hard', true, NOW()) ON CONFLICT DO NOTHING`,
            [clubId, `Court ${i}`]
          );
        }
      }
      console.log(`✓ Inserted ${clubs.length * 2} courts`);
    } else {
      console.log('✓ Courts already seeded');
    }
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((_e) => {
  process.exit(1);
});
