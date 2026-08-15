-- Fix missing FK: user_club_memberships.user_id had NO foreign key constraint at all
-- (only club_id and deactivated_by did). PostgREST's embed resolution for an
-- unqualified `users(...)` select therefore silently joined through the only
-- relationship it could find to `users` — deactivated_by — which is NULL for
-- every active membership. Every embedded `users` in app code
-- (quick-email, email-campaigns) came back null, breaking recipient lookups
-- with a false "not found" instead of an error.
--
-- Two pre-existing rows have a user_id with no matching users row (both already
-- is_active = false, stale test data from 2026-07-04) — removed so the FK can
-- be added without NOT VALID.

BEGIN;

DELETE FROM public.user_club_memberships ucm
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = ucm.user_id);

ALTER TABLE public.user_club_memberships
  ADD CONSTRAINT user_club_memberships_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

COMMIT;
