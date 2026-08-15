-- Gespeicherte Stände des Wochenstundenplans einer Saison.
--
-- Grund: `season_plan_entries` wird bei jedem Lauf des Clusterings komplett
-- gelöscht und neu geschrieben (SeasonClusteringEngine.saveToDatabase). Ein Admin,
-- der den generierten Plan von Hand nachgezogen hat, verlor damit jede Korrektur,
-- sobald er noch einmal generieren ließ — ohne Weg zurück. Diese Tabelle hält
-- benannte Fassungen als Snapshot vor, aus denen wieder hergestellt werden kann.
--
-- `slots` ist bewusst JSONB und keine normalisierte Kindtabelle: ein Snapshot wird
-- als Ganzes geschrieben, als Ganzes gelesen und nie einzeln abgefragt.

CREATE TABLE IF NOT EXISTS season_plan_versions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id  uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  club_id    uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  label      varchar(100) NOT NULL,
  slots      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS season_plan_versions_season_idx
  ON season_plan_versions(season_id, created_at DESC);

ALTER TABLE season_plan_versions ENABLE ROW LEVEL SECURITY;

-- Planstände sind reine Admin-Werkzeuge — Trainer und Mitglieder sehen sie nicht.
DROP POLICY IF EXISTS "club_staff_manage_plan_versions" ON season_plan_versions;
CREATE POLICY "club_staff_manage_plan_versions" ON season_plan_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE club_id = season_plan_versions.club_id
        AND user_id = auth.uid()
        AND role IN ('admin','superadmin','owner')
        AND is_active = true
    )
  );
