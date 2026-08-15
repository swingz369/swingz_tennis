-- Migration: Add UNIQUE constraint on user_club_memberships(user_id, club_id)
-- The Drizzle schema defines this as unique but production only has a plain index.
-- No duplicate rows exist in production (verified before running).

-- Drop the old plain index (the unique constraint creates its own index)
DROP INDEX IF EXISTS public.user_club_memberships_user_club_idx;

-- Add the unique constraint
DO $$
BEGIN
  ALTER TABLE public.user_club_memberships
    ADD CONSTRAINT user_club_memberships_user_club_unique UNIQUE (user_id, club_id);
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'Constraint user_club_memberships_user_club_unique already exists';
END $$;

COMMENT ON CONSTRAINT user_club_memberships_user_club_unique ON public.user_club_memberships
  IS 'Jedes Mitglied darf nur einmal pro Verein Mitglied sein';
