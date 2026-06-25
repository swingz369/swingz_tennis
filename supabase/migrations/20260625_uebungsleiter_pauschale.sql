-- F2: Übungsleiterpauschale (§ 3 Nr. 26 EStG) in Trainer-Honorar
-- Trennt steuerfreien und steuerpflichtigen Anteil pro Abrechnung.

ALTER TABLE trainer_billings
  ADD COLUMN IF NOT EXISTS tax_free_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_amount  NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN trainer_billings.tax_free_amount IS
  'Steuerfreier Anteil (§ 3 Nr. 26 EStG Übungsleiterpauschale, max. 3.000 € p.a.)';
COMMENT ON COLUMN trainer_billings.taxable_amount IS
  'Steuerpflichtiger Anteil (Betrag über der Übungsleiterpauschale)';
