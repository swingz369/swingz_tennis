-- Season billing configuration
-- Stores per-season billing settings: trainer rates, membership fees, payment terms
CREATE TABLE IF NOT EXISTS season_billing_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

  -- Trainer cost settings
  trainer_hourly_rate numeric(10,2) NOT NULL DEFAULT 50.00,  -- €/Stunde (Override pro Saison)
  use_trainer_profile_rate boolean NOT NULL DEFAULT false,    -- true = trainer_profiles.hourly_rate verwenden, false = diesen Satz

  -- Membership fee settings
  include_membership_fee boolean NOT NULL DEFAULT true,       -- Jahresmitgliedsbeitrag berechnen
  membership_fee_amount numeric(10,2),                        -- Override (null = fee_configurations verwenden)
  membership_fee_type varchar(20) DEFAULT 'yearly' CHECK (membership_fee_type IN ('yearly', 'seasonal', 'monthly')),

  -- Invoice settings
  payment_terms_days integer NOT NULL DEFAULT 30,             -- Fälligkeit in Tagen
  invoice_notes text,                                         -- Standard-Rechnungsnotiz
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,                   -- Steuersatz (0 = umsatzsteuerbefreit)

  -- Cost splitting
  cost_split_method varchar(20) NOT NULL DEFAULT 'per_participant'
    CHECK (cost_split_method IN ('per_participant', 'flat_rate', 'per_group')),

  -- Additional flat fees per member (JSON: [{ "description": "...", "amount": 25.00 }])
  additional_fees jsonb DEFAULT '[]',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_season_billing UNIQUE (season_id)
);

-- Indexes
CREATE INDEX idx_season_billing_configs_season ON season_billing_configs(season_id);
CREATE INDEX idx_season_billing_configs_club ON season_billing_configs(club_id);

-- RLS
ALTER TABLE season_billing_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club admins can manage billing configs"
  ON season_billing_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE user_club_memberships.club_id = season_billing_configs.club_id
        AND user_club_memberships.user_id = auth.uid()
        AND user_club_memberships.role IN ('admin', 'superadmin')
        AND user_club_memberships.is_active = true
    )
  );

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_season_billing_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_season_billing_configs_updated_at
  BEFORE UPDATE ON season_billing_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_season_billing_configs_updated_at();
