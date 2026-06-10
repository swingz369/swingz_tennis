-- ═══════════════════════════════════════════════════════════════
-- Migration: dunning_records — fehlende Spalten ergänzen
-- DB hat 7 Spalten, Supabase-Migration erwartet 17
-- Füge die für RLS und Datenintegrität kritischen Spalten hinzu
-- ═══════════════════════════════════════════════════════════════

-- 1. Spalten als nullable hinzufügen (wegen bestehender 1.200 Zeilen)
ALTER TABLE dunning_records
  ADD COLUMN IF NOT EXISTS club_id    uuid,
  ADD COLUMN IF NOT EXISTS member_id  uuid,
  ADD COLUMN IF NOT EXISTS status     varchar(20) DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS paid_at    timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Backfill club_id + member_id aus der verlinkten invoice
UPDATE dunning_records dr
SET
  club_id   = inv.club_id,
  member_id = inv.member_id
FROM invoices inv
WHERE dr.invoice_id = inv.id
  AND dr.club_id IS NULL;

-- 3. NOT NULL Constraints setzen (member_id bleibt nullable — nicht alle Invoices haben member_id)
ALTER TABLE dunning_records
  ALTER COLUMN club_id SET NOT NULL;

-- 4. Foreign Keys
ALTER TABLE dunning_records
  ADD CONSTRAINT dunning_records_club_id_fkey
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  ADD CONSTRAINT dunning_records_member_id_fkey
    FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE;

-- 5. Indexes für Performance + RLS
CREATE INDEX IF NOT EXISTS idx_dunning_records_club_id    ON dunning_records(club_id);
CREATE INDEX IF NOT EXISTS idx_dunning_records_member_id  ON dunning_records(member_id);
CREATE INDEX IF NOT EXISTS idx_dunning_records_status     ON dunning_records(status);
CREATE INDEX IF NOT EXISTS idx_dunning_records_invoice_id ON dunning_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_dunning_records_level      ON dunning_records(level);

-- 6. Backfill created_at/updated_at für bestehende Zeilen
UPDATE dunning_records SET created_at = sent_at WHERE created_at IS NULL;
UPDATE dunning_records SET updated_at = sent_at WHERE updated_at IS NULL;
