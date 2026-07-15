-- SWINGZ Billing System Migration
-- Phase 2: Finanzmanagement & Abrechnung
-- Created: 2026-05-02

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_number varchar(50) NOT NULL UNIQUE,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'dunning')),
  subtotal numeric(10, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(10, 2) NOT NULL DEFAULT 0,
  total_amount numeric(10, 2) NOT NULL DEFAULT 0,
  paid_amount numeric(10, 2) NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'EUR',
  notes text,
  sent_at timestamp,
  paid_at timestamp,
  cancelled_at timestamp,
  cancellation_reason text,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- INVOICE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description varchar(255) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10, 2) NOT NULL DEFAULT 0,
  tax_rate numeric(5, 2) NOT NULL DEFAULT 19.00,
  total_price numeric(10, 2) NOT NULL DEFAULT 0,
  item_type varchar(50) NOT NULL CHECK (item_type IN ('membership_fee', 'training_fee', 'court_fee', 'dunning_fee', 'other')),
  reference_id uuid,
  reference_type varchar(50),
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  payment_number varchar(50) NOT NULL UNIQUE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(10, 2) NOT NULL,
  payment_method varchar(50) NOT NULL CHECK (payment_method IN ('sepa', 'stripe', 'cash', 'bank_transfer', 'other')),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
  transaction_id varchar(255),
  stripe_payment_intent_id varchar(255),
  sepa_mandate_id uuid REFERENCES sepa_mandates(id) ON DELETE SET NULL,
  notes text,
  processed_at timestamp,
  failed_at timestamp,
  failure_reason text,
  refunded_at timestamp,
  refund_amount numeric(10, 2),
  refund_reason text,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- SEPA MANDATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sepa_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mandate_reference varchar(35) NOT NULL UNIQUE,
  creditor_id varchar(35) NOT NULL,
  iban varchar(34) NOT NULL,
  bic varchar(11),
  account_holder_name varchar(100) NOT NULL,
  signature_date date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired', 'failed')),
  last_used_date date,
  revoked_at timestamp,
  revoked_reason text,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- DUNNING RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dunning_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  dunning_level integer NOT NULL CHECK (dunning_level IN (1, 2, 3)),
  dunning_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  dunning_fee numeric(10, 2) NOT NULL DEFAULT 0,
  original_amount numeric(10, 2) NOT NULL,
  total_amount numeric(10, 2) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'paid', 'escalated', 'cancelled')),
  sent_at timestamp,
  paid_at timestamp,
  escalated_at timestamp,
  cancelled_at timestamp,
  notes text,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_club_id ON invoices(club_id);
CREATE INDEX IF NOT EXISTS idx_invoices_member_id ON invoices(member_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- Invoice items indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_item_type ON invoice_items(item_type);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_club_id ON payments(club_id);
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_payment_number ON payments(payment_number);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);

-- SEPA mandates indexes
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_club_id ON sepa_mandates(club_id);
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_member_id ON sepa_mandates(member_id);
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_status ON sepa_mandates(status);
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_mandate_reference ON sepa_mandates(mandate_reference);

-- Dunning records indexes
CREATE INDEX IF NOT EXISTS idx_dunning_records_club_id ON dunning_records(club_id);
CREATE INDEX IF NOT EXISTS idx_dunning_records_member_id ON dunning_records(member_id);
CREATE INDEX IF NOT EXISTS idx_dunning_records_invoice_id ON dunning_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_dunning_records_dunning_level ON dunning_records(dunning_level);
CREATE INDEX IF NOT EXISTS idx_dunning_records_status ON dunning_records(status);
CREATE INDEX IF NOT EXISTS idx_dunning_records_dunning_date ON dunning_records(dunning_date);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all billing tables
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sepa_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dunning_records ENABLE ROW LEVEL SECURITY;

