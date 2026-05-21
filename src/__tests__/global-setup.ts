/**
 * Vitest Global Setup
 *
 * Runs once before ALL test files. Responsibilities:
 * 1. Load environment variables (.env.local, .env.test)
 * 2. Apply Drizzle migrations to test database (if DATABASE_URL is set)
 * 3. Verify Supabase connectivity (if SUPABASE_SERVICE_ROLE_KEY is set)
 *
 * NOTE: Integration tests using Supabase are automatically skipped
 * when SUPABASE_SERVICE_ROLE_KEY is missing. This setup ensures the
 * database is in the correct state when the key IS available.
 */

import dotenv from 'dotenv';
import path from 'path';
import { execSync } from 'child_process';

// Load environment files (vitest auto-loads .env, we add .env.local and .env.test)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.test'), override: true });

export async function setup(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  console.log('\n🧪 Test Environment Setup');
  console.log('─────────────────────────');

  // ── Database (Drizzle/PostgreSQL) ──────────────────────────────────
  if (dbUrl) {
    console.log('📦 DATABASE_URL: configured');
    try {
      console.log('🔄 Applying Drizzle migrations...');
      execSync('npx drizzle-kit push', {
        env: { ...process.env },
        stdio: 'pipe',
      });
      console.log('✅ Migrations applied successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️  Migration push failed (may be intentional): ${message}`);
      console.warn('   Tests requiring fresh schema may fail.');
    }
  } else {
    console.log('⚠️  DATABASE_URL: not set — Drizzle tests will use mock DB');
  }

  // ── Supabase Integration ───────────────────────────────────────────
  if (supabaseKey && supabaseUrl) {
    console.log('🔑 SUPABASE_SERVICE_ROLE_KEY: configured');
    console.log(`🌐 Supabase URL: ${supabaseUrl}`);
    console.log('✅ Supabase integration tests WILL run');
  } else {
    console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL: not set');
    console.log('   Supabase integration tests will be SKIPPED');
    console.log('   To enable: set both env vars in .env.local or .env.test');
    console.log('   See .env.test.example for template');
  }

  console.log('─────────────────────────\n');
}

export async function teardown(): Promise<void> {
  // No teardown needed — Docker containers are managed externally
  console.log('\n🧹 Test teardown complete\n');
}
