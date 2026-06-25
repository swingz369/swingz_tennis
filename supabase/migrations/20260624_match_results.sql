-- =============================================================================
-- Migration: match_results (Tennis Medenspiel-Einzel-/Doppel-Detail-Ergebnisse)
-- =============================================================================
-- Datum:       2026-06-24
-- Beschreibung: Pro match_day gibt es bis zu 8 Begegnungen:
--              6 Einzel (Position 1-6) + 2 Doppel (Position 7-8).
--              Speichert pro Begegnung Spieler-IDs, Satzstände (JSONB),
--              Gesamtsieger der Begegnung.
--
-- Vereinsrechtlich relevant: vollständige Protokollierung der Spielberichte
-- für Sportverbände (HTV, DTB) und Streitfälle.
-- =============================================================================

CREATE TYPE public.match_position_type AS ENUM (
  'singles',     -- Einzel (1 Spieler je Seite)
  'doubles'      -- Doppel (2 Spieler je Seite)
);

CREATE TYPE public.match_outcome AS ENUM (
  'home_won',    -- Heim-Mannschaft hat gewonnen
  'away_won',    -- Gast-Mannschaft hat gewonnen
  'not_played',  -- Nicht ausgetragen (z.B. Spieltag verschoben)
  'walkover'     -- Aufgabe/Kampflos (Gegner nicht angetreten)
);
-- Hinweis: pro Begegnung gibt es immer einen Sieger (Tennis = best-of-3 sets,
-- Tiebreak im 3. Satz). 'split'/'tie' ist auf Match-Ebene nicht möglich.
-- Auf Match-Day-Ebene (Summe 4-3, 4-4 etc.) ist ein Unentschieden möglich,
-- wird aber in match_days.final_score verwaltet, NICHT hier.

CREATE TABLE IF NOT EXISTS public.match_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_day_id      UUID NOT NULL REFERENCES public.match_days(id) ON DELETE CASCADE,
  club_id           UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  position_number   SMALLINT NOT NULL CHECK (position_number BETWEEN 1 AND 8),
  position_type     public.match_position_type NOT NULL,
  -- Spieler-IDs: 1 für singles, 2 für doubles (jeweils Heim + Gast)
  home_player_ids   UUID[] NOT NULL CHECK (
    (position_type = 'singles' AND array_length(home_player_ids, 1) = 1) OR
    (position_type = 'doubles'  AND array_length(home_player_ids, 1) = 2)
  ),
  away_player_ids   UUID[] NOT NULL CHECK (
    (position_type = 'singles' AND array_length(away_player_ids, 1) = 1) OR
    (position_type = 'doubles'  AND array_length(away_player_ids, 1) = 2)
  ),
  -- Ergebnis-Grob-Score: Sätze pro Seite
  home_sets_won     SMALLINT NOT NULL DEFAULT 0 CHECK (home_sets_won BETWEEN 0 AND 3),
  away_sets_won     SMALLINT NOT NULL DEFAULT 0 CHECK (away_sets_won BETWEEN 0 AND 3),
  -- Invariante: home_won ↔ home_sets_won > away_sets_won (analog away_won)
  -- werden via Trigger geprüft (siehe unten).
  -- Detaillierte Satzstände (für Verband-Spielbericht) — JSONB Array
  -- Schema: [{ home: 6, away: 4, tiebreak: null | { home: 7, away: 5 } }, ...]
  set_scores        JSONB,
  outcome           public.match_outcome NOT NULL DEFAULT 'not_played',
  notes             TEXT CHECK (char_length(notes) <= 2000),
  -- Audit-Felder
  recorded_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_day_id, position_number)
);

CREATE INDEX IF NOT EXISTS match_results_match_day_idx
  ON public.match_results (match_day_id);

CREATE INDEX IF NOT EXISTS match_results_club_idx
  ON public.match_results (club_id);

CREATE INDEX IF NOT EXISTS match_results_outcome_idx
  ON public.match_results (outcome);

-- GIN-Index für Spieler-Suche: finde alle Spiele eines Mitglieds
CREATE INDEX IF NOT EXISTS match_results_home_player_idx
  ON public.match_results USING GIN (home_player_ids);
CREATE INDEX IF NOT EXISTS match_results_away_player_idx
  ON public.match_results USING GIN (away_player_ids);

COMMENT ON TABLE public.match_results IS
  'Detaillierte Spielberichte pro Medenspiel-Spieltag (6 Einzel + 2 Doppel).';
COMMENT ON COLUMN public.match_results.set_scores IS
  'JSONB-Array der Satzstände: [{ home, away, tiebreak? }, ...] für Verband-Spielbericht.';
COMMENT ON COLUMN public.match_results.position_number IS
  '1-6 = Einzel, 7-8 = Doppel. tennisübliche Reihenfolge.';

-- Trigger: hält Invariante outcome ↔ Sätze konsistent
CREATE OR REPLACE FUNCTION public.match_results_validate_outcome()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.outcome = 'home_won' AND NEW.home_sets_won <= NEW.away_sets_won THEN
    RAISE EXCEPTION 'match_results: outcome=home_won verlangt home_sets_won > away_sets_won (aktuell % vs. %)',
      NEW.home_sets_won, NEW.away_sets_won;
  END IF;
  IF NEW.outcome = 'away_won' AND NEW.away_sets_won <= NEW.home_sets_won THEN
    RAISE EXCEPTION 'match_results: outcome=away_won verlangt away_sets_won > home_sets_won (aktuell % vs. %)',
      NEW.away_sets_won, NEW.home_sets_won;
  END IF;
  IF NEW.outcome IN ('home_won', 'away_won') AND NEW.home_sets_won + NEW.away_sets_won < 2 THEN
    RAISE EXCEPTION 'match_results: best-of-3 → mindestens 2 Sätze erforderlich';
  END IF;
  RETURN NEW;
END;
$$;

-- Auto-Update von updated_at ON UPDATE
CREATE OR REPLACE FUNCTION public.match_results_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_results_touch_updated_at ON public.match_results;
CREATE TRIGGER trg_match_results_touch_updated_at
  BEFORE UPDATE ON public.match_results
  FOR EACH ROW
  EXECUTE FUNCTION public.match_results_touch_updated_at();

DROP TRIGGER IF EXISTS trg_match_results_validate_outcome ON public.match_results;
CREATE TRIGGER trg_match_results_validate_outcome
  BEFORE INSERT OR UPDATE ON public.match_results
  FOR EACH ROW
  EXECUTE FUNCTION public.match_results_validate_outcome();

-- RLS
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

-- Lesen: alle Club-Mitglieder (für vereinsinterne Transparenz)
CREATE POLICY match_results_club_read ON public.match_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_club_memberships m
      WHERE m.user_id = auth.uid() AND m.club_id = match_results.club_id
        AND m.is_active = TRUE
    )
  );

-- Schreiben: Nur Admins, Owner, Superadmin und Trainer (Mannschaftsführer)
CREATE POLICY match_results_admin_manage ON public.match_results
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_club_memberships m
      WHERE m.user_id = auth.uid() AND m.club_id = match_results.club_id
        AND m.is_active = TRUE
        AND m.role IN ('owner', 'superadmin', 'admin', 'trainer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_club_memberships m
      WHERE m.user_id = auth.uid() AND m.club_id = match_results.club_id
        AND m.is_active = TRUE
        AND m.role IN ('owner', 'superadmin', 'admin', 'trainer')
    )
  );
