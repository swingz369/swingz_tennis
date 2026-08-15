-- Dashboard background image per club (admin-configurable cover photo)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS dashboard_bg_url TEXT;
COMMENT ON COLUMN clubs.dashboard_bg_url IS 'Cover photo shown behind the admin dashboard hero (e.g. club grounds)';
