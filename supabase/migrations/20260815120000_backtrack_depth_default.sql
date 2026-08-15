-- Backtracking war in Produktion faktisch aus: `backtrack_depth` hatte den
-- Default 0 (20260629010000_season_planning_config_optimizations.sql), und die
-- Engine überspringt den gesamten Backtracking-Pfad bei 0. Der Wert war nie
-- über die Oberfläche einstellbar, 0 ist also nirgends eine bewusste
-- Admin-Entscheidung gewesen — bestehende Zeilen werden deshalb mitgezogen.
-- Gemessene Referenz für 3: tests/bench/clustering.bench.ts, Variante (3).

ALTER TABLE public.season_planning_configs
  ALTER COLUMN backtrack_depth SET DEFAULT 3;

UPDATE public.season_planning_configs
   SET backtrack_depth = 3
 WHERE backtrack_depth = 0
    OR backtrack_depth IS NULL;

COMMENT ON COLUMN public.season_planning_configs.backtrack_depth IS
  'Anzahl der zuletzt gebildeten Gruppen, die bei nicht zugewiesenen Mitgliedern wieder aufgelöst und neu verplant werden. 0 = kein Backtracking. Default 3.';
