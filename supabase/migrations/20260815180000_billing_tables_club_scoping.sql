-- Migration: Abrechnungstabellen pro Verein scopen + trainer_id/auth.uid()-Bug fixen
--
-- Fachliche Entscheidung (2026-08-15, mit Owner abgestimmt): `billing_periods`
-- ist PRO VEREIN, nicht plattformweit. Deshalb bekommt die Tabelle eine `club_id`.
--
-- Zwei seit 20260506210000 offene Probleme (Ticket
-- docs/tickets/roadmap/TICKET-billing-tables-rls-scoping.md):
--   1. `is_superadmin()` war hier unscoped: jeder Superadmin sah/bearbeitete
--      Abrechnungsperioden und Trainer-Abrechnungen ALLER Vereine plattformweit.
--      Ersetzt durch `is_superadmin_of(club_id)` (Club-scoped, Muster aus
--      20260805000000_scope_superadmin_to_managed_clubs.sql).
--   2. `trainer_billings`/`billing_line_items` verglichen `trainer_id` direkt mit
--      `auth.uid()` — derselbe Bug wie bei `hours_logs`/`attendance_records`
--      (`trainers.id` != `auth.uid()`, der Link läuft über `trainers.user_id`).
--
-- Zugriffsmuster: Die App greift auf diese Tabellen ausschließlich über den
-- Service-Client zu (BYPASSRLS, siehe src/application/services/billing.service.ts).
-- Diese Policies sind Defense-in-depth und werden erst wirksam, sobald die App
-- auf eine Rolle ohne BYPASSRLS umgestellt wird (docs/DATABASE.md → FORCE RLS).
--
-- VOR dem Anwenden (AGENTS.md → Migrationen, Regel 1) die Policy-Namen aus
-- pg_policies bestätigen:
--   SELECT policyname FROM pg_policies WHERE tablename IN
--     ('billing_periods','trainer_billings','billing_line_items') ORDER BY tablename, policyname;
-- Erwartete Namen: billing_periods_{select,insert,update,delete},
-- trainer_billings_{select,insert,update,delete},
-- billing_line_items_{select,insert,update,delete} (aus 20260506210000).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. billing_periods: club_id ergänzen (nullable + Backfill + NOT NULL)
-- ---------------------------------------------------------------------------
ALTER TABLE billing_periods
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE CASCADE;

-- Backfill: vorhandene Perioden über ihre Trainer-Abrechnungen dem Verein der
-- Trainer zuordnen (trainer_billings → trainers → trainer_club).
UPDATE billing_periods bp
SET club_id = sub.club_id
FROM (
  SELECT DISTINCT ON (bp2.id)
         bp2.id AS period_id,
         tc.club_id
  FROM billing_periods bp2
  JOIN trainer_billings tb ON tb.billing_period_id = bp2.id
  JOIN trainers t ON t.id = tb.trainer_id
  JOIN trainer_club tc ON tc.trainer_id = t.id
  WHERE bp2.club_id IS NULL
  ORDER BY bp2.id, tc.club_id
) sub
WHERE bp.id = sub.period_id
  AND bp.club_id IS NULL;

-- NOT NULL erst NACH dem Backfill. Vor dem Anwenden verifizieren, dass keine
-- NULL-Zeilen verbleiben (verwaiste Perioden ohne Trainer-Abrechnung):
--   SELECT count(*) FROM billing_periods WHERE club_id IS NULL;
-- Erwartung nach dem DB-Reset (13.08.2026): 0. Falls > 0: Zeilen einem Verein
-- zuordnen oder löschen, dann erst anwenden.
ALTER TABLE billing_periods
  ALTER COLUMN club_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS billing_periods_club_idx ON billing_periods(club_id);

-- ---------------------------------------------------------------------------
-- 2. billing_periods Policies: is_superadmin() → is_superadmin_of(club_id)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "billing_periods_select" ON billing_periods;
CREATE POLICY "billing_periods_select" ON billing_periods
  FOR SELECT TO authenticated
  USING (is_superadmin_of(club_id));

