import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/infrastructure/persistence/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function checkTables() {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('Tables in database:');
    tables.rows.forEach((row: { table_name: string }) => {
      console.log(' -', row.table_name);
    });

    // Check for clubs data
    const clubs = await db.select().from(schema.clubs).limit(5);
    console.log('\nClubs:', clubs);

    // Check for club_members data
    const members = await db.select().from(schema.clubMemberships).limit(5);
    console.log('\nClub members:', members);

    // Check for courts data
    const courts = await db.select().from(schema.courts).limit(5);
    console.log('\nCourts:', courts);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
