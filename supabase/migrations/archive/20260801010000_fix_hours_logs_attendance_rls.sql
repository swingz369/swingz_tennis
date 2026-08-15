-- Migration: Fix hours_logs and attendance_records RLS policies
-- Bug: policies compared trainer_id (FK to trainers.id) directly to auth.uid(),
-- but trainers.id != auth.uid() (trainers.user_id is the auth link). Every
-- trainer got a 42501 trying to log their own hours. Same pattern already
-- fixed for trainer_availabilities in 20260727_fix_trainer_availabilities_rls.sql
-- and for trainer_member_notes in 20260724_fix_rls_missing_tables.sql.

DROP POLICY IF EXISTS "hours_logs_select" ON hours_logs;
DROP POLICY IF EXISTS "hours_logs_insert" ON hours_logs;
DROP POLICY IF EXISTS "hours_logs_update" ON hours_logs;
DROP POLICY IF EXISTS "hours_logs_delete" ON hours_logs;

CREATE POLICY "hours_logs_select" ON hours_logs
    FOR SELECT
    USING (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM trainers
            WHERE trainers.id = hours_logs.trainer_id
              AND trainers.user_id = auth.uid()
        )
    );

CREATE POLICY "hours_logs_insert" ON hours_logs
    FOR INSERT
    WITH CHECK (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM trainers
            WHERE trainers.id = hours_logs.trainer_id
              AND trainers.user_id = auth.uid()
        )
    );

CREATE POLICY "hours_logs_update" ON hours_logs
    FOR UPDATE
    USING (
        is_superadmin() OR
        (
            status = 'pending' AND
            EXISTS (
                SELECT 1 FROM trainers
                WHERE trainers.id = hours_logs.trainer_id
                  AND trainers.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "hours_logs_delete" ON hours_logs
    FOR DELETE
    USING (
        is_superadmin() OR
        (
            status = 'pending' AND
            EXISTS (
                SELECT 1 FROM trainers
                WHERE trainers.id = hours_logs.trainer_id
                  AND trainers.user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "attendance_records_select" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_insert" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_update" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_delete" ON attendance_records;

CREATE POLICY "attendance_records_select" ON attendance_records
    FOR SELECT
    USING (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM trainers
            WHERE trainers.id = attendance_records.trainer_id
              AND trainers.user_id = auth.uid()
        )
    );

CREATE POLICY "attendance_records_insert" ON attendance_records
    FOR INSERT
    WITH CHECK (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM trainers
            WHERE trainers.id = attendance_records.trainer_id
              AND trainers.user_id = auth.uid()
        )
    );

CREATE POLICY "attendance_records_update" ON attendance_records
    FOR UPDATE
    USING (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM trainers
            WHERE trainers.id = attendance_records.trainer_id
              AND trainers.user_id = auth.uid()
        )
    );

CREATE POLICY "attendance_records_delete" ON attendance_records
    FOR DELETE
    USING (
        is_superadmin() OR
        EXISTS (
            SELECT 1 FROM trainers
            WHERE trainers.id = attendance_records.trainer_id
              AND trainers.user_id = auth.uid()
        )
    );
