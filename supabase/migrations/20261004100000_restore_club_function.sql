-- Gegenstück zu soft_delete_club: Verein wiederherstellen, Mitgliedschaften reaktivieren, atomar.
-- Vorher zwei Drizzle-Statements in einer Transaktion (Port 6543, RLS umgangen).
--
-- SECURITY DEFINER, weil RLS hier nicht tragen kann: soft_delete_club hat alle Mitgliedschaften
-- deaktiviert, also besteht auch der Superadmin des Vereins is_club_admin() nicht mehr.
-- Die Berechtigung prüft die Funktion deshalb selbst: Owner, oder Superadmin mit einer — auch
-- deaktivierten — Mitgliedschaft genau in diesem Verein.
CREATE OR REPLACE FUNCTION public.restore_club(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club clubs%ROWTYPE;
  v_count integer;
BEGIN
  IF NOT (
    is_owner()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships
       WHERE user_id = auth.uid() AND club_id = p_club_id AND role = 'superadmin'
    )
  ) THEN
    -- Kein Unterschied zu "gibt es nicht": fremde Vereins-IDs nicht bestätigen.
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_club FROM clubs WHERE id = p_club_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_club.deleted_at IS NULL THEN
    RETURN jsonb_build_object('status', 'not_deleted', 'current_status', v_club.status);
  END IF;

  UPDATE user_club_memberships SET is_active = true
   WHERE club_id = p_club_id AND is_active = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE clubs
     SET status = 'active', deleted_at = NULL, deleted_by = NULL,
         deletion_reason = NULL, updated_at = now()
   WHERE id = p_club_id;

  RETURN jsonb_build_object(
    'status', 'restored',
    'name', v_club.name,
    'previous_deleted_at', v_club.deleted_at,
    'reactivated', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_club(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_club(uuid) TO authenticated;
