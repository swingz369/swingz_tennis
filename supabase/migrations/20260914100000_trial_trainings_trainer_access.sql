-- Trial-Trainings: RLS auf die tatsächliche App-Berechtigung ausweiten.
--
-- Fund bei der ADR-005-Migration (Domäne 3, Probetraining): POST/PATCH auf
-- /api/trial-trainings prüfen verifyRole(auth, 'trainer') — jeder Trainer
-- darf Probetrainings anlegen und (Trainer/Platz zuweisen, Status ändern)
-- bearbeiten. RLS erlaubte INSERT/UPDATE/SELECT bisher nur is_club_admin
-- bzw. einem Trainer, dem die Zeile bereits über trainer_id zugeordnet war
-- (nutzlos für neue oder noch unassignierte 'requested'-Anfragen aus dem
-- öffentlichen Formular). Bislang ohne Wirkung, weil diese Domäne über
-- Drizzle lief und RLS komplett umging — erst mit der Umstellung auf
-- getUserDb(auth) hätte das legitime Trainer-Workflows silently blockiert.
--
-- DELETE bleibt admin-only (App-Route prüft ebenfalls verifyRole(auth,
-- 'admin')) — keine Änderung nötig, war bereits konsistent.
DROP POLICY IF EXISTS "Club admins can create trial trainings in their clubs" ON "public"."trial_trainings";
CREATE POLICY "Club admins can create trial trainings in their clubs" ON "public"."trial_trainings"
  FOR INSERT WITH CHECK (
    "public"."is_club_admin"("club_id") OR "public"."is_club_trainer"("club_id")
  );

DROP POLICY IF EXISTS "Club admins can update trial trainings in their clubs" ON "public"."trial_trainings";
CREATE POLICY "Club admins can update trial trainings in their clubs" ON "public"."trial_trainings"
  FOR UPDATE USING (
    "public"."is_club_admin"("club_id") OR "public"."is_club_trainer"("club_id")
  );

DROP POLICY IF EXISTS "Club admins can view trial trainings in their clubs" ON "public"."trial_trainings";
CREATE POLICY "Club admins can view trial trainings in their clubs" ON "public"."trial_trainings"
  FOR SELECT USING (
    "public"."is_club_admin"("club_id") OR "public"."is_club_trainer"("club_id")
  );

-- Durch die drei Policies oben jetzt vollständig subsumiert (jeder Club-
-- Trainer sieht/bearbeitet bereits alle Probetrainings seines Vereins,
-- nicht nur zugewiesene) — als eigene Policies nur noch tote Redundanz.
DROP POLICY IF EXISTS "Trainers can view their assigned trial trainings" ON "public"."trial_trainings";
DROP POLICY IF EXISTS "Trainers can update their assigned trial trainings" ON "public"."trial_trainings";
