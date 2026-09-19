-- Vereins-Admins dürfen die Profile der Personen ihres Vereins lesen — auch wenn die Mitgliedschaft
-- inaktiv ist oder die Person nur über trainer_club verknüpft ist (Trainer ohne eigene Membership).
-- Bisher griff nur "Members can view club members" (shares_active_club_with: beide Seiten aktiv).
-- Folge: Die Saisonplanung (Repository mit RLS statt Service-Client) verlor Trainer ohne aktive
-- Mitgliedschaft und Mitglieder mit eingereichter Präferenz, aber inaktiver Mitgliedschaft
-- stillschweigend aus ihren Inner-Joins. Neue Policy statt Änderung der bestehenden (OR-verknüpft).

DROP POLICY IF EXISTS users_select_club_admin ON users;
CREATE POLICY users_select_club_admin ON users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships m
      WHERE m.user_id = users.id AND is_club_admin(m.club_id)
    )
    OR EXISTS (
      SELECT 1 FROM trainers t
      JOIN trainer_club tc ON tc.trainer_id = t.id
      WHERE t.user_id = users.id AND is_club_admin(tc.club_id)
    )
  );
