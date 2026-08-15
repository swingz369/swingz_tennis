-- A2: Ämterbasierte Permissions als JSONB-Flags pro Membership
-- Kein neuer Rollentyp — Flags ergänzen die bestehende 5er-Hierarchie.
-- Mögliche Ämter: kassenwart, jugendwart, platzwart, mannschaftsfuehrer, turnierleiter

ALTER TABLE user_club_memberships
  ADD COLUMN IF NOT EXISTS office_flags JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN user_club_memberships.office_flags IS
  'Funktionale Vereinsämter: {"kassenwart":true,"mannschaftsfuehrer":true,...}. '
  'Ergänzt die Rolle, ersetzt sie nicht.';

CREATE INDEX IF NOT EXISTS idx_memberships_office_flags
  ON user_club_memberships USING GIN (office_flags);
