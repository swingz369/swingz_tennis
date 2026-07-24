-- Migration: Fix trainer_availabilities RLS policies
-- Bug: policies compared trainer_id (FK to trainers.id) directly to auth.uid(),
-- but trainers.id != auth.uid() (trainers.user_id is the auth link). Every
-- trainer got a 42501 on save. Same pattern already fixed for
-- trainer_member_notes in 20260724_fix_rls_missing_tables.sql.

DROP POLICY IF EXISTS "trainer_availabilities_select" ON trainer_availabilities;
DROP POLICY IF EXISTS "trainer_availabilities_insert" ON trainer_availabilities;
DROP POLICY IF EXISTS "trainer_availabilities_update" ON trainer_availabilities;
DROP POLICY IF EXISTS "trainer_availabilities_delete" ON trainer_availabilities;

CREATE POLICY "trainer_availabilities_select" ON trainer_availabilities
    FOR SELECT
    USING (
        is_superadmin() OR
        EXISTS (SELECT 1 FROM trainers WHERE trainers.user_id = auth.uid())
    );

CREATE POLICY "trainer_availabilities_insert" ON trainer_availabilities
    FOR INSERT
    WITH CHECK (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM trainers
            WHERE trainers.id = trainer_availabilities.trainer_id
              AND trainers.user_id = auth.uid()
        )
    );

CREATE POLICY "trainer_availabilities_update" ON trainer_availabilities
    FOR UPDATE
    USING (
        is_superadmin() OR
        (
            status != 'booked' AND
            EXISTS (
                SELECT 1 FROM trainers
                WHERE trainers.id = trainer_availabilities.trainer_id
                  AND trainers.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "trainer_availabilities_delete" ON trainer_availabilities
    FOR DELETE
    USING (
        is_superadmin() OR
        (
            status != 'booked' AND
            EXISTS (
                SELECT 1 FROM trainers
                WHERE trainers.id = trainer_availabilities.trainer_id
                  AND trainers.user_id = auth.uid()
            )
        )
    );
