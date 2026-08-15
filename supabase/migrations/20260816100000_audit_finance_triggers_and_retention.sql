-- Migration: Finanzvorgänge lückenlos protokollieren + Aufbewahrungsregel
--
-- Befund aus dem Best-Practice-Audit (docs/ARCHIV/2026-08-15-best-practice-audit.md):
-- von 227 mutierenden Routen schreiben 18 einen Audit-Eintrag; 29 Finanz-Routen
-- (Rechnung, SEPA, Zahlung) protokollieren nichts. Das ist GoBD-relevant.
--
-- Warum Trigger statt `logAudit()` in 29 Routen:
-- Die Abrechnung schreibt aus Routen, aus `billing.service.ts`, aus dem
-- Cron-Job `billing-overdue` und über den Service-Client — 29-mal derselbe
-- Aufruf hinzuzufügen deckt genau die heutigen Pfade ab und keinen einzigen
-- künftigen. Ein Trigger sitzt an der Tabelle: er greift für jeden Schreibweg,
-- auch für den, den morgen jemand dazubaut, und für Korrekturen direkt in der
-- Datenbank. Genau das verlangt die GoBD-Nachvollziehbarkeit.
--
-- Live-Zustand vor dieser Migration (AGENTS.md → Migrationen, Regel 1):
--   SELECT tgname FROM pg_trigger WHERE tgrelid IN
--     ('invoices'::regclass,'payments'::regclass,'sepa_mandates'::regclass)
--     AND NOT tgisinternal;
--   → keine Audit-Trigger vorhanden.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. actor_id nullable — Systemvorgänge haben keinen Handelnden
-- ---------------------------------------------------------------------------
-- Bisher NOT NULL. Ein Trigger, den der Service-Client oder ein Cron-Job
-- auslöst, kennt `auth.uid()` nicht — der Eintrag ginge verloren, obwohl gerade
-- die automatischen Vorgänge (Mahnlauf, Rechnungslauf) protokolliert gehören.
-- `lib/audit.ts` verwirft Einträge ohne Actor weiterhin von sich aus; die
-- Oberfläche zeigt für null bereits „System" an.
ALTER TABLE audit_logs ALTER COLUMN actor_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Trigger-Funktion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_finance_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row      RECORD;
  v_club_id  UUID;
  v_details  JSONB;
  v_action   TEXT;
BEGIN
  -- Reine Nicht-Änderungen erzeugen keinen Eintrag — sonst füllt ein
  -- Massen-Update das Protokoll mit Rauschen.
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NULL;
  END IF;

  v_row := COALESCE(NEW, OLD);
  v_action := CASE TG_OP WHEN 'INSERT' THEN 'create'
                         WHEN 'UPDATE' THEN 'update'
                         ELSE 'delete' END;

  -- club_id: die Tabelle trägt sie selbst, `payments` nur über die Rechnung.
  IF TG_TABLE_NAME = 'payments' THEN
    SELECT i.club_id INTO v_club_id FROM invoices i WHERE i.id = v_row.invoice_id;
  ELSE
    v_club_id := v_row.club_id;
  END IF;

  -- Details: nur die Felder, die den Vorgang erklären. Keine Kontodaten —
  -- IBAN und Kontoinhaber gehören nicht in ein Protokoll, das Admins lesen.
  --
  -- Bewusst IF/ELSIF statt eines CASE über `jsonb_build_object`: plpgsql
  -- bereitet einen SQL-Ausdruck als Ganzes vor und löst dabei ALLE Feldzugriffe
  -- auf die RECORD-Variable auf — auch die in nicht genommenen CASE-Zweigen.
  -- Ein `v_row.payment_method` im Zahlungs-Zweig lässt damit jedes INSERT auf
  -- `invoices` mit „record v_row has no field" scheitern. Getrennte Zweige
  -- werden dagegen nur ausgeführt, wenn sie an der Reihe sind.
  IF TG_TABLE_NAME = 'invoices' THEN
    v_details := jsonb_build_object(
      'invoice_number', v_row.invoice_number,
      'amount',         v_row.amount,
      'status',         v_row.status,
      'invoice_type',   v_row.invoice_type
    );
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_details := v_details || jsonb_build_object('status_before', OLD.status);
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    v_details := jsonb_build_object(
      'amount',         v_row.amount,
      'payment_method', v_row.payment_method,
      'status',         v_row.status
    );
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_details := v_details || jsonb_build_object('status_before', OLD.status);
    END IF;
  ELSE
    v_details := jsonb_build_object(
      'mandate_reference', v_row.mandate_reference,
      'is_active',         v_row.is_active,
      'revoked',           (v_row.revoked_at IS NOT NULL)
    );
  END IF;

  v_details := jsonb_strip_nulls(v_details);

  INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, club_id, details)
  VALUES (
    auth.uid(),
    v_action,
    CASE TG_TABLE_NAME WHEN 'invoices' THEN 'invoice'
                       WHEN 'payments' THEN 'payment'
                       ELSE 'sepa_mandate' END,
    v_row.id,
    v_club_id,
    v_details || jsonb_build_object('source', 'db_trigger')
  );

  RETURN NULL; -- AFTER-Trigger, Rückgabewert ohne Wirkung
