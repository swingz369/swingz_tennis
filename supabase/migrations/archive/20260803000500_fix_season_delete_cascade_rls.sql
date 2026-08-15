-- Saison löschen schlug mit 500 fehl: seasons.id cascadet per ON DELETE CASCADE
-- nach user_training_preferences und season_planning_history, aber beide Tabellen
-- hatten keine DELETE-Policy für Admins (nur "eigene Zeile" bzw. gar keine).
-- Der Cascade-Delete läuft im User-Kontext (RLS aktiv, kein Service-Client) und
-- wurde daher von Postgres mit "permission denied" abgelehnt, sobald eine Saison
-- bereits Präferenzen oder History-Einträge hatte (letzteres passiert immer, da
-- log_season_planning_action beim Erstellen automatisch einen Eintrag schreibt).

DROP POLICY IF EXISTS "Admins can delete preferences in club" ON user_training_preferences;
CREATE POLICY "Admins can delete preferences in club" ON user_training_preferences
    FOR DELETE USING (
        club_id IN (
            SELECT club_id FROM user_club_memberships
            WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin') AND is_active = true
        )
    );

DROP POLICY IF EXISTS "Admins can delete planning history" ON season_planning_history;
CREATE POLICY "Admins can delete planning history" ON season_planning_history
    FOR DELETE USING (
        club_id IN (
            SELECT club_id FROM user_club_memberships
            WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin') AND is_active = true
        )
    );
