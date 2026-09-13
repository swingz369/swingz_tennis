-- Abrechnung (Mitglieder, Saison): Autorisierungs-Check in der Atomic-RPC
-- nachgetragen.
--
-- Fund bei der ADR-005-Migration (Domäne Abrechnung, Teil 2, Abrechnungslauf):
-- public.generate_season_invoices_atomic() ist SECURITY DEFINER und an die
-- Rolle "authenticated" gegrantet (siehe proacl), prüfte aber an keiner
-- Stelle, ob der Aufrufer überhaupt Admin des übergebenen p_club_id ist. Der
-- App-Layer (SeasonBillingService, alle drei Routes) prüfte zwar korrekt vor
-- dem RPC-Aufruf, aber die Funktion selbst war über
-- POST /rest/v1/rpc/generate_season_invoices_atomic direkt erreichbar — jeder
-- angemeldete Nutzer hätte mit beliebiger p_club_id/p_season_id echte
-- Entwurfs-Rechnungen für fremde Vereine anlegen können, unabhängig von der
-- App. Das ist exakt die RLS-Bug-Klasse, die ADR-005 durchgängig beheben
-- soll — hier eben nicht als RLS-Policy, weil SECURITY DEFINER die Row-Level-
-- Security ohnehin umgeht, sondern als expliziter Check am Funktionsanfang.
--
-- CREATE OR REPLACE ersetzt die Funktion aus der Baseline
-- (00000000000000_baseline_2026-08-16.sql) — Körper unverändert bis auf die
-- neue Prüfung ganz oben.

CREATE OR REPLACE FUNCTION public.generate_season_invoices_atomic(
  p_season_id uuid,
  p_club_id uuid,
  p_invoices jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice          jsonb;
  v_item             jsonb;
  v_member_id        text;
  v_due_date         text;
  v_notes            text;
  v_items_json       jsonb;
  v_invoice_id       uuid;
  v_invoice_number   text;
  v_subtotal         numeric(10, 2);
  v_tax_amount       numeric(10, 2);
  v_total_amount     numeric(10, 2);
  v_existing_count   int;
  v_seq              int;
  v_prefix           text;
  v_year             int;
  v_created          jsonb := '[]'::jsonb;
  v_skipped          jsonb := '[]'::jsonb;
  v_failed           jsonb := '[]'::jsonb;
BEGIN
  -- Autorisierung: nur Admin/Superadmin des übergebenen Clubs darf für ihn
  -- Rechnungen anlegen. SECURITY DEFINER umgeht RLS auf invoices/invoice_items
  -- vollständig — ohne diesen Check wäre die Funktion für jeden
  -- authentifizierten Nutzer ein offener Schreibzugriff auf fremde Vereine.
  IF NOT public.is_club_admin(p_club_id) THEN
    RAISE EXCEPTION 'not authorized for club %', p_club_id USING ERRCODE = '42501';
  END IF;

  -- Guard against empty / malformed input
  IF p_invoices IS NULL OR jsonb_typeof(p_invoices) <> 'array' THEN
    RAISE EXCEPTION 'p_invoices must be a JSON array';
  END IF;

  -- Iterate over each pre-computed member invoice.
  -- Each iteration is wrapped in an inner BEGIN/EXCEPTION block, which
  -- creates a savepoint in PL/pgSQL — a single member failure rolls back
  -- only that member's writes, not the whole batch.
  FOR v_invoice IN SELECT * FROM jsonb_array_elements(p_invoices)
  LOOP
    v_member_id  := v_invoice ->> 'member_id';
    v_due_date   := v_invoice ->> 'due_date';
    v_notes      := v_invoice ->> 'notes';
    v_items_json := v_invoice -> 'items';

    IF v_member_id IS NULL OR v_member_id = '' THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'member_id', NULL, 'error', 'missing member_id'
      ));
      CONTINUE;
    END IF;

    BEGIN
      -- Idempotency: skip members who already have a season invoice
      -- for this (club_id, season_id) combination.
      SELECT COUNT(*) INTO v_existing_count
      FROM public.invoices
      WHERE club_id = p_club_id
        AND season_id = p_season_id
        AND member_id = v_member_id::uuid
        AND invoice_type = 'season';

      IF v_existing_count > 0 THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'member_id', v_member_id
        ));
        CONTINUE;
      END IF;

      -- Generate invoice number (use existing sequence RPC if available)
      BEGIN
        SELECT public.next_invoice_sequence(p_club_id := p_club_id) INTO v_seq;
      EXCEPTION WHEN OTHERS THEN
        v_seq := NULL;
      END;

      v_prefix := UPPER(LEFT(COALESCE(p_club_id::text, 'UNKNOWN'), 8));
      v_year   := EXTRACT(YEAR FROM NOW())::int;

      IF v_seq IS NOT NULL THEN
        v_invoice_number := 'INV-' || v_prefix || '-' || v_year::text || '-' ||
                            LPAD(v_seq::text, 5, '0');
      ELSE
        -- Fallback: timestamp (base-36) + 3-digit random — collision-safe
        -- for the rare case the sequence RPC is not deployed yet.
        v_invoice_number := 'INV-' || v_prefix || '-' || v_year::text || '-' ||
                            UPPER(TO_HEX(EXTRACT(EPOCH FROM NOW())::bigint)) ||
                            LPAD((FLOOR(RANDOM() * 1000))::int::text, 3, '0');
      END IF;

      -- Compute totals from line items
      SELECT
        COALESCE(SUM(
          (item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric
        ), 0),
        COALESCE(SUM(
          (item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric *
          COALESCE((item ->> 'tax_rate')::numeric, 0) / 100
        ), 0)
      INTO v_subtotal, v_tax_amount
      FROM jsonb_array_elements(v_items_json) AS item;

      v_total_amount := v_subtotal + v_tax_amount;

      -- Insert parent invoice
      INSERT INTO public.invoices (
        club_id, member_id, season_id, invoice_type,
        invoice_number, amount, subtotal, tax_amount,
        due_date, status, currency, notes
      ) VALUES (
        p_club_id, v_member_id::uuid, p_season_id, 'season',
        v_invoice_number, v_total_amount, v_subtotal, v_tax_amount,
        v_due_date::date, 'draft', 'EUR', v_notes
      )
      RETURNING id INTO v_invoice_id;

      -- Insert all line items for this invoice
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_json)
      LOOP
        INSERT INTO public.invoice_items (
          invoice_id, description, quantity, unit_price,
          tax_rate, item_type
        ) VALUES (
          v_invoice_id,
          v_item ->> 'description',
          COALESCE((v_item ->> 'quantity')::numeric, 1),
          (v_item ->> 'unit_price')::numeric,
          COALESCE((v_item ->> 'tax_rate')::numeric, 0),
          COALESCE(v_item ->> 'item_type', 'other')
        );
      END LOOP;

      v_created := v_created || jsonb_build_array(jsonb_build_object(
        'member_id',       v_member_id,
        'invoice_id',      v_invoice_id,
        'invoice_number',  v_invoice_number,
        'total_amount',    v_total_amount
      ));
    EXCEPTION WHEN OTHERS THEN
      -- Per-member savepoint rolls back only this iteration's writes
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'member_id', v_member_id,
        'error',     SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created,
    'skipped', v_skipped,
    'failed',  v_failed
  );
END;
$function$;
