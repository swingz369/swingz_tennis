-- Migration: Session-Absage-Workflow
-- Fügt cancelled_at und cancellation_reason zur sessions-Tabelle hinzu

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

COMMENT ON COLUMN public.sessions.cancelled_at IS 'Zeitpunkt der Absage; NULL = nicht abgesagt';
COMMENT ON COLUMN public.sessions.cancellation_reason IS 'Grund der Absage (Pflichtfeld bei Absage)';

CREATE INDEX IF NOT EXISTS idx_sessions_cancelled_at
  ON public.sessions(cancelled_at)
  WHERE cancelled_at IS NOT NULL;
