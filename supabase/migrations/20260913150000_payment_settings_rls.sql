-- payment_settings hat FORCE ROW LEVEL SECURITY seit der Baseline, aber nie
-- eine Policy bekommen — für die Rolle "authenticated" war die Tabelle damit
-- unerreichbar leer, nutzbar nur über den service_role-Client (BYPASSRLS).
-- Teil der Migration auf Option B (ADR-005, § 6 Phase 3): Admins verwalten
-- die Zahlungseinstellungen ihres eigenen Vereins, RLS erzwingt die Grenze.
--
-- Kein FOR-Zusatz → gilt für SELECT/INSERT/UPDATE/DELETE (wie
-- sepa_mandates_admin_manage); ohne eigene WITH CHECK-Klausel verwendet
-- Postgres die USING-Bedingung auch dafür.
CREATE POLICY "payment_settings_admin_manage" ON "public"."payment_settings"
  USING ("public"."is_club_admin"("club_id"));
