-- Migration: Soft-Delete für Clubs
-- Phase 1 des Owner-Master-Panels: Vereine werden nicht mehr hart gelöscht,
-- sondern als 'deleted' markiert. Memberships werden in derselben Operation
-- auf is_active=false gesetzt. Audit-Trail über deleted_at/deleted_by.
--
-- Wer darf gelöschte Vereine SEHEN?
--   - is_owner(): sieht ALLE Vereine, auch gelöschte (Plattformbetreiber-Bedienpanel)
--   - is_superadmin() / admin / member: sehen nur status != 'deleted'
--
-- Wer darf gelöschte Vereine LÖSCHEN (Hard-Delete)?
--   - Nur superadmin (siehe DELETE-Route, die mit Header-Bestätigung den Hard-Delete
--     zulässt; Soft-Delete ist der Default).
--   - Owner kann über das Bedienpanel nur Soft-Delete auslösen — Hard-Delete
--     bleibt DB-Konvention-Behandlung vorbehalten.

-- 1. Spalten
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS deletion_reason text;

COMMENT ON COLUMN clubs.deleted_at IS
  'Soft-Delete: Zeitpunkt der Markierung. NULL = aktiv.';
COMMENT ON COLUMN clubs.deleted_by IS
  'Soft-Delete: User, der die Löschung ausgelöst hat (FK auf users.id). NULL = aktiv oder Hard-Delete.';
COMMENT ON COLUMN clubs.deletion_reason IS
  'Optionaler Freitext aus Löschdialog (z. B. "DSGVO-Anfrage", "Vereinsauflösung").';

-- 2. Index für Status-Filterung (existierende Routen filtern aktiv vs. gelöscht)
CREATE INDEX IF NOT EXISTS clubs_status_idx ON clubs (status);
-- Partieller Index: speziell für Owner-Cleanup-Queries (alle gelöschten Vereine)
-- Effizient fuer `WHERE status = 'deleted' AND deleted_at < X` (z. B. nach 90 Tagen Hard-Delete-Vorschlag).
CREATE INDEX IF NOT EXISTS clubs_deleted_at_idx ON clubs (deleted_at DESC) WHERE status = 'deleted';

-- 3. RLS — Ersatz-Policies (Option A)
--
-- Wir replacen die existierenden SELECT-Policies derart, dass NUR noch der
-- Owner gelöschte Vereine sieht. Superadmin/Admin/Member sehen ausschließlich
-- aktive Vereine. Postgres wertet Policies mit OR aus; eine zusätzliche
-- "exclude"-Policy würde nichts bringen, sobald eine andere Policy `true` liefert.
-- Deshalb: an den Stellen, wo Mitglieder auf eigene Vereine zugreifen dürfen,
-- wird `AND status != 'deleted'` eingefügt.

DROP POLICY IF EXISTS "clubs_owner_select" ON clubs;
CREATE POLICY "clubs_owner_select" ON clubs
  FOR SELECT
  USING (
    -- Plattformbetreiber sehen alles, auch soft-deletes (für Cleanup/Wiederherstellung).
    is_owner()
    -- Superadmin sieht alle aktiven Vereine — bewusst nicht gelöschte (Tennisschule-Chef
    -- arbeitet nur mit laufenden Vereinen; für Owner-Eskalation gibt es is_owner()).
    OR (is_superadmin() AND status != 'deleted')
    -- Jedes andere Mitglied sieht seinen Verein — aber nicht den gelöschten.
    OR (is_club_member(id) AND status != 'deleted')
    -- Direkte Membership ohne helper-Fallback (für Fälle, in denen is_club_member
    -- aus anderen Gründen false liefert, aber der User in der Verein-Membership steht).
    OR (
      EXISTS (
        SELECT 1 FROM user_club_memberships
        WHERE club_id = clubs.id
          AND user_id = auth.uid()
          AND is_active = true
      )
      AND status != 'deleted'
    )
  );

-- Die ursprüngliche Policy aus 20250428_rls_policies.sql ist durch
-- clubs_owner_select jetzt vollständig abgedeckt. Sie bleibt als historische
-- Referenz im DROP-Statement, falls jemand sie noch aktiv hat.
DROP POLICY IF EXISTS "club_member_access" ON clubs;

-- 4. UPDATE/INSERT bleiben unverändert (admin/superadmin), DELETE für Hard-Delete
--    ist an clubs_delete_superadmin gekoppelt. Für Soft-Delete nutzt die App-Route
--    den User-Client ohne DELETE-SQL, sondern ein UPDATE auf status.

DROP POLICY IF EXISTS "clubs_select_admin" ON public.clubs;
CREATE POLICY "clubs_select_admin" ON public.clubs
  FOR SELECT
  USING (
    get_user_role() IN ('admin', 'superadmin')
    AND status != 'deleted'
  );

-- 5. Dokumentation
COMMENT ON POLICY "clubs_owner_select" ON clubs IS
  'SELECT: Plattformbetreiber sieht ALLE Vereine (inkl. gelöschter). Superadmin/Admin/Member nur aktive.';
