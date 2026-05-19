-- Billing & Training System Migration
-- 2026-05-19

-- ============================================
-- 1. ALTER existing tables (additive only)
-- ============================================

-- invoices: add invoice_type and season_id
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type text DEFAULT 'adhoc' CHECK (invoice_type IN ('season','membership','adhoc')),
  ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES schedules(id) ON DELETE SET NULL;

-- clubs: add billing config fields
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS billing_unit_minutes int NOT NULL DEFAULT 60 CHECK (billing_unit_minutes IN (45,60)),
  ADD COLUMN IF NOT EXISTS bundesland text,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_payment_method text NOT NULL DEFAULT 'sepa' CHECK (default_payment_method IN ('sepa','transfer','cash','stripe')),
  ADD COLUMN IF NOT EXISTS invoice_number_prefix text NOT NULL DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS datev_creditor_number text;

-- fee_configurations: add billing unit count
ALTER TABLE fee_configurations
  ADD COLUMN IF NOT EXISTS billing_unit_count int NOT NULL DEFAULT 1;

-- user_club_memberships: link to fee config
ALTER TABLE user_club_memberships
  ADD COLUMN IF NOT EXISTS fee_configuration_id uuid REFERENCES fee_configurations(id) ON DELETE SET NULL;

-- invoice_items: add DATEV account field
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS datev_account_number text;

-- invoices: extend status enum to include billing workflow states
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft','sent','partially_paid','paid','overdue','dunning','reminder_sent','cancelled'));

-- sessions: add holiday_cancelled status
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('scheduled','ongoing','completed','cancelled','holiday_cancelled'));

-- ============================================
-- 2. school_holidays table
-- ============================================

CREATE TABLE IF NOT EXISTS school_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundesland text NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  year int NOT NULL,
  UNIQUE (bundesland, name, year)
);

CREATE INDEX IF NOT EXISTS idx_school_holidays_bundesland ON school_holidays(bundesland);
CREATE INDEX IF NOT EXISTS idx_school_holidays_dates ON school_holidays(start_date, end_date);

ALTER TABLE school_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_holidays_select_all ON school_holidays FOR SELECT USING (true);

-- ============================================
-- 3. training_group_memberships table
-- ============================================

CREATE TABLE IF NOT EXISTS training_group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_group_id uuid NOT NULL REFERENCES training_groups(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  joined_at date NOT NULL,
  left_at date,
  left_reason text CHECK (left_reason IN ('group_change','season_end','cancelled','manual')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tgm_group ON training_group_memberships(training_group_id);
CREATE INDEX IF NOT EXISTS idx_tgm_member ON training_group_memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_tgm_active ON training_group_memberships(member_id, club_id) WHERE left_at IS NULL;

ALTER TABLE training_group_memberships ENABLE ROW LEVEL SECURITY;

-- Use existing user_club_memberships pattern for RLS
CREATE POLICY tgm_admin_manage ON training_group_memberships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = training_group_memberships.club_id
        AND ucm.user_id = auth.uid()
        AND ucm.is_active = true
        AND ucm.role IN ('admin','superadmin')
    )
  );

CREATE POLICY tgm_member_view_own ON training_group_memberships
  FOR SELECT USING (member_id = auth.uid());

-- ============================================
-- 4. member_balances and member_balance_entries
-- ============================================

CREATE TABLE IF NOT EXISTS member_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  balance numeric(10,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, club_id)
);

CREATE TABLE IF NOT EXISTS member_balance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_balance_id uuid NOT NULL REFERENCES member_balances(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  reason text NOT NULL,
  reference_type text CHECK (reference_type IN ('group_change','invoice','payment','manual')),
  reference_id uuid,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mbe_balance ON member_balance_entries(member_balance_id);
CREATE INDEX IF NOT EXISTS idx_mb_club ON member_balances(club_id);

ALTER TABLE member_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_balance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY mb_admin_all ON member_balances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = member_balances.club_id
        AND ucm.user_id = auth.uid()
        AND ucm.is_active = true
        AND ucm.role IN ('admin','superadmin')
    )
  );

CREATE POLICY mb_member_view_own ON member_balances
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY mbe_admin_all ON member_balance_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM member_balances mb
      JOIN user_club_memberships ucm ON ucm.club_id = mb.club_id
      WHERE mb.id = member_balance_entries.member_balance_id
        AND ucm.user_id = auth.uid()
        AND ucm.is_active = true
        AND ucm.role IN ('admin','superadmin')
    )
  );

CREATE POLICY mbe_member_view_own ON member_balance_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM member_balances mb
      WHERE mb.id = member_balance_entries.member_balance_id
        AND mb.member_id = auth.uid()
    )
  );

-- ============================================
-- 5. invoice_installments table
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  installment_number int NOT NULL,
  amount numeric(10,2) NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue')),
  paid_at timestamptz,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_installments_invoice ON invoice_installments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_installments_status ON invoice_installments(status);

ALTER TABLE invoice_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY installments_member_view_own ON invoice_installments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_installments.invoice_id
        AND i.member_id = auth.uid()
    )
  );

CREATE POLICY installments_admin_all ON invoice_installments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN user_club_memberships ucm ON ucm.club_id = i.club_id
      WHERE i.id = invoice_installments.invoice_id
        AND ucm.user_id = auth.uid()
        AND ucm.is_active = true
        AND ucm.role IN ('admin','superadmin')
    )
  );

-- ============================================
-- 6. GoBD immutability trigger
-- ============================================

CREATE OR REPLACE FUNCTION prevent_invoice_content_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('sent','partially_paid','paid','overdue','dunning','reminder_sent') THEN
    IF (NEW.subtotal <> OLD.subtotal OR
        NEW.total_amount <> OLD.total_amount OR
        NEW.invoice_date <> OLD.invoice_date OR
        NEW.invoice_type IS DISTINCT FROM OLD.invoice_type) THEN
      RAISE EXCEPTION 'GoBD: Cannot modify content of sent invoice %', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gobd_invoice_immutability ON invoices;
CREATE TRIGGER gobd_invoice_immutability
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION prevent_invoice_content_update();

-- ============================================
-- 7. Updated generate_invoice_number() with prefix support
-- ============================================

CREATE OR REPLACE FUNCTION generate_invoice_number(p_club_id uuid)
RETURNS varchar AS $$
DECLARE
  v_prefix text;
  v_year varchar(4);
  v_month varchar(2);
  v_sequence integer;
BEGIN
  SELECT COALESCE(invoice_number_prefix, 'INV') INTO v_prefix
  FROM clubs WHERE id = p_club_id;

  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_month := TO_CHAR(CURRENT_DATE, 'MM');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM LENGTH(v_prefix) + 9 FOR 5) AS integer)
  ), 0) + 1 INTO v_sequence
  FROM invoices
  WHERE club_id = p_club_id
    AND invoice_number LIKE v_prefix || '-' || v_year || v_month || '-%';

  RETURN v_prefix || '-' || v_year || v_month || '-' || LPAD(v_sequence::text, 5, '0');
END;
$$ LANGUAGE plpgsql;
