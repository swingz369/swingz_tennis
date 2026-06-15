-- nuLiga Integration: URL mapping for automatic league sync
-- Enables SwingZ to pull standings and results directly from nuLiga portals

-- Add nuliga_url column to leagues table
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS nuliga_url TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Comment explaining the fields
COMMENT ON COLUMN leagues.nuliga_url IS 'Full nuLiga groupPage URL (e.g. https://htv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/groupPage?championship=...&group=...). Used by the sync service to pull standings and match results.';
COMMENT ON COLUMN leagues.last_synced_at IS 'Timestamp of the last successful sync from nuLiga.';
