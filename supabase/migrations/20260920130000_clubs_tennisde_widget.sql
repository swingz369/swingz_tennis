-- tennis.de-Mannschaftswidget: Verbandskürzel + Vereinsnummer je Verein.
-- Das Widget (services.tennis.de/extern/tennisdeteamsearch.zul) ist von tennis.de
-- ausdrücklich zum Einbetten freigegeben — kein Scraping, keine Datenübernahme.
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS tennisde_verband text,
  ADD COLUMN IF NOT EXISTS tennisde_verein_nr text;

ALTER TABLE public.clubs
  DROP CONSTRAINT IF EXISTS clubs_tennisde_verband_format,
  ADD CONSTRAINT clubs_tennisde_verband_format
    CHECK (tennisde_verband IS NULL OR tennisde_verband ~ '^[A-Z]{2,6}$'),
  DROP CONSTRAINT IF EXISTS clubs_tennisde_verein_nr_format,
  ADD CONSTRAINT clubs_tennisde_verein_nr_format
    CHECK (tennisde_verein_nr IS NULL OR tennisde_verein_nr ~ '^[0-9]{1,10}$');