-- Invoices policies
DROP POLICY IF EXISTS "club_members_can_view_own_invoices" ON invoices;
CREATE POLICY "club_members_can_view_own_invoices" ON invoices
  FOR SELECT USING (
    member_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = invoices.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "admins_can_create_invoices" ON invoices;
CREATE POLICY "admins_can_create_invoices" ON invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = invoices.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "admins_can_update_invoices" ON invoices;
CREATE POLICY "admins_can_update_invoices" ON invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = invoices.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- Invoice items policies
DROP POLICY IF EXISTS "club_members_can_view_invoice_items" ON invoice_items;
CREATE POLICY "club_members_can_view_invoice_items" ON invoice_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_items.invoice_id
      AND (
        i.member_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_club_memberships ucm
          WHERE ucm.club_id = i.club_id
          AND ucm.user_id = auth.uid()
          AND ucm.is_active = true
          AND ucm.role IN ('admin', 'superadmin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "admins_can_manage_invoice_items" ON invoice_items;
CREATE POLICY "admins_can_manage_invoice_items" ON invoice_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN user_club_memberships ucm ON ucm.club_id = i.club_id
      WHERE i.id = invoice_items.invoice_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- Payments policies
DROP POLICY IF EXISTS "club_members_can_view_own_payments" ON payments;
CREATE POLICY "club_members_can_view_own_payments" ON payments
  FOR SELECT USING (
    member_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = payments.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "admins_can_manage_payments" ON payments;
CREATE POLICY "admins_can_manage_payments" ON payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = payments.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- SEPA mandates policies
DROP POLICY IF EXISTS "members_can_view_own_mandates" ON sepa_mandates;
CREATE POLICY "members_can_view_own_mandates" ON sepa_mandates
  FOR SELECT USING (
    member_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = sepa_mandates.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "admins_can_manage_mandates" ON sepa_mandates;
CREATE POLICY "admins_can_manage_mandates" ON sepa_mandates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = sepa_mandates.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- Dunning records policies
DROP POLICY IF EXISTS "members_can_view_own_dunning" ON dunning_records;
CREATE POLICY "members_can_view_own_dunning" ON dunning_records
  FOR SELECT USING (
    member_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = dunning_records.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "admins_can_manage_dunning" ON dunning_records;
CREATE POLICY "admins_can_manage_dunning" ON dunning_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = dunning_records.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoice_items_updated_at ON invoice_items;
CREATE TRIGGER update_invoice_items_updated_at BEFORE UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sepa_mandates_updated_at ON sepa_mandates;
CREATE TRIGGER update_sepa_mandates_updated_at BEFORE UPDATE ON sepa_mandates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dunning_records_updated_at ON dunning_records;
CREATE TRIGGER update_dunning_records_updated_at BEFORE UPDATE ON dunning_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS FOR INVOICE NUMBER GENERATION
-- ============================================

CREATE OR REPLACE FUNCTION generate_invoice_number(p_club_id uuid)
RETURNS varchar AS $$
DECLARE
  v_year varchar(4);
  v_month varchar(2);
  v_sequence integer;
  v_invoice_number varchar(50);
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_month := TO_CHAR(CURRENT_DATE, 'MM');
  
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_sequence
  FROM (
    SELECT 
      CAST(SUBSTRING(invoice_number FROM 12 FOR 5) AS integer) as sequence_number
    FROM invoices
    WHERE club_id = p_club_id
    AND invoice_number LIKE 'INV-' || v_year || v_month || '-%'
  ) sub;
  
  v_invoice_number := 'INV-' || v_year || v_month || '-' || LPAD(v_sequence::text, 5, '0');
  
  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTIONS FOR PAYMENT NUMBER GENERATION
-- ============================================

CREATE OR REPLACE FUNCTION generate_payment_number(p_club_id uuid)
RETURNS varchar AS $$
DECLARE
  v_year varchar(4);
  v_month varchar(2);
  v_sequence integer;
  v_payment_number varchar(50);
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_month := TO_CHAR(CURRENT_DATE, 'MM');
  
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_sequence
  FROM (
    SELECT 
      CAST(SUBSTRING(payment_number FROM 12 FOR 5) AS integer) as sequence_number
    FROM payments
    WHERE club_id = p_club_id
    AND payment_number LIKE 'PAY-' || v_year || v_month || '-%'
  ) sub;
  
  v_payment_number := 'PAY-' || v_year || v_month || '-' || LPAD(v_sequence::text, 5, '0');
  
  RETURN v_payment_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTIONS FOR INVOICE STATUS UPDATE
-- ============================================

CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid numeric(10, 2);
  v_invoice_total numeric(10, 2);
BEGIN
  IF TG_TABLE_NAME = 'payments' THEN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
      SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
      FROM payments
      WHERE invoice_id = NEW.invoice_id
      AND status = 'completed';
      
      SELECT total_amount INTO v_invoice_total
      FROM invoices
      WHERE id = NEW.invoice_id;
      
      IF v_total_paid >= v_invoice_total THEN
        UPDATE invoices
        SET status = 'paid',
            paid_amount = v_total_paid,
            paid_at = COALESCE(paid_at, NOW())
        WHERE id = NEW.invoice_id;
      ELSE
        UPDATE invoices
        SET paid_amount = v_total_paid
        WHERE id = NEW.invoice_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoice_status_after_payment ON payments;
CREATE TRIGGER update_invoice_status_after_payment
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_invoice_status();

-- ============================================
-- FUNCTIONS FOR DUNNING LEVEL CALCULATION
-- ============================================

CREATE OR REPLACE FUNCTION calculate_dunning_level(p_invoice_id uuid)
RETURNS integer AS $$
DECLARE
  v_days_overdue integer;
  v_invoice_date date;
  v_due_date date;
BEGIN
  SELECT invoice_date, due_date INTO v_invoice_date, v_due_date
  FROM invoices
  WHERE id = p_invoice_id;
  
  v_days_overdue := CURRENT_DATE - v_due_date;
  
  IF v_days_overdue >= 42 THEN
    RETURN 3;
  ELSIF v_days_overdue >= 28 THEN
    RETURN 2;
  ELSIF v_days_overdue >= 14 THEN
    RETURN 1;
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE invoices IS 'Main invoice table for billing system';
COMMENT ON TABLE invoice_items IS 'Line items for each invoice';
COMMENT ON TABLE payments IS 'Payment records with multiple payment methods';
COMMENT ON TABLE sepa_mandates IS 'SEPA direct debit mandates for automatic payments';
COMMENT ON TABLE dunning_records IS 'Dunning/mahnläufe records for overdue invoices';

COMMENT ON COLUMN invoices.invoice_number IS 'Unique invoice number in format INV-YYYYMM-XXXXX';
COMMENT ON COLUMN invoices.status IS 'Invoice status: draft, sent, paid, overdue, cancelled, dunning';
COMMENT ON COLUMN payments.payment_method IS 'Payment method: sepa, stripe, cash, bank_transfer, other';
COMMENT ON COLUMN sepa_mandates.mandate_reference IS 'Unique SEPA mandate reference';
COMMENT ON COLUMN dunning_records.dunning_level IS 'Dunning level: 1 (14 days), 2 (28 days), 3 (42 days)';
