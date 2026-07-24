-- Trial Training: Marketing Consent (Double Opt-In)
-- Adds columns to capture and confirm marketing-email consent for public
-- trial-training leads. No marketing send/campaign feature is implemented
-- here — this only adds the consent-capture + confirm plumbing so that any
-- future promotional email can check `marketing_consent_confirmed_at`
-- before sending (DSGVO/UWG double opt-in requirement).

ALTER TABLE trial_trainings
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent_token TEXT,
  ADD COLUMN IF NOT EXISTS marketing_consent_confirmed_at TIMESTAMPTZ;

-- Looked up by exact token match when confirming via the public
-- confirm-marketing endpoint.
CREATE INDEX IF NOT EXISTS idx_trial_trainings_marketing_consent_token
  ON trial_trainings(marketing_consent_token)
  WHERE marketing_consent_token IS NOT NULL;

COMMENT ON COLUMN trial_trainings.marketing_consent IS 'Participant opted in to marketing emails during trial-training signup (DOI required before any send)';
COMMENT ON COLUMN trial_trainings.marketing_consent_token IS 'Single-use token for the double opt-in confirmation link; cleared once confirmed';
COMMENT ON COLUMN trial_trainings.marketing_consent_confirmed_at IS 'Set when the participant confirms the DOI link; NULL means no confirmed consent — must not send marketing email';
