-- Gleiches Muster wie 20260913170000_trainer_availabilities_admin_access.sql:
-- hours_logs_select/insert/update/delete erlaubten nur dem Trainer selbst und
-- einem SUPERADMIN des Vereins (is_superadmin_of) Zugriff. Der App-Code
-- (app/api/hours-logs/*) gewährt aber schon heute jedem normalen Club-ADMIN
-- Zugriff (verifyRole(auth, 'admin'), separat von 'superadmin' geprüft) —
-- Stundenerfassung/Genehmigung ist eine alltägliche Admin-Aufgabe, keine nur
-- Superadmins vorbehaltene. Migration auf getUserDb(auth) (ADR-005) hätte für
-- die weitaus häufigere Rolle "admin" sonst plötzlich leere Ergebnisse
-- geliefert bzw. Freigaben/Ablehnungen wären an der Policy gescheitert.
DROP POLICY IF EXISTS "hours_logs_select" ON "public"."hours_logs";
CREATE POLICY "hours_logs_select" ON "public"."hours_logs" FOR SELECT USING (
  (EXISTS (SELECT 1 FROM "public"."trainers"
    WHERE ("trainers"."id" = "hours_logs"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))
  OR (EXISTS (SELECT 1 FROM "public"."trainer_club" "tc"
    WHERE ("tc"."trainer_id" = "hours_logs"."trainer_id") AND "public"."is_club_admin"("tc"."club_id")))
);

DROP POLICY IF EXISTS "hours_logs_insert" ON "public"."hours_logs";
CREATE POLICY "hours_logs_insert" ON "public"."hours_logs" FOR INSERT WITH CHECK (
  (EXISTS (SELECT 1 FROM "public"."trainers"
    WHERE ("trainers"."id" = "hours_logs"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))
  OR (EXISTS (SELECT 1 FROM "public"."trainer_club" "tc"
    WHERE ("tc"."trainer_id" = "hours_logs"."trainer_id") AND "public"."is_club_admin"("tc"."club_id")))
);

DROP POLICY IF EXISTS "hours_logs_update" ON "public"."hours_logs";
CREATE POLICY "hours_logs_update" ON "public"."hours_logs" FOR UPDATE USING (
  ((("status")::"text" = 'pending'::"text") AND (EXISTS (SELECT 1 FROM "public"."trainers"
    WHERE ("trainers"."id" = "hours_logs"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"()))))
  OR (EXISTS (SELECT 1 FROM "public"."trainer_club" "tc"
    WHERE ("tc"."trainer_id" = "hours_logs"."trainer_id") AND "public"."is_club_admin"("tc"."club_id")))
);

DROP POLICY IF EXISTS "hours_logs_delete" ON "public"."hours_logs";
CREATE POLICY "hours_logs_delete" ON "public"."hours_logs" FOR DELETE USING (
  ((("status")::"text" = 'pending'::"text") AND (EXISTS (SELECT 1 FROM "public"."trainers"
    WHERE ("trainers"."id" = "hours_logs"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"()))))
  OR (EXISTS (SELECT 1 FROM "public"."trainer_club" "tc"
    WHERE ("tc"."trainer_id" = "hours_logs"."trainer_id") AND "public"."is_club_admin"("tc"."club_id")))
);
