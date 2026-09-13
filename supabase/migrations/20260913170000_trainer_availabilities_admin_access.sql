-- trainer_availabilities erlaubte bislang nur dem Trainer selbst und einem
-- SUPERADMIN des Vereins (is_superadmin_of) Zugriff. Der App-Code
-- (app/api/trainer-availability/route.ts) lässt aber schon heute jeden
-- normalen Club-ADMIN Verfügbarkeiten der Trainer seines eigenen Vereins
-- lesen, anlegen und löschen (geprüft per trainerProfileService +
-- Club-Zugehörigkeit) — über die BYPASSRLS-Drizzle-Verbindung lief das
-- bisher an der Policy vorbei. Migration auf getUserDb(auth) (ADR-005)
-- würde für die weitaus häufigere Rolle "admin" sonst plötzlich leere
-- Ergebnisse liefern, obwohl der App-Code den Zugriff längst gewährt.
--
-- Diese Migration erweitert die vier bestehenden Policies um
-- is_club_admin(tc.club_id) (admin ODER superadmin, wie überall sonst im
-- Schema für "Admin des eigenen Vereins") — sie macht RLS deckungsgleich
-- mit dem bereits gewährten App-Zugriff, weitet ihn nicht darüber hinaus.
DROP POLICY IF EXISTS "trainer_availabilities_select" ON "public"."trainer_availabilities";
CREATE POLICY "trainer_availabilities_select" ON "public"."trainer_availabilities" FOR SELECT USING (
  (EXISTS (SELECT 1 FROM "public"."trainers"
    WHERE ("trainers"."id" = "trainer_availabilities"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))
  OR (EXISTS (SELECT 1 FROM "public"."trainer_club" "tc"
    WHERE ("tc"."trainer_id" = "trainer_availabilities"."trainer_id") AND "public"."is_club_admin"("tc"."club_id")))
);

DROP POLICY IF EXISTS "trainer_availabilities_insert" ON "public"."trainer_availabilities";
CREATE POLICY "trainer_availabilities_insert" ON "public"."trainer_availabilities" FOR INSERT WITH CHECK (
  (EXISTS (SELECT 1 FROM "public"."trainers"
    WHERE ("trainers"."id" = "trainer_availabilities"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))
  OR (EXISTS (SELECT 1 FROM "public"."trainer_club" "tc"
    WHERE ("tc"."trainer_id" = "trainer_availabilities"."trainer_id") AND "public"."is_club_admin"("tc"."club_id")))
);

DROP POLICY IF EXISTS "trainer_availabilities_update" ON "public"."trainer_availabilities";
CREATE POLICY "trainer_availabilities_update" ON "public"."trainer_availabilities" FOR UPDATE USING (
  ((("status")::"text" <> 'booked'::"text") AND (EXISTS (SELECT 1 FROM "public"."trainers"
    WHERE ("trainers"."id" = "trainer_availabilities"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"()))))
  OR (EXISTS (SELECT 1 FROM "public"."trainer_club" "tc"
    WHERE ("tc"."trainer_id" = "trainer_availabilities"."trainer_id") AND "public"."is_club_admin"("tc"."club_id")))
);

DROP POLICY IF EXISTS "trainer_availabilities_delete" ON "public"."trainer_availabilities";
CREATE POLICY "trainer_availabilities_delete" ON "public"."trainer_availabilities" FOR DELETE USING (
  ((("status")::"text" <> 'booked'::"text") AND (EXISTS (SELECT 1 FROM "public"."trainers"
    WHERE ("trainers"."id" = "trainer_availabilities"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"()))))
  OR (EXISTS (SELECT 1 FROM "public"."trainer_club" "tc"
    WHERE ("tc"."trainer_id" = "trainer_availabilities"."trainer_id") AND "public"."is_club_admin"("tc"."club_id")))
);
