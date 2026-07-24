-- ==============================================================================
-- Migration: Re-correct the FK on season_plan_entries.group_id
-- ==============================================================================
--
-- BACKGROUND
--
--   drizzle/0010_exotic_fabian_cortez.sql accidentally re-pointed
--   `season_plan_entries.group_id` from `groups(id)` to `training_groups(id)`.
--   The SeasonClusteringEngine writes into the modern `groups` table, so any
--   INSERT into `season_plan_entries` triggers FK code 23503.
--
--   The Drizzle FK reference in `src/infrastructure/persistence/schema.ts`
--   was reverted in the same commit; this migration is the runtime counterpart
--   on the live DB.
--
-- SEMANTIC INTENT
--
--   The clustering engine reads back via `db.select().from(groups)` and never
--   touches `training_groups` (legacy schedule-template rows with a NOT NULL
--   `schedule_id`). The FK must point at groups(id), not training_groups(id).
--
-- SAFETY
--
--   - Idempotent: each leg is guarded with a structural existence check.
--   - No data backfill needed (training_groups is empty in our seed envs).
--   - Replay-safe: every regclass lookup uses `to_regclass(...)` (NULL-safe),
--     so even if the target table is later dropped, re-applying this migration
--     no-ops cleanly instead of throwing.
-- ==============================================================================

DO $$
DECLARE
  fk_record RECORD;
BEGIN
  -- Drop any single-column FK on season_plan_entries.group_id that:
  --   (a) points at training_groups (buggy target), OR
  --   (b) points at groups but carries the wrong name
  --       (e.g. prod auto-generated season_plan_entries_group_id_fkey).
  -- Structural detection via pg_constraint + pg_attribute — robust against
  -- any autogen'd or hand-renamed constraint name. array_length guard
  -- ensures we never touch a compound FK.
  FOR fk_record IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = c.conkey[1] AND a.attrelid = c.conrelid
    WHERE c.conrelid = to_regclass('public.season_plan_entries')  -- V3: NULL-safe, matches the rest
      AND c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND a.attname = 'group_id'
      AND (
        -- `to_regclass('public.training_groups')` returns NULL (not throw) when
        -- the table doesn't exist, and the comparison `c.confrelid = to_regclass(...)`
        -- is oid-vs-oid, which is NULL-safe. This avoids the eager-cast trap where
        -- `'public.training_groups'::regclass` would actually throw on a missing
        -- table even when wrapped behind an IS-NOT-NULL guard.
        c.confrelid = to_regclass('public.training_groups')
        OR
        (c.confrelid = to_regclass('public.groups')
         AND c.conname <> 'season_plan_entries_group_id_groups_id_fk')
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.season_plan_entries DROP CONSTRAINT %I;',
      fk_record.conname
    );
  END LOOP;
END $$;

DO $$
BEGIN
  -- Symmetric IS-NOT-NULL guards: if any of the two referenced relations were
  -- ever dropped, re-apply is a clean no-op. (`REFERENCES public.groups(id)`
  -- inside the ALTER would still fail loudly without this guard, but
  -- short-circuiting here matches the rest of the migration.)
  IF to_regclass('public.season_plan_entries') IS NOT NULL
     AND to_regclass('public.groups') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'season_plan_entries_group_id_groups_id_fk'
         AND conrelid = to_regclass('public.season_plan_entries')
     )
  THEN
    ALTER TABLE public.season_plan_entries
      ADD CONSTRAINT season_plan_entries_group_id_groups_id_fk
      FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;
  END IF;
END $$;