DROP POLICY IF EXISTS "billing_periods_insert" ON billing_periods;
CREATE POLICY "billing_periods_insert" ON billing_periods
  FOR INSERT TO authenticated
  WITH CHECK (is_superadmin_of(club_id));

DROP POLICY IF EXISTS "billing_periods_update" ON billing_periods;
CREATE POLICY "billing_periods_update" ON billing_periods
  FOR UPDATE TO authenticated
  USING (is_superadmin_of(club_id));

DROP POLICY IF EXISTS "billing_periods_delete" ON billing_periods;
CREATE POLICY "billing_periods_delete" ON billing_periods
  FOR DELETE TO authenticated
  USING (is_superadmin_of(club_id));

-- ---------------------------------------------------------------------------
-- 3. trainer_billings Policies: club-scoped superadmin + trainers.user_id-Fix
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "trainer_billings_select" ON trainer_billings;
CREATE POLICY "trainer_billings_select" ON trainer_billings
  FOR SELECT TO authenticated
  USING (
    is_superadmin_of(
      (SELECT bp.club_id FROM billing_periods bp WHERE bp.id = trainer_billings.billing_period_id)
    )
    OR EXISTS (
      SELECT 1 FROM trainers t
      WHERE t.id = trainer_billings.trainer_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "trainer_billings_insert" ON trainer_billings;
CREATE POLICY "trainer_billings_insert" ON trainer_billings
  FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin_of(
      (SELECT bp.club_id FROM billing_periods bp WHERE bp.id = trainer_billings.billing_period_id)
    )
  );

DROP POLICY IF EXISTS "trainer_billings_update" ON trainer_billings;
CREATE POLICY "trainer_billings_update" ON trainer_billings
  FOR UPDATE TO authenticated
  USING (
    is_superadmin_of(
      (SELECT bp.club_id FROM billing_periods bp WHERE bp.id = trainer_billings.billing_period_id)
    )
  );

DROP POLICY IF EXISTS "trainer_billings_delete" ON trainer_billings;
CREATE POLICY "trainer_billings_delete" ON trainer_billings
  FOR DELETE TO authenticated
  USING (
    is_superadmin_of(
      (SELECT bp.club_id FROM billing_periods bp WHERE bp.id = trainer_billings.billing_period_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. billing_line_items Policies: via trainer_billings → billing_periods.club_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "billing_line_items_select" ON billing_line_items;
CREATE POLICY "billing_line_items_select" ON billing_line_items
  FOR SELECT TO authenticated
  USING (
    is_superadmin_of((
      SELECT bp.club_id
      FROM trainer_billings tb
      JOIN billing_periods bp ON bp.id = tb.billing_period_id
      WHERE tb.id = billing_line_items.trainer_billing_id
    ))
    OR EXISTS (
      SELECT 1
      FROM trainer_billings tb
      JOIN trainers t ON t.id = tb.trainer_id
      WHERE tb.id = billing_line_items.trainer_billing_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "billing_line_items_insert" ON billing_line_items;
CREATE POLICY "billing_line_items_insert" ON billing_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin_of((
      SELECT bp.club_id
      FROM trainer_billings tb
      JOIN billing_periods bp ON bp.id = tb.billing_period_id
      WHERE tb.id = billing_line_items.trainer_billing_id
    ))
  );

DROP POLICY IF EXISTS "billing_line_items_update" ON billing_line_items;
CREATE POLICY "billing_line_items_update" ON billing_line_items
  FOR UPDATE TO authenticated
  USING (
    is_superadmin_of((
      SELECT bp.club_id
      FROM trainer_billings tb
      JOIN billing_periods bp ON bp.id = tb.billing_period_id
      WHERE tb.id = billing_line_items.trainer_billing_id
    ))
  );

DROP POLICY IF EXISTS "billing_line_items_delete" ON billing_line_items;
CREATE POLICY "billing_line_items_delete" ON billing_line_items
  FOR DELETE TO authenticated
  USING (
    is_superadmin_of((
      SELECT bp.club_id
      FROM trainer_billings tb
      JOIN billing_periods bp ON bp.id = tb.billing_period_id
      WHERE tb.id = billing_line_items.trainer_billing_id
    ))
  );

COMMIT;
