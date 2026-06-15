-- Open Matches: members can create open games and others can join
-- Inspired by Playtomic's "Open Matches" feature

CREATE TABLE IF NOT EXISTS open_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  match_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  skill_level TEXT NOT NULL DEFAULT 'all'
    CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'tournament', 'all')),
  match_type TEXT NOT NULL DEFAULT 'singles'
    CHECK (match_type IN ('singles', 'doubles', 'mixed', 'social')),
  max_players INT NOT NULL DEFAULT 2 CHECK (max_players >= 2 AND max_players <= 12),
  current_players INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'full', 'cancelled', 'completed', 'expired')),
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS open_match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES open_matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'player'
    CHECK (role IN ('creator', 'player')),
  status TEXT NOT NULL DEFAULT 'joined'
    CHECK (status IN ('joined', 'left', 'kicked')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_open_matches_club ON open_matches(club_id);
CREATE INDEX IF NOT EXISTS idx_open_matches_date ON open_matches(match_date);
CREATE INDEX IF NOT EXISTS idx_open_matches_status ON open_matches(club_id, status);
CREATE INDEX IF NOT EXISTS idx_open_matches_club_date ON open_matches(club_id, match_date, status);
CREATE INDEX IF NOT EXISTS idx_open_match_participants_match ON open_match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_open_match_participants_user ON open_match_participants(user_id);

-- RLS
ALTER TABLE open_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_match_participants ENABLE ROW LEVEL SECURITY;

-- Club members can view open matches in their club
CREATE POLICY open_matches_select ON open_matches
  FOR SELECT USING (
    is_public = true AND EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE user_club_memberships.club_id = open_matches.club_id
        AND user_club_memberships.user_id = auth.uid()
        AND user_club_memberships.is_active = true
    )
  );

-- Club members can create open matches
CREATE POLICY open_matches_insert ON open_matches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE user_club_memberships.club_id = open_matches.club_id
        AND user_club_memberships.user_id = auth.uid()
        AND user_club_memberships.is_active = true
    )
  );

-- Creator can update their own matches
CREATE POLICY open_matches_update ON open_matches
  FOR UPDATE USING (auth.uid() = creator_id);

-- Creator can delete their own matches
CREATE POLICY open_matches_delete ON open_matches
  FOR DELETE USING (auth.uid() = creator_id);

-- Participants: club members can view
CREATE POLICY open_match_participants_select ON open_match_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM open_matches
      WHERE open_matches.id = open_match_participants.match_id
        AND EXISTS (
          SELECT 1 FROM user_club_memberships
          WHERE user_club_memberships.club_id = open_matches.club_id
            AND user_club_memberships.user_id = auth.uid()
            AND user_club_memberships.is_active = true
        )
    )
  );

-- Users can join matches (insert their own participation)
CREATE POLICY open_match_participants_insert ON open_match_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own participation (leave)
CREATE POLICY open_match_participants_update ON open_match_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_open_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_open_matches_updated_at
  BEFORE UPDATE ON open_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_open_matches_updated_at();
