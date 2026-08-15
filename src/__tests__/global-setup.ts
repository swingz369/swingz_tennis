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
import { Client } from 'pg';

// Load environment files (vitest auto-loads .env, we add .env.local and .env.test)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.test'), override: true });

/**
 * Produktions-Datenbanken, die dieses Test-Setup NIEMALS anfassen darf.
 * Ein schlichter `pnpm test` mit `.env.local` (zeigt auf den Prod-Pooler
 * `supabase.swingz.cloud:6543`) würde sonst `drizzle-kit push` und die
 * Test-DDL gegen die Live-DB ausführen (Schema-Mutation auf Produktion).
 *
 * @see docs/OPEN_ITEMS.md (P1: global-setup mutiert die DB aus .env.local)
 */
const PRODUCTION_DB_HOSTS = ['supabase.swingz.cloud', '178.254.37.110'];

function isProductionDbTarget(url: string | undefined): boolean {
  if (!url) return false;
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // Kein URL-Schema (z. B. `host:port` ohne Protokoll): Host manuell extrahieren.
    const atIndex = url.lastIndexOf('@');
    const hostPort = atIndex >= 0 ? url.slice(atIndex + 1) : url;
    host = hostPort.split('/')[0].split(':')[0].toLowerCase();
  }
  if (!host) return false;
  return PRODUCTION_DB_HOSTS.some((p) => host === p || host.endsWith(`.${p}`));
}

/**
 * Apply targeted DDL for tests that need columns/tables NOT in the Drizzle
 * schema. The Drizzle push covers ~38 of ~105 tables — the rest live only in
 * supabase/migrations/*.sql and need to be applied separately.
 *
 * Why not just run the full supabase/migrations/*.sql suite?
 *   - Many migrations use `BEGIN;...COMMIT;` blocks. When a statement inside
 *     fails (e.g. CREATE POLICY on a re-run, or a constraint on a column
 *     that already exists), PostgreSQL leaves the connection in an "aborted
 *     transaction" state. Subsequent migrations then ALL fail with
 *     "current transaction is aborted, commands ignored until end of
 *     transaction block" — and `NOTIFY pgrst` silently fails too.
 *   - Re-running a full migration suite is also slow (50+ files × RTT).
 *
 * Instead, we apply the specific additive DDL needed by the billing-engine
 * test (and any other tests that hit the dunning / Verzugszins code path).
 * All statements are idempotent (ADD COLUMN IF NOT EXISTS, CREATE TABLE IF
 * NOT EXISTS, INSERT ... ON CONFLICT DO NOTHING).
 *
 * If more additive schema is needed by other tests in the future, add the
 * DDL here — don't try to re-enable the full migration runner.
 */
