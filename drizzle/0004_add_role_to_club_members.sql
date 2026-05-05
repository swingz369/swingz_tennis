-- Add role column to club_members table
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS role varchar(50) NOT NULL DEFAULT 'member';

-- Create index on role for faster queries
CREATE INDEX IF NOT EXISTS club_members_role_idx ON club_members(role);
