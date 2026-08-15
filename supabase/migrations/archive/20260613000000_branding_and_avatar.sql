-- Branding & Avatar Support
-- Adds per-club branding columns and prepares avatar storage

-- 1. Add branding columns to clubs table
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS primary_color VARCHAR(9) DEFAULT '#1B4332';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(9) DEFAULT '#1e3a5f';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS accent_color VARCHAR(9) DEFAULT '#FF6B35';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS logo_light_url TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS logo_dark_url TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS favicon_url TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- 2. Add comments for documentation
COMMENT ON COLUMN clubs.primary_color IS 'Brand primary color (hex)';
COMMENT ON COLUMN clubs.secondary_color IS 'Brand secondary color (hex)';
COMMENT ON COLUMN clubs.accent_color IS 'Brand accent color (hex)';
COMMENT ON COLUMN clubs.logo_light_url IS 'Logo URL for light mode';
COMMENT ON COLUMN clubs.logo_dark_url IS 'Logo URL for dark mode';
COMMENT ON COLUMN clubs.favicon_url IS 'Custom favicon URL';
COMMENT ON COLUMN clubs.custom_domain IS 'Custom domain for white-label';

-- 3. Create avatars storage bucket (requires Supabase Storage setup)
-- Note: This is done via Supabase dashboard or API, not SQL.
-- Run: supabase storage create-bucket avatars --public

-- 4. Add index for custom domain lookup
CREATE INDEX IF NOT EXISTS clubs_custom_domain_idx ON clubs(custom_domain) WHERE custom_domain IS NOT NULL;
