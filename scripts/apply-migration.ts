/**
 * Apply a Drizzle migration SQL file using postgres-js (the same driver the app uses).
 * Usage: npx tsx scripts/apply-migration.ts <migration-file>
 *
 * drizzle-kit migrate uses the `pg` driver, which can't always connect to Supabase.
 * Since the app itself uses postgres-js, this script applies migrations through the
 * same driver for consistency.
 */
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env from .env.local (Next.js convention)
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: npx tsx scripts/apply-migration.ts <path-to-migration.sql>');
  process.exit(1);
}

if (!fs.existsSync(migrationFile)) {
  console.error(`Migration file not found: ${migrationFile}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(migrationFile, 'utf8');

// Split the migration into individual statements using drizzle-kit's --> statement-breakpoint separator
const statements = sqlContent
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

async function main() {
  console.log(`[migrate] Connecting to database...`);
  // `dbUrl` is checked at the top of the file (process.exit(1) if missing),
  // but TS can't narrow it across the function boundary — use non-null assertion.
  const sql = postgres(dbUrl!, {
    ssl: dbUrl!.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 1,
  });

  try {
    console.log(`[migrate] Applying ${statements.length} statements from ${migrationFile}...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await sql.unsafe(stmt);
        console.log(`  [${i + 1}/${statements.length}] OK`);
      } catch (err: any) {
        // Column-already-exists and similar errors are OK for re-runs
        if (
          err.message?.includes('already exists') ||
          err.message?.includes('duplicate column') ||
          err.code === '42701' || // duplicate_column
          err.code === '42P07' // duplicate_table
        ) {
          console.log(`  [${i + 1}/${statements.length}] SKIP (already exists)`);
        } else {
          console.error(`  [${i + 1}/${statements.length}] FAILED`);
          console.error(`  SQL: ${stmt.substring(0, 200)}...`);
          console.error(`  Error: ${err.message}`);
          throw err;
        }
      }
    }

    console.log(`[migrate] ✅ Migration applied successfully.`);
  } catch (err: any) {
    console.error(`[migrate] ❌ Migration failed: ${err.message}`);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