END;
$$;

COMMENT ON FUNCTION audit_finance_change() IS
  'Schreibt jede Änderung an invoices/payments/sepa_mandates nach audit_logs (GoBD).';

-- ---------------------------------------------------------------------------
-- 3. Trigger
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS audit_invoices ON invoices;
CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_finance_change();

DROP TRIGGER IF EXISTS audit_payments ON payments;
CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_finance_change();

DROP TRIGGER IF EXISTS audit_sepa_mandates ON sepa_mandates;
CREATE TRIGGER audit_sepa_mandates
  AFTER INSERT OR UPDATE OR DELETE ON sepa_mandates
  FOR EACH ROW EXECUTE FUNCTION audit_finance_change();

-- ---------------------------------------------------------------------------
-- 4. Aufbewahrung
-- ---------------------------------------------------------------------------
-- Bisher gab es keine Regel: die Tabelle wächst unbegrenzt, und Zugriffs-
-- protokolle mit Personenbezug dürfen das nicht (Art. 5 Abs. 1 lit. e DSGVO).
-- Finanzvorgänge unterliegen dagegen der 10-jährigen Aufbewahrungspflicht
-- (§ 147 AO) und dürfen nicht mitgelöscht werden.
CREATE OR REPLACE FUNCTION prune_audit_logs()
RETURNS TABLE (deleted_security BIGINT, deleted_read BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lese-Protokolle sind am kürzesten nützlich: sie belegen einen Blick, keinen
  -- Vorgang. 90 Tage reichen, um einem Verdacht nachzugehen.
  WITH gone AS (
    DELETE FROM audit_logs
    WHERE action IN ('PII_READ', 'READ_MEMBER')
      AND created_at < now() - interval '90 days'
    RETURNING 1
  )
  SELECT count(*) INTO deleted_read FROM gone;

  -- Sicherheitsprotokolle (alles außer Finanzvorgängen): 12 Monate.
  WITH gone AS (
    DELETE FROM audit_logs
    WHERE resource_type NOT IN ('invoice', 'payment', 'sepa_mandate')
      AND action NOT IN ('PII_READ', 'READ_MEMBER')
      AND created_at < now() - interval '12 months'
    RETURNING 1
  )
  SELECT count(*) INTO deleted_security FROM gone;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION prune_audit_logs() IS
  'Aufbewahrung: Lese-Protokolle 90 Tage, Sicherheitsprotokolle 12 Monate, Finanzvorgänge unbegrenzt (§ 147 AO, 10 Jahre). Aufruf über /api/cron/prune-audit-logs.';

COMMIT;
