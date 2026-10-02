-- SECURITY-DEFINER-Funktionen ohne eigene Rechteprüfung (OPEN_ITEMS P0, 02.10.2026).
--
-- Lokal geprüft: 59 SECURITY-DEFINER-Funktionen in public waren für authenticated
-- ausführbar, fast alle auch für anon. Sie umgehen RLS. Wer per
-- POST /rest/v1/rpc/<name> aufruft, konnte z. B. Guthabenbuchungen auf fremde
-- Konten schreiben (add_balance_entry_atomic) oder Buchungen für beliebige
-- Mitglieder anlegen (create_booking_safe).
--
-- Drei Gruppen:
--  1. Nur serverseitig (Service-Client, Edge Function, Cron) oder gar nicht
--     aufgerufen, dazu alle Trigger-Funktionen → EXECUTE nur noch service_role.
--     Trigger feuern unabhängig vom EXECUTE-Recht; Postgres prüft es nur bei
--     CREATE TRIGGER.
--  2. Mit Nutzer-Client aufgerufen, ohne eigene Prüfung → SECURITY INVOKER,
--     damit die vorhandenen RLS-Policies greifen.
--  3. RLS-Helfer (is_club_admin & Co.), Chat-/News-Funktionen und
--     generate_season_invoices_atomic prüfen selbst bzw. geben nur Auskunft über
--     den Aufrufer — bleiben. Bewacht von rls-policy-catalog.test.ts.

-- 1. Nur service_role ---------------------------------------------------------
DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (
        p.prorettype = 'trigger'::regtype
        OR p.proname IN (
          'calculate_member_fees', 'calculate_payment_fee', 'check_availability_overlap',
          'claim_background_job', 'complete_job', 'create_booking_safe',
          'create_invoice_with_items', 'enqueue_job', 'fail_job',
          'generate_weekly_club_reports', 'get_active_rate_tiers', 'get_active_sepa_mandate',
          'get_active_trainers', 'get_current_trainer_rate', 'get_pending_jobs',
          'get_session_end_time', 'get_setting_value', 'get_settings_as_object',
          'get_trainer_full_name', 'get_upcoming_trial_trainings',
          'get_valid_fee_configurations', 'has_active_sepa_mandate',
          'increment_member_balance', 'mark_overdue_invoices', 'prune_audit_logs',
          'start_job', 'validate_booking_rules'
        )
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END
$$;

-- 2. Nutzeraufrufe laufen unter RLS -----------------------------------------
-- Gruppenwechsel (lib/services/group-change.service.ts, Nutzer-Client):
-- mb_admin_all / mbe_admin_all erlauben Admins ihres Vereins das Schreiben.
-- Zugleich Fix: `WHERE id = p_balance_id` war mehrdeutig (Rückgabespalte `id`),
-- die Funktion brach bei jedem Aufruf ab — Gruppenwechsel mit Gutschrift/Belastung
-- scheiterte dadurch immer.
CREATE OR REPLACE FUNCTION public.add_balance_entry_atomic(
  p_balance_id uuid,
  p_amount numeric,
  p_reason text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, member_balance_id uuid, amount numeric, reason text, reference_type text,
              reference_id uuid, created_by uuid, created_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO member_balance_entries AS e (
    member_balance_id, amount, reason, reference_type, reference_id, created_by
  ) VALUES (
    p_balance_id, p_amount, p_reason, p_reference_type, p_reference_id, p_created_by
  )
  RETURNING e.id, e.member_balance_id, e.amount, e.reason, e.reference_type, e.reference_id,
            e.created_by, e.created_at;

  UPDATE member_balances AS mb
  SET balance = mb.balance + p_amount,
      updated_at = now()
  WHERE mb.id = p_balance_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_balance_entry_atomic(uuid, numeric, text, text, uuid, uuid)
  FROM PUBLIC, anon;

-- /api/trial-trainings/stats (getUserDb): zählt nur, was der Aufrufer sehen darf.
ALTER FUNCTION public.get_trial_training_stats(uuid, date, date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.get_trial_training_stats(uuid, date, date) FROM PUBLIC, anon;

-- 3. Prüft selbst, braucht aber keinen anonymen Zugriff ------------------------
REVOKE ALL ON FUNCTION public.generate_season_invoices_atomic(uuid, uuid, jsonb)
  FROM PUBLIC, anon;
