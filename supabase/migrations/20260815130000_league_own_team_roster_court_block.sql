-- Migration: Ligen & Teams — eigene Mannschaft, Spielbericht, Kader, Platzsperre
--
-- Hintergrund (Analyse 15.08.2026): Der nuLiga-Sync schrieb JEDE Begegnung der
-- Gruppe als eigenen Spieltag (hart `is_home = true`, `opponent = homeTeam`).
-- Ohne eine gespeicherte "das ist unsere Mannschaft"-Angabe kann der Scraper-
-- Pfad nicht filtern — der CSV-Pfad konnte es, weil er `teamName` als
-- Formularfeld bekommt. Diese Migration schafft die fehlende Angabe.
--
-- 1) leagues.own_team_name    — welches Team der Gruppe gehört uns
-- 2) leagues.nuliga_roster_url — Mannschaftsmeldung (Meldeliste) der eigenen Mannschaft
-- 3) match_days.nuliga_report_url — Spielbericht-Link (dort stehen die Spieler)
-- 4) league_players           — Kader mit LK aus der Meldeliste
-- 5) court_closures.match_day_id — Heimspiel sperrt Plätze, Löschen gibt sie frei
--
-- DSGVO: league_players enthält Klarnamen + LK. Gespeichert wird ausschließlich
-- die Meldeliste der EIGENEN Mannschaft (Vereinsmitglieder, Vertragserfüllung).
-- Fremde Spieler werden nicht importiert — der Spielbericht wird nur verlinkt.

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS own_team_name varchar(200),
  ADD COLUMN IF NOT EXISTS nuliga_roster_url text;

COMMENT ON COLUMN public.leagues.own_team_name IS
  'Name der eigenen Mannschaft exakt wie in der nuLiga-Tabelle, z. B. "TC Rheinland II". Steuert den Spielplan-Filter im Sync.';

ALTER TABLE public.match_days
  ADD COLUMN IF NOT EXISTS nuliga_report_url text;

ALTER TABLE public.court_closures
  ADD COLUMN IF NOT EXISTS match_day_id uuid REFERENCES public.match_days(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS court_closures_match_day_idx
  ON public.court_closures(match_day_id);

-- ── Kader / Meldeliste ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.league_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  -- Verknüpfung zum Vereinsmitglied, sofern der Name zugeordnet werden konnte.
  member_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name varchar(200) NOT NULL,
  lk varchar(10),                 -- Leistungsklasse, z. B. "LK 12,3"
  position_number integer,        -- Meldeposition (1 = erste Position)
  source_url text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS league_players_league_name_uniq
  ON public.league_players(league_id, lower(name));
CREATE INDEX IF NOT EXISTS league_players_club_idx ON public.league_players(club_id);
CREATE INDEX IF NOT EXISTS league_players_member_idx ON public.league_players(member_id);

ALTER TABLE public.league_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_players FORCE ROW LEVEL SECURITY;

-- Policies analog zu teams_* (siehe 20260715010000_new_feature_tables.sql):
-- lesen darf jedes aktive Vereinsmitglied, schreiben nur admin/superadmin.
DROP POLICY IF EXISTS league_players_select ON public.league_players;
CREATE POLICY league_players_select ON public.league_players FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_club_memberships ucm
          WHERE ucm.user_id = auth.uid() AND ucm.club_id = league_players.club_id AND ucm.is_active = true)
);

DROP POLICY IF EXISTS league_players_insert ON public.league_players;
CREATE POLICY league_players_insert ON public.league_players FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_club_memberships ucm
          WHERE ucm.user_id = auth.uid() AND ucm.club_id = league_players.club_id
            AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
);

DROP POLICY IF EXISTS league_players_update ON public.league_players;
CREATE POLICY league_players_update ON public.league_players FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_club_memberships ucm
          WHERE ucm.user_id = auth.uid() AND ucm.club_id = league_players.club_id
            AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
);

DROP POLICY IF EXISTS league_players_delete ON public.league_players;
CREATE POLICY league_players_delete ON public.league_players FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.user_club_memberships ucm
          WHERE ucm.user_id = auth.uid() AND ucm.club_id = league_players.club_id
            AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
);
