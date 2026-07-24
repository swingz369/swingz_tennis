/**
 * Database Connection
 * Shared Drizzle ORM instance for repositories
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let instance: Database | null = null;

// Lazily creates the connection on first query instead of at module load —
// Next.js imports every route module during `next build` (collecting page
// data), which would otherwise crash the build whenever DATABASE_URL isn't
// present in the build environment.
function getDb(): Database {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Create postgres.js client
    // Vercel serverless-compatible configuration:
    // - max: 1 (single connection per invocation)
    // - prepare: false (required for Supabase PgBouncer / Supavisor poolers)
    // - ssl: false — self-hosted Supavisor (supabase.swingz.cloud) does not
    //   terminate TLS on the pooler port; forcing SSL here throws
    //   ERR_SSL_WRONG_VERSION_NUMBER on every query.
    // - connect_timeout: 15s to handle cold starts
    const client = postgres(connectionString, {
      max: 1,
      idle_timeout: 30, // 30s — release idle connections to avoid stale socket errors
      connect_timeout: 15,
      max_lifetime: 60 * 5, // 5 minutes — shorter than typical PG server timeout, prevents stale connections on warm starts
      prepare: false,
      ssl: false,
    });

    instance = drizzle(client, { schema });
  }
  return instance;
}

// Drop-in replacement for the eagerly-created instance — every call site
// keeps using `db.select()`/`db.transaction()` etc. unchanged.
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
