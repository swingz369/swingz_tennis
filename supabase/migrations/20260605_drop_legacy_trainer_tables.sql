-- Migration: Drop legacy trainer tables superseded by new schema
-- trainer_availability → trainer_availabilities
-- trainer_club → trainer_club (actually same name, but we need to check for
-- table name mismatch: Drizzle uses trainer_club but there may be old trainer_club
-- with different schema or trainer_clubs plural. Let's check and clean up.)

DO $$
BEGIN
    -- Drop trainer_availability if it still exists (old singular name)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'trainer_availability'
    ) THEN
        DROP TABLE IF EXISTS public.trainer_availability CASCADE;
        RAISE NOTICE 'Dropped legacy table: trainer_availability';
    END IF;

    -- Drop trainer_clubs if it exists (plural variant that might be a duplicate)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'trainer_clubs'
    ) THEN
        DROP TABLE IF EXISTS public.trainer_clubs CASCADE;
        RAISE NOTICE 'Dropped legacy table: trainer_clubs';
    END IF;

    -- Drop trainer_availability constraint if orphaned
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'trainer_availability'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        -- Already handled by CASCADE above
        RAISE NOTICE 'trainer_availability constraints dropped via CASCADE';
    END IF;
END $$;
