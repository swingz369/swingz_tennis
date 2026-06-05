-- Migration: Allow walk-in / direct booking sessions
-- Walk-in sessions are created ad-hoc when a member books a free court slot
-- without a pre-existing trainer-led session.

-- 1. Make trainer_id nullable (walk-in sessions have no trainer)
ALTER TABLE public.sessions ALTER COLUMN trainer_id DROP NOT NULL;

-- 2. Add session_type column to distinguish walk-in from regular sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'training'
  CHECK (session_type IN ('training', 'walk_in', 'event', 'maintenance'));

COMMENT ON COLUMN public.sessions.session_type IS 'training = regular trainer session, walk_in = ad-hoc member booking, event = club event, maintenance = court blocked';

-- 3. Index for quick walk-in session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_type ON public.sessions(session_type) WHERE session_type = 'walk_in';
