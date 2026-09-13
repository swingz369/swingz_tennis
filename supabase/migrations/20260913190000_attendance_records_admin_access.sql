-- Gleiches Muster wie 20260913170000/180000: attendance_records_select/
-- insert/update/delete erlaubten Admin-Zugriff nur einem SUPERADMIN des
-- Vereins (is_superadmin_of, über sessions→schedules→club_id). Der App-Code
-- (app/api/attendance-records/*) gewährt aber schon heute jedem normalen
-- Club-ADMIN Zugriff (verifyRole(auth, 'admin')) — Anwesenheitspflege ist
-- eine alltägliche Admin-Aufgabe. Migration auf getUserDb(auth) hätte für
-- die Rolle "admin" sonst plötzlich leere Ergebnisse geliefert.
--
-- attendance_records_member_select/_member_update bleiben unverändert (decken
-- Trainer/Teilnehmer-Eigenzugriff ab, nicht betroffen).
DROP POLICY IF EXISTS "attendance_records_select" ON "public"."attendance_records";
CREATE POLICY "attendance_records_select" ON "public"."attendance_records" FOR SELECT USING (
  (EXISTS (SELECT 1 FROM "public"."trainers"
    WHERE ("trainers"."id" = "attendance_records"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))
  OR (EXISTS (SELECT 1 FROM "public"."sessions" "s" JOIN "public"."schedules" "sc" ON ("sc"."id" = "s"."schedule_id")
    WHERE ("s"."id" = "attendance_records"."session_id") AND "public"."is_club_admin"("sc"."club_id")))
);

DROP POLICY IF EXISTS "attendance_records_insert" ON "public"."attendance_records";
CREATE POLICY "attendance_records_insert" ON "public"."attendance_records" FOR INSERT WITH CHECK (
  (EXISTS (SELECT 1 FROM "public"."trainers"
    WHERE ("trainers"."id" = "attendance_records"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))
  OR (EXISTS (SELECT 1 FROM "public"."sessions" "s" JOIN "public"."schedules" "sc" ON ("sc"."id" = "s"."schedule_id")
    WHERE ("s"."id" = "attendance_records"."session_id") AND "public"."is_club_admin"("sc"."club_id")))
);

DROP POLICY IF EXISTS "attendance_records_update" ON "public"."attendance_records";
CREATE POLICY "attendance_records_update" ON "public"."attendance_records" FOR UPDATE USING (
  (EXISTS (SELECT 1 FROM "public"."trainers"
    WHERE ("trainers"."id" = "attendance_records"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))
  OR (EXISTS (SELECT 1 FROM "public"."sessions" "s" JOIN "public"."schedules" "sc" ON ("sc"."id" = "s"."schedule_id")
    WHERE ("s"."id" = "attendance_records"."session_id") AND "public"."is_club_admin"("sc"."club_id")))
);

DROP POLICY IF EXISTS "attendance_records_delete" ON "public"."attendance_records";
CREATE POLICY "attendance_records_delete" ON "public"."attendance_records" FOR DELETE USING (
  (EXISTS (SELECT 1 FROM "public"."trainers"
    WHERE ("trainers"."id" = "attendance_records"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))
  OR (EXISTS (SELECT 1 FROM "public"."sessions" "s" JOIN "public"."schedules" "sc" ON ("sc"."id" = "s"."schedule_id")
    WHERE ("s"."id" = "attendance_records"."session_id") AND "public"."is_club_admin"("sc"."club_id")))
);
