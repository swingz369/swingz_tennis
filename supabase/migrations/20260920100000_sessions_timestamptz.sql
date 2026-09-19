-- sessions.timeslot_start/end: timestamp without time zone -> timestamptz.
--
-- Bisher hielt die Spalte einen UTC-Zeitpunkt OHNE Zonenangabe (Konvention aus
-- lib/berlin-time.ts). Jeder Leser musste das wissen: der Browser las den Wert als
-- Ortszeit, Server-Routen hängten teils ein 'Z' an, teils nicht. Folge: dieselbe
-- Direktbuchung landete lokal (CEST) und auf Vercel (UTC) mit verschiedener Uhrzeit
-- in der DB, und der Kalender zeigte sie um 2 h versetzt.
--
-- Bestand: die Werte sind UTC-Zeitpunkte (so schreibt die Saisonplanung), deshalb
-- AT TIME ZONE 'UTC'. Die DB-Funktionen (create_booking_safe, check_booking_overlap,
-- publish_season_plan, save_season_clustering) casten bereits nach timestamptz bzw.
-- vergleichen mit `p_now AT TIME ZONE 'UTC'` und laufen unverändert weiter.

ALTER TABLE sessions
  ALTER COLUMN timeslot_start TYPE timestamptz USING timeslot_start AT TIME ZONE 'UTC',
  ALTER COLUMN timeslot_end   TYPE timestamptz USING timeslot_end   AT TIME ZONE 'UTC';
