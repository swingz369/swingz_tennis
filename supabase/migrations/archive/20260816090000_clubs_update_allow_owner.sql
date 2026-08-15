-- Migration: Owner darf Vereine bearbeiten (RLS-Lücke)
--
-- Befund (15.08.2026, nuLiga-Import): Der Owner ruft eine Admin-Route auf,
-- `verifyRole(auth, 'admin')` lässt ihn durch (owner steht in der Hierarchie
-- über admin) — und das anschließende UPDATE auf `clubs` wird von RLS
-- stillschweigend auf 0 Zeilen gefiltert. Beide UPDATE-Policies prüfen
-- `is_club_admin(id)`, und die Funktion verlangt eine Mitgliedschaft mit Rolle
-- admin/superadmin. Der Owner hat per Definition **keine** Club-Mitgliedschaft
-- (CLAUDE.md → DO NOT: „Owner mit club_id versehen"), also ist die Prüfung für
-- ihn immer falsch.
--
-- Konkret sichtbar wurde das daran, dass `/api/admin/nuliga/discover` einen
-- Audit-Eintrag `nuliga_club_url_set` schrieb, `clubs.nuliga_club_url` aber
-- null blieb — und der folgende Import mit „keine nuLiga-Vereinsseite
-- hinterlegt" abbrach, ohne dass ein erneuter Versuch geholfen hätte.
--
-- INSERT war für den Owner bereits geöffnet (20260804010000), DELETE über
-- `clubs_delete`. Nur UPDATE fehlte.
--
-- Live-Zustand vor dieser Migration (AGENTS.md → Migrationen, Regel 1):
--   SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'clubs';
--   → clubs_modify_admin (UPDATE, is_club_admin(id))
--     clubs_update       (UPDATE, is_club_admin(id))   ← inhaltsgleiche Dublette
-- Zwei permissive Policies mit identischer Bedingung sind reine Altlast; RLS
-- verknüpft sie mit OR. Sie werden hier zu einer zusammengeführt.

BEGIN;

DROP POLICY IF EXISTS "clubs_modify_admin" ON clubs;
DROP POLICY IF EXISTS "clubs_update" ON clubs;

CREATE POLICY "clubs_update" ON clubs
  FOR UPDATE TO authenticated
  USING (is_club_admin(id) OR is_owner())
  WITH CHECK (is_club_admin(id) OR is_owner());

COMMIT;
