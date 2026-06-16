/**
 * Re-export Database types from the canonical source.
 * All Supabase types live in types/supabase.ts.
 * This file exists for backward compatibility only.
 */
export type { Database, Json } from './types/supabase';
