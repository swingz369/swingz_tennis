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
    // - max: 3 — Vercel Fluid Compute reuses one warm instance for concurrent
    //   requests, so max:1 serializes them behind a single connection; a few
    //   headroom connections avoid that without exhausting the Supavisor pool.
    // - prepare: false (required for Supabase PgBouncer / Supavisor poolers)
    // - ssl: per DATABASE_SSL steuerbar. Der self-hosted Supavisor auf
    //   supabase.swingz.cloud terminiert auf dem Pooler-Port (6543) KEIN
    //   TLS — `sslmode=require` wird dort abgewiesen, erzwungenes SSL
    //   endet in ERR_SSL_WRONG_VERSION_NUMBER bei jeder Query. Solange das
    //   so ist, bleibt der Default `false`, und der DB-Verkehr läuft
    //   unverschlüsselt übers Netz (inkl. Passwort im Startup-Paket).
    //   Sobald TLS am Pooler aktiv ist: DATABASE_SSL=require setzen — kein
    //   Deploy nötig, und der Rollback ist dieselbe Variable. Ein fest
    //   verdrahteter Umschalter hier würde Prod lahmlegen, falls Code und
    //   Server-Konfiguration in der falschen Reihenfolge live gehen.
    // - connect_timeout: 15s to handle cold starts
    // - connection.statement_timeout: 10s — a hung query fails instead of
    //   blocking every other request queued behind it on the same connection.
    const client = postgres(connectionString, {
      max: 3,
      idle_timeout: 30, // 30s — release idle connections to avoid stale socket errors
      connect_timeout: 15,
      max_lifetime: 60 * 5, // 5 minutes — shorter than typical PG server timeout, prevents stale connections on warm starts
      prepare: false,
      ssl: process.env.DATABASE_SSL === 'require' ? 'require' : false,
      connection: {
        statement_timeout: 10_000,
      },
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
