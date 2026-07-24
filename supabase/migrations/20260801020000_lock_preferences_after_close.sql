-- Bisher erlaubte die Policy "Users can manage own preferences" (FOR ALL)
-- Insert/Update/Delete jederzeit, unabhängig von seasons.preferences_open.
-- Damit konnten Trainer/Mitglieder ihre Wochenverfügbarkeit noch ändern, nachdem
-- die Saisonplanung bereits läuft oder veröffentlicht ist — ohne dass das jemand
-- bemerkt oder eine Neuplanung ausgelöst wird.
--
-- Insert/Update sind jetzt an seasons.preferences_open = true gebunden.
-- Die separate SELECT-Policy "Users can view own preferences" (aus
-- 20260506430000_season_planning_system.sql) bleibt unverändert bestehen.

DROP POLICY IF EXISTS "Users can manage own preferences" ON user_training_preferences;

CREATE POLICY "Users can insert own preferences while open" ON user_training_preferences
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM seasons
            WHERE seasons.id = user_training_preferences.season_id
              AND seasons.preferences_open = true
        )
    );

CREATE POLICY "Users can update own preferences while open" ON user_training_preferences
    FOR UPDATE USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM seasons
            WHERE seasons.id = user_training_preferences.season_id
              AND seasons.preferences_open = true
        )
    );

CREATE POLICY "Users can delete own preferences" ON user_training_preferences
    FOR DELETE USING (user_id = auth.uid());
