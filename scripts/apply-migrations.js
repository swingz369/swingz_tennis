#!/usr/bin/env node

/**
 * Apply pending migrations to Supabase database
 * Usage: node scripts/apply-migrations.js
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyMigration(filename, sql) {
  console.log(`\n📝 Applying migration: ${filename}`);

  try {
    // Execute the migration SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql function doesn't exist, use direct query
      const { error: directError } = await supabase.from('_').select('*').limit(0);

      if (directError) {
        // Try using the REST API directly
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ query: sql }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
      } else {
        throw error;
      }
    }

    console.log(`✅ Successfully applied: ${filename}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to apply migration: ${filename}`);
    console.error(err.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting database migrations...\n');

  // Get migration file from command line or use latest
  const migrationFile = process.argv[2];
  const migrationsDir = join(__dirname, '../supabase/migrations');

  if (migrationFile) {
    // Apply specific migration
    const filepath = migrationFile.startsWith('/')
      ? migrationFile
      : join(migrationsDir, migrationFile);

    const sql = readFileSync(filepath, 'utf-8');
    const success = await applyMigration(migrationFile, sql);

    process.exit(success ? 0 : 1);
  } else {
    // Apply all migrations in order
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let successCount = 0;
    let failureCount = 0;

    for (const file of files) {
      const filepath = join(migrationsDir, file);
      const sql = readFileSync(filepath, 'utf-8');

      const success = await applyMigration(file, sql);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   📁 Total: ${files.length}`);

    process.exit(failureCount > 0 ? 1 : 0);
  }
}

main().catch((err) => {
  console.error('💥 Unexpected error:', err);
  process.exit(1);
});
