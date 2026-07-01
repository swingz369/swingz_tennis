-- =============================================================================
-- Migration: ELO DB-Trigger (Sprint 4 Q2 — Ticket 2.2.1)
-- =============================================================================
-- Datum:       2026-06-30
-- Beschreibung: Erstellt die `players`-Tabelle (ELO-Rating pro Spieler) und
--              einen AFTER INSERT-Trigger auf `match_results`, der das ELO
--              aller beteiligten Spieler gemäß Standard-Formel aktualisiert
--              (K-Faktor 32, siehe Ticket-Spec).
--
-- Wichtig: Diese SQL-Implementierung MUSS synchron mit
--          lib/services/elo.service.ts (TS pure function) sein.
--          Abweichungen werden durch Ticket 2.2.4 (Backing-Tests) abgedeckt.
--
-- ELO-Formel (Standard):
--   E_A = 1 / (1 + 10^((R_B - R_A) / 400))
--   R_A' = R_A + ROUND(K * (S_A - E_A))   mit S_A ∈ {0, 1} (kein Unentschieden)
--
-- Nur decisive Outcomes (home_won, away_won) aktualisieren ELO.
-- not_played / walkover werden ignoriert.
-- =============================================================================

-- ─── 1. players-Tabelle ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.players (
  id          UUID PRIMARY KEY,
  -- ELO-Rating (Standard-Startwert 1200, Integer für saubere Trigger-Updates)
  elo_rating  INTEGER NOT NULL DEFAULT 1200,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index für Bestenlisten / Sortierung nach ELO
CREATE INDEX IF NOT EXISTS players_elo_idx
  ON public.players (elo_rating DESC);

COMMENT ON TABLE public.players IS
  'ELO-Rating pro Spieler. IDs müssen mit match_results.home_player_ids / away_player_ids übereinstimmen.';
COMMENT ON COLUMN public.players.elo_rating IS
  'Standard-ELO (K=32, Startwert 1200). Wird durch Trigger update_elo_after_match aktualisiert.';

-- ─── 2. Trigger-Funktion ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_elo_after_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_k_factor       CONSTANT NUMERIC := 32.0;
  v_winner_ids     UUID[];
  v_loser_ids      UUID[];
  v_winner_avg     NUMERIC;
  v_loser_avg      NUMERIC;
  v_winner_expected NUMERIC;
  v_loser_expected  NUMERIC;
  v_winner_delta   INTEGER;
  v_loser_delta    INTEGER;
BEGIN
  -- Nur bei entschiedenen Spielen ELO aktualisieren
  IF NEW.outcome NOT IN ('home_won', 'away_won') THEN
    RETURN NEW;
  END IF;

  -- Sieger- und Verlierer-IDs bestimmen
  IF NEW.outcome = 'home_won' THEN
    v_winner_ids := NEW.home_player_ids;
    v_loser_ids  := NEW.away_player_ids;
  ELSE
    v_winner_ids := NEW.away_player_ids;
    v_loser_ids  := NEW.home_player_ids;
  END IF;

  -- Durchschnitts-ELO beider Seiten (Fallback 1200 falls keine Spieler gefunden)
  SELECT COALESCE(AVG(elo_rating), 1200) INTO v_winner_avg
  FROM public.players WHERE id = ANY(v_winner_ids);

  SELECT COALESCE(AVG(elo_rating), 1200) INTO v_loser_avg
  FROM public.players WHERE id = ANY(v_loser_ids);

  -- Expected Score (1.0 = sicherer Sieg, 0.0 = sicherer Verlierer, 0.5 = gleich)
  v_winner_expected := 1.0 / (1.0 + POWER(10, (v_loser_avg - v_winner_avg) / 400.0));
  v_loser_expected  := 1.0 - v_winner_expected;

  -- Delta = ROUND(K * (actual - expected)), actual = 1 für Sieger, 0 für Verlierer
  v_winner_delta := ROUND(v_k_factor * (1.0 - v_winner_expected));
  v_loser_delta  := ROUND(v_k_factor * (0.0 - v_loser_expected));

  -- ELO der Sieger erhöhen
  UPDATE public.players
  SET elo_rating = elo_rating + v_winner_delta, updated_at = NOW()
  WHERE id = ANY(v_winner_ids);

  -- ELO der Verlierer senken
  UPDATE public.players
  SET elo_rating = elo_rating + v_loser_delta, updated_at = NOW()
  WHERE id = ANY(v_loser_ids);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_elo_after_match() IS
  'ELO-Update-Trigger: aktualisiert players.elo_rating nach jedem entschiedenen Medenspiel (K=32).';

-- ─── 3. Trigger binden ──────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_match_results_update_elo ON public.match_results;
CREATE TRIGGER trg_match_results_update_elo
  AFTER INSERT ON public.match_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_elo_after_match();
