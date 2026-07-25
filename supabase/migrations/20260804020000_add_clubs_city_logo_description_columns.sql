-- Fix: every db.select().from(clubs) (Drizzle) throws
-- "column clubs.default_revenue_account does not exist" — surfaces as a 500
-- on GET/PATCH /api/clubs/[id] (Owner-Master-Drawer club editing), and on
-- ANY other Drizzle query touching the clubs table.
--
-- Root cause: schema.ts declares default_revenue_account (F1.1 DATEV: Per-Verein
-- Default-Erlöskonto), .notNull().default('4000'), but no migration ever created
-- it in the live DB. Drizzle's full-table select enumerates every schema-declared
-- column by name, so a single phantom column breaks all reads of this table.
-- Verified against the live DB: city/logo_url/description already exist (kept
-- here as IF NOT EXISTS purely for safety/idempotency, not the actual fix).

BEGIN;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS city VARCHAR(200),
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS default_revenue_account TEXT NOT NULL DEFAULT '4000';

COMMIT;
