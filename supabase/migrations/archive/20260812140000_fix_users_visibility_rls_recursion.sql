-- Vereinsmitglieder wieder füreinander sichtbar machen
--
-- Die Policy `Members can view club members` auf `users` prüft per Unterabfrage,
-- ob der gelesene Nutzer eine Mitgliedschaft in einem Verein des Aufrufers hat.
-- Diese Unterabfrage läuft selbst unter RLS — und auf `user_club_memberships`
-- erlauben alle Policies nur die EIGENE Zeile (oder Club-Admins):
--
--   memberships_select :: (user_id = auth.uid()) OR is_club_admin(club_id)
--
-- Damit sieht ein Trainer oder ein Mitglied dort ausschließlich sich selbst, die
-- Unterabfrage liefert genau eine Zeile, und die Policy auf `users` kann nie
-- jemand anderen freigeben. Die Folge im Betrieb: Die Teilnehmerliste einer
-- Trainingsgruppe zeigte für jeden Teilnehmer nur "Mitglied" — der Trainer
-- konnte nicht erkennen, wer vor ihm steht, und die Anwesenheitserfassung
-- ebensowenig.
--
-- Behoben über eine SECURITY-DEFINER-Funktion, die die Mitgliedschaftsprüfung
-- an RLS vorbei ausführt (Standardmuster gegen genau diese Rekursion). Die
-- Sichtbarkeit bleibt exakt die im Policy-Namen dokumentierte Absicht: nur
-- Nutzer, mit denen man einen aktiven Verein teilt.
--
-- Live-Zustand vor dieser Migration per pg_policies geprüft (AGENTS.md).

CREATE OR REPLACE FUNCTION public.shares_active_club_with(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_club_memberships own
    JOIN user_club_memberships other ON other.club_id = own.club_id
    WHERE own.user_id = auth.uid()
      AND own.is_active = true
      AND other.user_id = target_user_id
      AND other.is_active = true
  );
$$;

COMMENT ON FUNCTION public.shares_active_club_with(uuid) IS
  'Teilt der aufrufende Nutzer einen aktiven Verein mit target_user_id? SECURITY DEFINER, weil die Prüfung sonst an der RLS von user_club_memberships scheitert.';

DROP POLICY IF EXISTS "Members can view club members" ON users;

CREATE POLICY "Members can view club members" ON users
  FOR SELECT
  USING (id = auth.uid() OR public.shares_active_club_with(id));
