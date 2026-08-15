-- Beim Anwenden von 20260801020000 stellte sich heraus, dass auf der Live-DB eine
-- zweite, nie in Git getrackte Policy "user_prefs_own" (FOR ALL, ungated) existiert,
-- die dieselbe Tabelle parallel zur neuen gated Policy weiterhin komplett offen hielt.
-- RLS-Policies werden pro Befehl mit OR verknüpft — jede erlaubende Policy reicht,
-- damit war die preferences_open-Sperre wirkungslos. user_prefs_own wird hier entfernt;
-- SELECT bleibt über "Users can view own preferences" / "user_prefs_admin_view" erhalten.

DROP POLICY IF EXISTS "user_prefs_own" ON user_training_preferences;
