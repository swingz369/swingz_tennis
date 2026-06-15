-- nuLiga Sync Log: Tracks every sync attempt for audit and debugging
-- Enables admins to see when leagues were synced and whether it succeeded

CREATE TABLE IF NOT EXISTS nuliga_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- Sync outcome
  status VARCHAR(20) NOT NULL DEFAULT 'success', -- 'success', 'partial', 'failed'
  trigger VARCHAR(20) NOT NULL DEFAULT 'manual',  -- 'manual', 'cron'
  
  -- Results summary
  teams_created INTEGER NOT NULL DEFAULT 0,
  teams_updated INTEGER NOT NULL DEFAULT 0,
  matches_created INTEGER NOT NULL DEFAULT 0,
  matches_updated INTEGER NOT NULL DEFAULT 0,
  
  -- Error details (null on success)
  error_message TEXT,
  
  -- nuLiga metadata
  nuliga_url TEXT NOT NULL,
  nuliga_group_name VARCHAR(300),
  nuliga_championship VARCHAR(300),
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INTEGER, -- milliseconds
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sync_log_league_id ON nuliga_sync_log(league_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_club_id ON nuliga_sync_log(club_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON nuliga_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_created_at ON nuliga_sync_log(created_at DESC);

-- RLS: Admins can read sync logs for their club
ALTER TABLE nuliga_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_log_select_admin" ON nuliga_sync_log
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM user_club_memberships
      WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin') AND is_active = true
    )
  );

-- Service role can insert (used by sync routes which bypass RLS)
CREATE POLICY "sync_log_insert_service" ON nuliga_sync_log
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE nuliga_sync_log IS 'Audit log for nuLiga sync operations. Tracks every sync attempt with results and errors.';
