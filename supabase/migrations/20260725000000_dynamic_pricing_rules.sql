-- ============================================================================
-- P2 #11: Dynamische Preisgestaltung — Zeitbasierte Preise für Plätze
-- Adds time-of-day, day-of-week, and season-based pricing dimensions
-- ============================================================================

-- 1. Add time_ranges (JSONB) — array of {start, end, price_multiplier} for peak/off-peak pricing
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS time_ranges JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN pricing_rules.time_ranges IS
  'Array of {start: "HH:MM", end: "HH:MM", price_multiplier: number} for time-of-day pricing';

-- 2. Add days_of_week (integer[]) — which days this rule applies to (0=Sun, 6=Sat)
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS days_of_week SMALLINT[] DEFAULT NULL;

COMMENT ON COLUMN pricing_rules.days_of_week IS
  'Array of day numbers (0=Sunday, 6=Saturday). NULL = all days.';

-- 3. Add season_id (UUID) — optional FK to seasons for season-specific pricing
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE SET NULL;

COMMENT ON COLUMN pricing_rules.season_id IS
  'Optional link to a season — rule only active during that season';

-- 4. Add indexes for the new columns
CREATE INDEX IF NOT EXISTS pricing_rules_season_id_idx ON pricing_rules(season_id);
CREATE INDEX IF NOT EXISTS pricing_rules_club_season_idx ON pricing_rules(club_id, season_id);

-- 5. Add valid_from / valid_until for date-range based rules (e.g. seasonal pricing)
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ;

ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;

COMMENT ON COLUMN pricing_rules.valid_from IS 'Optional start date for rule validity';
COMMENT ON COLUMN pricing_rules.valid_until IS 'Optional end date for rule validity';

CREATE INDEX IF NOT EXISTS pricing_rules_validity_idx ON pricing_rules(valid_from, valid_until);

-- 6. Add a name/description for human-readable identification
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS name VARCHAR(200);

ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS pricing_rules_name_idx ON pricing_rules(name);
