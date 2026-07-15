-- ═══════════════════════════════════════════════════════════════
-- Migration: Dedizierte SELECT-Policy für dunning_records
-- wenn member_id NULL ist, über invoices.member_id auflösen.
-- Alle 1.200 existierenden Records haben member_id = NULL,
-- daher greift members_can_view_own_dunning (member_id = auth.uid()) nicht.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "members_can_view_own_dunning_via_invoice" ON dunning_records;
CREATE POLICY "members_can_view_own_dunning_via_invoice" ON dunning_records
  FOR SELECT USING (
    member_id IS NULL
    AND EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = dunning_records.invoice_id
      AND i.member_id = auth.uid()
    )
  );
