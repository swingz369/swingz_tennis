-- Migration: nuLiga-Vereinsseite am Verein hinterlegen
--
-- Hintergrund: Bisher trug ein Admin je Mannschaft eine nuLiga-URL von Hand
-- ein (Gruppenseite ODER Mannschaftsportrait) plus den eigenen Mannschaftsnamen
-- „exakt wie in der nuLiga-Tabelle". Das ist fehleranfällig (eine falsche URL
-- bleibt unbemerkt, bis der Sync leere Ergebnisse liefert) und muss zu jeder
-- Saison wiederholt werden.
--
-- Die nuLiga-Vereinsseite (…/wa/clubTeams?club=<nr>) listet dagegen ALLE
-- Mannschaften eines Vereins mit Liga, Gruppenseite und Mannschaftsportrait.
-- Einmal hinterlegt, kann SwingZ die Mannschaften jederzeit selbst holen —
-- auch für die nächste Saison, ohne neue Eingabe.
--
-- Datenschutz: Diese URL ist zugleich die Grenze für den Kader-Import. Nur
-- Mannschaftsportraits, die auf DIESER Vereinsseite stehen, dürfen Spielernamen
-- liefern (siehe app/api/leagues/[id]/roster/route.ts). Fremde Vereine bleiben
-- damit auf Tabelle und Spielplan beschränkt — Mannschaftsnamen ja,
-- Personendaten nein.

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS nuliga_club_url text;

COMMENT ON COLUMN public.clubs.nuliga_club_url IS
  'nuLiga-Vereinsseite (…/wa/clubTeams?club=<nr>). Quelle der Mannschaftsübersicht und zugleich die Datenschutz-Grenze für den Kader-Import: nur hier gelistete Mannschaftsportraits dürfen Spielernamen liefern.';
