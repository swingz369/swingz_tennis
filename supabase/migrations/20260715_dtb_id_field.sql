-- DTB-ID: Deutsche Tennis Bund Spielernummer
-- Enables linking to official tennis.de profiles and league standings

-- Add dtb_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS dtb_id VARCHAR(20);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS users_dtb_id_idx ON users(dtb_id);

-- Comment explaining the field
COMMENT ON COLUMN users.dtb_id IS 'DTB-Spielernummer (Deutscher Tennis Bund). Format: numeric ID assigned by tennis.de. Used for linking to official profiles and league standings.';
