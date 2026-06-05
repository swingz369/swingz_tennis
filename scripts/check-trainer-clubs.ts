import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL!.split('?')[0];
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  const c = await pool.connect();
  const clubId = 'e3d5e862-04e1-4214-a793-4ab2cbdeb785';

  // 1. trainer_clubs
  const tc = await c.query('SELECT count(*) as cnt FROM trainer_clubs WHERE club_id = $1', [
    clubId,
  ]);
  console.log('trainer_clubs for club:', tc.rows[0].cnt);

  const allTc = await c.query('SELECT count(*) as cnt FROM trainer_clubs');
  console.log('trainer_clubs total:', allTc.rows[0].cnt);

  // 2. trainer_clubs columns
  const cols = await c.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'trainer_clubs' ORDER BY ordinal_position"
  );
  console.log(
    '\ntrainer_clubs columns:',
    cols.rows.map((r: any) => `${r.column_name} (${r.data_type})`).join(', ')
  );

  // 3. Sample trainer_clubs data
  const sample = await c.query('SELECT * FROM trainer_clubs LIMIT 3');
  console.log('\nSample trainer_clubs:', JSON.stringify(sample.rows, null, 2));

  // 4. user_club_memberships trainers
  const ucm = await c.query(
    `SELECT ucm.user_id, u.full_name, ucm.role 
     FROM user_club_memberships ucm 
     JOIN users u ON u.id = ucm.user_id 
     WHERE ucm.club_id = $1 AND ucm.role = 'trainer' AND ucm.is_active = true`,
    [clubId]
  );
  console.log('\nTrainer memberships in user_club_memberships:', ucm.rows.length);
  for (const r of ucm.rows) {
    console.log('  ', (r.user_id as string).slice(0, 8), r.full_name);
  }

  // 5. trainers table — check if user_id column exists
  const tCols = await c.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'trainers' ORDER BY ordinal_position"
  );
  console.log(
    '\ntrainers table columns:',
    tCols.rows.map((r: any) => `${r.column_name} (${r.data_type})`).join(', ')
  );

  // 6. Check if trainers table has user_ids matching memberships
  const tWithUcm = await c.query(
    `SELECT t.id, t.user_id, t.name, ucm.role
     FROM trainers t
     LEFT JOIN user_club_memberships ucm ON ucm.user_id = t.user_id AND ucm.club_id = $1 AND ucm.role = 'trainer'
     WHERE ucm.user_id IS NOT NULL
     LIMIT 10`,
    [clubId]
  );
  console.log('\nTrainers matching memberships:', tWithUcm.rows.length);
  for (const r of tWithUcm.rows) {
    console.log(
      '  trainer_id:',
      (r.id as string).slice(0, 8),
      'user_id:',
      (r.user_id as string).slice(0, 8),
      'name:',
      r.name
    );
  }

  c.release();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
