-- ═══════════════════════════════════════════════════════════════════════════
-- trainer_absences: user_id befüllen und die E-Mail-Join-Policies ablösen
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ausgangslage (live geprüft am 2026-08-12, siehe docs/DATABASE.md):
--   * trainer_absences.user_id war in ALLEN 24 Zeilen NULL.
--   * Deshalb griff bisher nur der ältere Trainer-Pfad, der pro Zeile
--     trainers→users über die E-Mail joint. Die neueren user_id-Policies
--     liefen ins Leere.
--   * Zusätzlich lag `trainers_can_manage_own_absences` als FOR ALL ohne
--     Status-Bedingung an — Trainer konnten damit auch bereits genehmigte
--     Abwesenheiten ändern oder löschen. Die abgelösten E-Mail-Policies
--     hatten dafür ein `status = 'pending'`.
--
-- Policy-Namen unten stammen aus einer pg_policies-Abfrage gegen die Live-DB,
-- nicht aus älteren Migrationsdateien (AGENTS.md, Migrations-Regel 1).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. user_id selbstpflegend machen ───────────────────────────────────────
-- Ohne das bleibt die Spalte bei jedem Insert leer, den ein Admin für einen
-- Trainer anlegt (der setzt trainer_id, nicht user_id) — der Trainer sähe
-- seine eigene Abwesenheit dann nicht mehr, sobald die E-Mail-Join-Policies
-- weg sind. BEFORE-Trigger laufen vor der RLS-WITH-CHECK-Prüfung, der
-- Trainer-INSERT unten funktioniert dadurch auch ohne explizites user_id.
CREATE OR REPLACE FUNCTION set_trainer_absence_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT t.user_id INTO NEW.user_id FROM trainers t WHERE t.id = NEW.trainer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trainer_absences_set_user_id ON trainer_absences;
CREATE TRIGGER trg_trainer_absences_set_user_id
  BEFORE INSERT OR UPDATE OF trainer_id ON trainer_absences
  FOR EACH ROW EXECUTE FUNCTION set_trainer_absence_user_id();

-- ── 2. Bestand nachziehen ──────────────────────────────────────────────────
-- Auflösbar sind nur die Zeilen, deren Trainer eine user_id hat. Die übrigen
-- hängen an Trainer-Datensätzen ohne Login (siehe Hinweis am Dateiende).
UPDATE trainer_absences a
SET user_id = t.user_id
FROM trainers t
WHERE t.id = a.trainer_id
  AND a.user_id IS NULL
  AND t.user_id IS NOT NULL;

-- ── 3. E-Mail-Join-Policies durch user_id-Policies ersetzen ────────────────
DROP POLICY IF EXISTS "Trainers can view their own absences" ON trainer_absences;
DROP POLICY IF EXISTS "Trainers can create their own absences" ON trainer_absences;
DROP POLICY IF EXISTS "Trainers can update their own pending absences" ON trainer_absences;
DROP POLICY IF EXISTS "Trainers can delete their own pending absences" ON trainer_absences;

-- Zu breit: FOR ALL ohne Status-Bedingung. SELECT deckt bereits
-- trainers_can_view_own_absences ab, Schreibrechte kommen einzeln darunter.
DROP POLICY IF EXISTS "trainers_can_manage_own_absences" ON trainer_absences;

DROP POLICY IF EXISTS "trainers_can_create_own_absences" ON trainer_absences;
CREATE POLICY "trainers_can_create_own_absences"
  ON trainer_absences FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_club_trainer(club_id));

DROP POLICY IF EXISTS "trainers_can_update_own_pending_absences" ON trainer_absences;
CREATE POLICY "trainers_can_update_own_pending_absences"
  ON trainer_absences FOR UPDATE
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "trainers_can_delete_own_pending_absences" ON trainer_absences;
CREATE POLICY "trainers_can_delete_own_pending_absences"
  ON trainer_absences FOR DELETE
  USING (user_id = auth.uid() AND status = 'pending');

-- ── Offen, bewusst nicht hier erledigt ─────────────────────────────────────
-- 20 der 24 Zeilen hängen an 10 Trainer-Datensätzen aus abgebrochenen
-- RLS-Integrationstests (`trainer-rls-<timestamp>@test.com`) plus dem
-- Sentinel `unassigned@placeholder.local`. Deren user_id ist nicht
-- auflösbar — es gibt keine passenden users-Zeilen. Das Aufräumen ist ein
-- DELETE auf Live-Daten und braucht eine ausdrückliche Freigabe.
