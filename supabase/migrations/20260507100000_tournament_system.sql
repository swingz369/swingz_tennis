-- Migration: Tournament System
-- Date: 2026-05-07
-- Purpose: Create tables for tournament management

CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  format TEXT DEFAULT 'single_elimination' CHECK (format IN ('single_elimination', 'double_elimination', 'round_robin', 'swiss')),
  category TEXT DEFAULT 'open' CHECK (category IN ('open', 'men', 'women', 'mixed', 'junior', 'senior')),
  surface TEXT,
  max_participants INTEGER DEFAULT 16,
  registration_deadline DATE,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'registration' CHECK (status IN ('draft', 'registration', 'active', 'completed', 'cancelled')),
  prize_info TEXT,
  entry_fee NUMERIC(10,2) DEFAULT 0,
  organizer_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES auth.users(id),
  registration_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'withdrawn', 'disqualified')),
  seed INTEGER,
  payment_status TEXT DEFAULT 'pending',
  notes TEXT,
  UNIQUE (tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player1_id UUID REFERENCES auth.users(id),
  player2_id UUID REFERENCES auth.users(id),
  court_id UUID REFERENCES courts(id),
  scheduled_at TIMESTAMPTZ,
  score TEXT,
  winner_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'walkover')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tournaments_select" ON tournaments FOR SELECT USING (is_superadmin() OR is_club_member(club_id));
CREATE POLICY "tournaments_manage" ON tournaments FOR ALL USING (is_club_admin(club_id));

ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reg_select" ON tournament_registrations FOR SELECT USING (user_id = auth.uid() OR is_club_admin((SELECT club_id FROM tournaments WHERE id = tournament_id)));
CREATE POLICY "reg_insert" ON tournament_registrations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reg_manage" ON tournament_registrations FOR ALL USING (is_club_admin((SELECT club_id FROM tournaments WHERE id = tournament_id)));

ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_select" ON tournament_matches FOR SELECT USING (is_club_member((SELECT club_id FROM tournaments WHERE id = tournament_id)));
CREATE POLICY "matches_manage" ON tournament_matches FOR ALL USING (is_club_admin((SELECT club_id FROM tournaments WHERE id = tournament_id)));
