-- nuLiga-Kader: DTB-ID und Jahrgang mitspeichern.
--
-- Der Kader wird bei jedem Sync komplett neu geschrieben. Ohne gespeicherte
-- DTB-ID kann die Zuordnung Spieler <-> Vereinsmitglied nur über den Namen
-- laufen und ginge bei Namensänderung oder Namensgleichheit verloren. Der
-- Jahrgang (steht bei nuLiga in Klammern hinter dem Namen) trennt gleichnamige
-- Personen. Beide Werte stammen aus der öffentlichen Meldeliste der EIGENEN
-- Mannschaft.
ALTER TABLE public.league_players
  ADD COLUMN IF NOT EXISTS dtb_id varchar(20),
  ADD COLUMN IF NOT EXISTS birth_year smallint;

CREATE INDEX IF NOT EXISTS league_players_dtb_idx
  ON public.league_players (club_id, dtb_id)
  WHERE dtb_id IS NOT NULL;
