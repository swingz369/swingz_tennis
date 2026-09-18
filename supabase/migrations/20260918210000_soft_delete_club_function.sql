-- Verein soft-löschen: Status setzen und alle Mitgliedschaften deaktivieren, atomar.
-- Vorher zwei Drizzle-Statements in einer Transaktion (Port 6543, RLS umgangen);
-- jetzt eine SECURITY-INVOKER-Funktion — RLS des Aufrufers gilt weiter
-- (clubs_update: Vereins-Admin/Owner, memberships_manage_admin/owner_update).
-- Reihenfolge: erst der Verein, dann die Mitgliedschaften — die Admin-Prüfung
-- der Policies liest genau diese Mitgliedschaften.
CREATE OR REPLACE FUNCTION public.soft_delete_club(p_club_id uuid, p_reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE clubs
     SET status = 'deleted', deleted_at = now(), deleted_by = auth.uid(),
         deletion_reason = p_reason, updated_at = now()
   WHERE id = p_club_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verein nicht gefunden oder keine Berechtigung' USING ERRCODE = 'P0002';
  END IF;

  UPDATE user_club_memberships SET is_active = false WHERE club_id = p_club_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_club(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_club(uuid, text) TO authenticated;
