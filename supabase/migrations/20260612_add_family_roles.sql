-- Add role column to family_accounts to distinguish parents/guardians from children
ALTER TABLE family_accounts ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('parent', 'child', 'member'));

-- Add a PIN for parent access verification (optional extra security)
ALTER TABLE family_accounts ADD COLUMN IF NOT EXISTS parent_pin_hash VARCHAR(255);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_family_accounts_role ON family_accounts(role);
CREATE INDEX IF NOT EXISTS idx_family_accounts_group ON family_accounts(family_group_id);

-- Update existing records: if date_of_birth exists and user is under 18, mark as child
UPDATE family_accounts fa
SET role = 'child'
FROM users u
WHERE fa.user_id = u.id
  AND u.date_of_birth IS NOT NULL
  AND u.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')
  AND fa.role = 'member';
