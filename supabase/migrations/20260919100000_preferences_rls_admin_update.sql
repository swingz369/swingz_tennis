-- Saison-Präferenzen (ADR-005): RLS trägt die Mandantentrennung, nicht mehr der Anwendungscode.
-- Live-Zustand am 19.09.2026 per pg_policies geprüft.
--
-- 1. Admins dürfen Präferenzen ihres Vereins ändern (die Route erlaubte das schon; ohne Policy
--    würde ein UPDATE unter RLS still 0 Zeilen treffen).
-- 2. Eigenes INSERT prüfte weder Vereinszugehörigkeit noch, dass club_id zur Saison passt —
--    ein Nutzer konnte eine Zeile mit fremder club_id anlegen.

DROP POLICY IF EXISTS "Admins can update preferences in club" ON user_training_preferences;
CREATE POLICY "Admins can update preferences in club" ON user_training_preferences
  FOR UPDATE
  USING (is_club_admin(club_id))
  WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "Users can insert own preferences while open" ON user_training_preferences;
CREATE POLICY "Users can insert own preferences while open" ON user_training_preferences
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND is_club_member(club_id)
    AND EXISTS (
      SELECT 1 FROM seasons s
      WHERE s.id = user_training_preferences.season_id
        AND s.club_id = user_training_preferences.club_id
        AND s.preferences_open = true
    )
  );