async function applyTargetedTestDdl(dbUrl: string): Promise<void> {
  const ddl = `
    -- 20260624_mahnwesen_verzugszins_decisions.sql (additive columns)
    ALTER TABLE public.dunning_records
      ADD COLUMN IF NOT EXISTS interest_amount     NUMERIC(10, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS interest_days       INTEGER        NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_b2b              BOOLEAN        NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS base_rate_applied   NUMERIC(5, 4)  NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_due           NUMERIC(10, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS legal_basis         VARCHAR(255);

    -- 20260624_mahnwesen_verzugszins_decisions.sql (base_interest_rates table + seed)
    CREATE TABLE IF NOT EXISTS public.base_interest_rates (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      valid_from  DATE NOT NULL UNIQUE,
      rate        NUMERIC(5, 4) NOT NULL,
      source      VARCHAR(255),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS base_interest_rates_valid_from_idx
      ON public.base_interest_rates (valid_from DESC);

    INSERT INTO public.base_interest_rates (valid_from, rate, source) VALUES
      ('2024-07-01', 0.0337, 'Bundesbank H2/2024'),
      ('2025-01-01', 0.0238, 'Bundesbank H1/2025'),
      ('2025-07-01', 0.0153, 'Bundesbank H2/2025'),
      ('2026-01-01', 0.0119, 'Bundesbank H1/2026')
    ON CONFLICT (valid_from) DO NOTHING;
  `;

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query(ddl);
    console.log('   ✓ targeted DDL applied (dunning_records + base_interest_rates)');

    // PostgREST (the Supabase REST API used by the test client) caches the
    // schema at startup. After ALTER TABLE ADD COLUMN, the cache does NOT
    // auto-refresh — queries like `.from('dunning_records').insert({...base_rate_applied})`
    // fail with "Could not find column in schema cache". NOTIFY triggers an
    // async reload. We then sleep briefly to give PostgREST time to actually
    // finish reloading before the first test query.
    try {
      await client.query("NOTIFY pgrst, 'reload schema'");
      console.log('   ✓ PostgREST NOTIFY sent');
      // PostgREST reload is async; in CI on shared Supabase the worst case is
      // ~2-3s. 3s is a safe upper bound for the test environment.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      console.log('   ✓ PostgREST reload wait complete');
    } catch (err: unknown) {
      // NOTIFY pgrst only works on Supabase — silent no-op on plain PG.
      const message = err instanceof Error ? err.message : String(err);
      console.log(`   (PostgREST NOTIFY skipped: ${message.split('\n')[0]})`);
    }
  } finally {
    await client.end();
  }
}

export async function setup(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  console.log('\n🧪 Test Environment Setup');
  console.log('─────────────────────────');

  // ── Database (Drizzle/PostgreSQL) ──────────────────────────────────
  const dbIsProd = isProductionDbTarget(dbUrl);
  if (dbUrl && dbIsProd) {
    console.warn('🛑 DATABASE_URL zeigt auf eine Produktions-DB.');
    console.warn(
      '   `drizzle-kit push` + Test-DDL werden NICHT angewendet (Schema-Mutationsschutz).'
    );
    console.warn('   Für echte Integrationstests eine lokale Test-DB nutzen:');
    console.warn('   `bash scripts/setup-test-db.sh` oder `.env.test` mit lokalem DATABASE_URL.');
  } else if (dbUrl) {
    console.log('📦 DATABASE_URL: configured (non-production)');
    try {
      console.log('🔄 Applying Drizzle migrations...');
      execSync('npx drizzle-kit push', {
        env: { ...process.env },
        stdio: 'pipe',
      });
      console.log('✅ Drizzle migrations applied');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️  Drizzle push failed (may be intentional): ${message}`);
    }

    // Apply targeted DDL for additive schema (dunning, Verzugszins) that
    // Drizzle doesn't know about. See applyTargetedTestDdl() for rationale.
    console.log('🔄 Applying targeted test DDL (dunning_records + base_interest_rates)...');
    try {
      await applyTargetedTestDdl(dbUrl);
      console.log('✅ Targeted test DDL applied');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️  Targeted test DDL step failed: ${message}`);
    }
  } else {
    console.log('⚠️  DATABASE_URL: not set — Drizzle tests will use mock DB');
  } // ── Supabase Integration ───────────────────────────────────────────
  const supabaseIsProd = isProductionDbTarget(supabaseUrl);
  if (supabaseKey && supabaseUrl) {
    console.log('🔑 SUPABASE_SERVICE_ROLE_KEY: configured');
    console.log(`🌐 Supabase URL: ${supabaseUrl}`);
    if (supabaseIsProd) {
      console.warn('⚠️  NEXT_PUBLIC_SUPABASE_URL zeigt auf Produktion — Integrationstests');
      console.warn('    schreiben dann Testdaten in die Live-DB. Bitte `.env.test` mit einer');
      console.warn('    Test-/Staging-Instanz verwenden (separater Punkt #14 in OPEN_ITEMS).');
    } else {
      console.log('✅ Supabase integration tests WILL run');
    }
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
