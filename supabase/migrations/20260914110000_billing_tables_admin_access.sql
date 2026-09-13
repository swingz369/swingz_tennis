-- Abrechnung (Trainer-Honorar): RLS auf die tatsächliche App-Berechtigung
-- ausweiten.
--
-- Fund bei der ADR-005-Migration (Domäne Abrechnung, Teil 1): die Routes
-- unter /api/billing/trainers behandeln Honorarabrechnung durchweg als
-- Admin-Werkzeug (verifyRole(auth, 'admin')) — bereits mit Kommentaren im
-- Code, die genau diesen Fund für POST und die Listen-GET dokumentieren
-- ("Stand vorher auf 'trainer'..."). RLS erlaubte SELECT/INSERT/UPDATE/
-- DELETE auf billing_periods/trainer_billings/billing_line_items bisher nur
-- is_superadmin_of(club_id) — ein 'admin' (genau 1 Verein, keine
-- Superadmin-Rolle) hätte unter RLS 0 Zeilen gesehen. Bislang ohne Wirkung,
-- weil BillingService bisher über den Service-Client lief und RLS komplett
-- umging (siehe 20260815180000_billing_tables_club_scoping.sql, Kommentar
-- "Defense-in-depth, erst wirksam sobald ... auf getUserDb umgestellt").
-- Erst mit der Umstellung auf getUserDb(auth) hätte das jeden Admin
-- ausgesperrt.
--
-- trainer_billings/billing_line_items SELECT behalten ihre bestehende
-- Trainer-Eigene-Zeile-Klausel (trainers.user_id = auth.uid()) unverändert —
-- die war bereits korrekt für /api/trainer/billing.

DROP POLICY IF EXISTS "billing_periods_select" ON "public"."billing_periods";
CREATE POLICY "billing_periods_select" ON "public"."billing_periods"
  FOR SELECT TO "authenticated"
  USING ("public"."is_club_admin"("club_id"));

DROP POLICY IF EXISTS "billing_periods_insert" ON "public"."billing_periods";
CREATE POLICY "billing_periods_insert" ON "public"."billing_periods"
  FOR INSERT TO "authenticated"
  WITH CHECK ("public"."is_club_admin"("club_id"));

DROP POLICY IF EXISTS "billing_periods_update" ON "public"."billing_periods";
CREATE POLICY "billing_periods_update" ON "public"."billing_periods"
  FOR UPDATE TO "authenticated"
  USING ("public"."is_club_admin"("club_id"));

DROP POLICY IF EXISTS "billing_periods_delete" ON "public"."billing_periods";
CREATE POLICY "billing_periods_delete" ON "public"."billing_periods"
  FOR DELETE TO "authenticated"
  USING ("public"."is_club_admin"("club_id"));

DROP POLICY IF EXISTS "trainer_billings_select" ON "public"."trainer_billings";
CREATE POLICY "trainer_billings_select" ON "public"."trainer_billings"
  FOR SELECT TO "authenticated"
  USING (
    "public"."is_club_admin"((
      SELECT bp.club_id FROM "public"."billing_periods" bp
      WHERE bp.id = trainer_billings.billing_period_id
    ))
    OR EXISTS (
      SELECT 1 FROM "public"."trainers" t
      WHERE t.id = trainer_billings.trainer_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "trainer_billings_insert" ON "public"."trainer_billings";
CREATE POLICY "trainer_billings_insert" ON "public"."trainer_billings"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    "public"."is_club_admin"((
      SELECT bp.club_id FROM "public"."billing_periods" bp
      WHERE bp.id = trainer_billings.billing_period_id
    ))
  );

DROP POLICY IF EXISTS "trainer_billings_update" ON "public"."trainer_billings";
CREATE POLICY "trainer_billings_update" ON "public"."trainer_billings"
  FOR UPDATE TO "authenticated"
  USING (
    "public"."is_club_admin"((
      SELECT bp.club_id FROM "public"."billing_periods" bp
      WHERE bp.id = trainer_billings.billing_period_id
    ))
  );

DROP POLICY IF EXISTS "trainer_billings_delete" ON "public"."trainer_billings";
CREATE POLICY "trainer_billings_delete" ON "public"."trainer_billings"
  FOR DELETE TO "authenticated"
  USING (
    "public"."is_club_admin"((
      SELECT bp.club_id FROM "public"."billing_periods" bp
      WHERE bp.id = trainer_billings.billing_period_id
    ))
  );

DROP POLICY IF EXISTS "billing_line_items_select" ON "public"."billing_line_items";
CREATE POLICY "billing_line_items_select" ON "public"."billing_line_items"
  FOR SELECT TO "authenticated"
  USING (
    "public"."is_club_admin"((
      SELECT bp.club_id
      FROM "public"."trainer_billings" tb
      JOIN "public"."billing_periods" bp ON bp.id = tb.billing_period_id
      WHERE tb.id = billing_line_items.trainer_billing_id
    ))
    OR EXISTS (
      SELECT 1
      FROM "public"."trainer_billings" tb
      JOIN "public"."trainers" t ON t.id = tb.trainer_id
      WHERE tb.id = billing_line_items.trainer_billing_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "billing_line_items_insert" ON "public"."billing_line_items";
CREATE POLICY "billing_line_items_insert" ON "public"."billing_line_items"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    "public"."is_club_admin"((
      SELECT bp.club_id
      FROM "public"."trainer_billings" tb
      JOIN "public"."billing_periods" bp ON bp.id = tb.billing_period_id
      WHERE tb.id = billing_line_items.trainer_billing_id
    ))
  );

DROP POLICY IF EXISTS "billing_line_items_update" ON "public"."billing_line_items";
CREATE POLICY "billing_line_items_update" ON "public"."billing_line_items"
  FOR UPDATE TO "authenticated"
  USING (
    "public"."is_club_admin"((
      SELECT bp.club_id
      FROM "public"."trainer_billings" tb
      JOIN "public"."billing_periods" bp ON bp.id = tb.billing_period_id
      WHERE tb.id = billing_line_items.trainer_billing_id
    ))
  );

DROP POLICY IF EXISTS "billing_line_items_delete" ON "public"."billing_line_items";
CREATE POLICY "billing_line_items_delete" ON "public"."billing_line_items"
  FOR DELETE TO "authenticated"
  USING (
    "public"."is_club_admin"((
      SELECT bp.club_id
      FROM "public"."trainer_billings" tb
      JOIN "public"."billing_periods" bp ON bp.id = tb.billing_period_id
      WHERE tb.id = billing_line_items.trainer_billing_id
    ))
  );
