-- Vereins-Abrechnungsmodell auf season_billing_configs
-- per_session (Standard/Tennisschule), membership_included (Jahresbeitrag), block_of_10 (Zehner-Block)
ALTER TABLE season_billing_configs
  ADD COLUMN IF NOT EXISTS billing_model varchar(30) NOT NULL DEFAULT 'per_session';

COMMENT ON COLUMN season_billing_configs.billing_model IS
  'per_session=Trainer-Stundensatz/Teilnehmer, membership_included=kein Rechnungs-Gen, block_of_10=Zehner-Block';
