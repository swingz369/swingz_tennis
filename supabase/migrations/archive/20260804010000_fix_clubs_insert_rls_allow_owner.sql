-- Fix: owner role could not create clubs — RLS policy clubs_insert only checked
-- is_superadmin(), which strictly excludes role='owner' (is_owner() is a
-- separate function). Every INSERT into clubs by an owner was rejected by RLS,
-- surfacing as a generic 500 "Failed to create club" (app/api/clubs/route.ts
-- swallows the underlying Postgres error).
--
-- app/api/clubs/route.ts already branches on auth.role === 'owner' to set the
-- new club's status to 'active' immediately (vs 'pending' for superadmin) —
-- owner-initiated club creation is an intended, documented flow (CLAUDE.md:
-- owner has "Vollzugriff" over all clubs), just never reflected in this policy.

BEGIN;

DROP POLICY IF EXISTS "clubs_insert" ON public.clubs;
CREATE POLICY "clubs_insert" ON public.clubs
  FOR INSERT
  WITH CHECK (is_superadmin() OR is_owner());

COMMIT;
