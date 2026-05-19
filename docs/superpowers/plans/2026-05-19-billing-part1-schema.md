# Billing & Training System — Part 1: Database Schema

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all new tables and columns required by the billing system via a single Supabase migration.

**Architecture:** One migration file adds new tables, new columns on existing tables, a GoBD immutability trigger, and RLS policies. All changes are additive — no existing columns removed.

**Tech Stack:** PostgreSQL, Supabase migrations (files in supabase/migrations/), SQL

---

## Implementation Tasks

### Task 1: Create migration file and add columns to invoices table
- [ ] Create file: `supabase/migrations/20260519000000_billing_training_system.sql`
- [ ] Add SQL to create migration with columns on `invoices`:

```sql
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type text CHECK (invoice_type IN ('season','membership','adhoc')) DEFAULT 'adhoc',
  ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES schedules(id) ON DELETE SET NULL;
```

### Task 2: Add columns to clubs table
- [ ] Add SQL to migration for clubs table columns:

```sql
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS billing_unit_minutes int NOT NULL DEFAULT 60 CHECK (billing_unit_minutes IN (45,60)),
  ADD COLUMN IF NOT EXISTS bundesland text,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_payment_method text NOT NULL DEFAULT 'sepa' CHECK (default_payment_method IN ('sepa','transfer','cash','stripe')),
  ADD COLUMN IF NOT EXISTS invoice_number_prefix text NOT NULL DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS datev_creditor_number text;
```

### Task 3: Add columns to fee_configurations and user_club_memberships tables
- [ ] Add SQL to migration:

```sql
ALTER TABLE fee_configurations
  ADD COLUMN IF NOT EXISTS billing_unit_count int NOT NULL DEFAULT 1;

ALTER TABLE user_club_memberships
  ADD COLUMN IF NOT EXISTS fee_configuration_id uuid REFERENCES fee_configurations(id) ON DELETE SET NULL;
```

### Task 4: Add columns to invoice_items and sessions tables
- [ ] Add SQL for invoice_items and update sessions status enum:

```sql
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS datev_account_number text;

ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_status_check;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_status_check CHECK (status IN ('scheduled','ongoing','completed','cancelled','holiday_cancelled'));
```

### Task 5: Create school_holidays table with indexes
- [ ] Add SQL to migration:

```sql
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

CREATE POLICY school_holidays_select_all ON school_holidays
  FOR SELECT USING (true);
```

### Task 6: Create training_group_memberships table with RLS
- [ ] Add SQL to migration:

```sql
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

CREATE POLICY tgm_admin_manage ON training_group_memberships
  FOR ALL USING (EXISTS (
    SELECT 1 FROM clubs c
    WHERE c.id = training_group_memberships.club_id
    AND c.admin_id = auth.uid()
  ));

CREATE POLICY tgm_member_view_own ON training_group_memberships
  FOR SELECT USING (member_id = auth.uid());
```

### Task 7: Create member_balances and member_balance_entries tables
- [ ] Add SQL to migration:

```sql
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
  FOR ALL USING (EXISTS (
    SELECT 1 FROM clubs c
    WHERE c.id = member_balances.club_id
    AND c.admin_id = auth.uid()
  ));

CREATE POLICY mb_member_view_own ON member_balances
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY mbe_admin_all ON member_balance_entries
  FOR ALL USING (EXISTS (
    SELECT 1 FROM member_balances mb
    WHERE mb.id = member_balance_entries.member_balance_id
    AND EXISTS (
      SELECT 1 FROM clubs c
      WHERE c.id = mb.club_id
      AND c.admin_id = auth.uid()
    )
  ));

CREATE POLICY mbe_member_view_own ON member_balance_entries
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM member_balances mb
    WHERE mb.id = member_balance_entries.member_balance_id
    AND mb.member_id = auth.uid()
  ));
```

### Task 8: Create invoice_installments table with RLS
- [ ] Add SQL to migration:

```sql
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

CREATE POLICY installments_admin_all ON invoice_installments
  FOR ALL USING (EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_installments.invoice_id
    AND i.club_id = (
      SELECT admin_id FROM clubs WHERE admin_id = auth.uid()
    )
  ));
```

### Task 9: Create GoBD immutability trigger
- [ ] Add SQL to migration for trigger function:

```sql
CREATE OR REPLACE FUNCTION prevent_invoice_content_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('sent','partially_paid','paid','overdue','dunning','reminder_sent') THEN
    IF (NEW.subtotal <> OLD.subtotal OR NEW.total_amount <> OLD.total_amount OR
        NEW.invoice_date <> OLD.invoice_date OR NEW.invoice_type <> OLD.invoice_type) THEN
      RAISE EXCEPTION 'GoBD: Cannot modify content of sent invoice %', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gobd_invoice_immutability
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION prevent_invoice_content_update();
```

### Task 10: Extend invoices status constraint and update invoice_number function
- [ ] Add SQL to migration:

```sql
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check CHECK (status IN ('draft','sent','partially_paid','paid','overdue','dunning','reminder_sent','cancelled'));

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  v_prefix text;
  v_next_seq int;
  v_club_id uuid;
BEGIN
  v_club_id := COALESCE(current_setting('app.current_club_id', true)::uuid, 
                         (SELECT club_id FROM invoices WHERE id = NEW.id LIMIT 1));
  
  SELECT COALESCE(invoice_number_prefix, 'INV') INTO v_prefix
  FROM clubs WHERE id = v_club_id;
  
  SELECT COALESCE(MAX((string_to_array(invoice_number, '-'))[2])::int, 0) + 1 INTO v_next_seq
  FROM invoices
  WHERE club_id = v_club_id
  AND invoice_number LIKE v_prefix || '-%';
  
  RETURN v_prefix || '-' || LPAD(v_next_seq::text, 6, '0');
END;
$$ LANGUAGE plpgsql;
```

### Task 11: Verify TypeScript compilation
- [ ] Run type check:

```bash
cd /home/aeugeln/SwingZ && npx tsc --noEmit 2>&1 | head -20
```

### Task 12: Commit migration
- [ ] Stage and commit:

```bash
cd /home/aeugeln/SwingZ && git add supabase/migrations/20260519000000_billing_training_system.sql && git commit -m "feat: billing system schema migration"
```

---

## Notes
- All column additions use `IF NOT EXISTS` for idempotency
- All new tables have appropriate indexes on foreign keys and query paths
- RLS policies follow club-admin and member-self patterns
- GoBD trigger prevents modifications to sent invoices (immutability requirement)
- Status enums extended to include billing workflow states
- Migration is fully additive — no existing columns removed or modified
