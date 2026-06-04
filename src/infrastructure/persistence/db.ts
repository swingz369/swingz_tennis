/**
 * Database Connection
 * Shared Drizzle ORM instance for repositories
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Create PostgreSQL connection
const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create postgres.js client
// Vercel serverless-compatible configuration:
// - max: 1 (single connection per invocation)
// - prepare: false (required for Supabase PgBouncer / Supavisor poolers)
// - ssl: required for Supabase cloud connections
// - connect_timeout: 30s to handle cold starts
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
const client = postgres(connectionString, {
  max: 1,
  idle_timeout: 30, // 30s — release idle connections to avoid stale socket errors
  connect_timeout: 15,
  max_lifetime: 60 * 5, // 5 minutes — shorter than typical PG server timeout, prevents stale connections on warm starts
  prepare: false,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

// Export types
export type Database = typeof db;
