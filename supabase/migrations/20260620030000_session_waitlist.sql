-- Migration: Session Waitlist
-- Warteliste für Training-Sessions (wenn max_participants erreicht)

CREATE TABLE IF NOT EXISTS session_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  club_id UUID NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  UNIQUE(session_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_session ON session_waitlist(session_id, position);
CREATE INDEX IF NOT EXISTS idx_waitlist_member ON session_waitlist(member_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_club ON session_waitlist(club_id);
