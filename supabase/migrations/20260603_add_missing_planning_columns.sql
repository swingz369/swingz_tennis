-- Migration: Add columns referenced by Drizzle schema but missing from production Supabase
-- These columns exist in Drizzle migrations (drizzle/0005_green_ego.sql) but were never
-- deployed as Supabase migrations, causing 500 errors in production API routes.

-- 1. Add include_in_planning to user_club_memberships (referenced by season planning members route)
ALTER TABLE public.user_club_memberships
  ADD COLUMN IF NOT EXISTS include_in_planning boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_club_memberships.include_in_planning IS 'Ob das Mitglied in die Saisonplanung einbezogen werden soll';

-- 2. Add skill_level and experience_months to users (referenced by member detail + planning routes)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS skill_level varchar(20) DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS experience_months integer DEFAULT 0;

COMMENT ON COLUMN public.users.skill_level IS 'Selbst eingeschätztes Spielniveau (beginner, intermediate, advanced)';
COMMENT ON COLUMN public.users.experience_months IS 'Spielerfahrung in Monaten';
