-- Baseline: Abbild des Produktions-Schemas vom 16.08.2026 (supabase db dump).
-- Ersetzt 177 Einzelmigrationen, die eine leere DB nie aufbauen konnten — die
-- erste von ihnen setzte bereits Tabellen voraus, die keine Migration anlegt.
-- Die Altdateien liegen unverändert in archive/ (Historie, siehe AGENTS.md).
-- Auf Produktion als 'baselined' markiert, dort läuft dieses DDL nicht.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."catering_status" AS ENUM (
    'not_planned',
    'planned',
    'ready'
);


ALTER TYPE "public"."catering_status" OWNER TO "postgres";


CREATE TYPE "public"."decision_change_action" AS ENUM (
    'created',
    'updated',
    'status_changed',
    'finalized',
    'cancelled',
    'invitation_sent',
    'invitation_response',
    'vote_cast'
);


ALTER TYPE "public"."decision_change_action" OWNER TO "postgres";


CREATE TYPE "public"."decision_outcome" AS ENUM (
    'approved',
    'rejected',
    'deferred',
    'withdrawn'
);


ALTER TYPE "public"."decision_outcome" OWNER TO "postgres";


CREATE TYPE "public"."decision_status" AS ENUM (
    'draft',
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."decision_status" OWNER TO "postgres";


CREATE TYPE "public"."decision_type" AS ENUM (
    'vorstandsbeschluss',
    'mitgliederversammlung',
    'ausschuss',
    'sonderbeschluss'
);


ALTER TYPE "public"."decision_type" OWNER TO "postgres";


CREATE TYPE "public"."invitation_status" AS ENUM (
    'pending',
    'accepted',
    'declined',
    'tentative'
);


ALTER TYPE "public"."invitation_status" OWNER TO "postgres";


CREATE TYPE "public"."match_outcome" AS ENUM (
    'home_won',
    'away_won',
    'not_played',
    'walkover'
);


ALTER TYPE "public"."match_outcome" OWNER TO "postgres";


CREATE TYPE "public"."match_position_type" AS ENUM (
    'singles',
    'doubles'
);


ALTER TYPE "public"."match_position_type" OWNER TO "postgres";


CREATE TYPE "public"."special_event_status" AS ENUM (
    'draft',
    'open',
    'full',
    'cancelled',
    'completed'
);


ALTER TYPE "public"."special_event_status" OWNER TO "postgres";


CREATE TYPE "public"."special_event_type" AS ENUM (
    'sommercamp',
    'intensivkurs',
    'schnupperkurs',
    'turnier',
    'social',
    'sonstiges'
);


ALTER TYPE "public"."special_event_type" OWNER TO "postgres";


CREATE TYPE "public"."vote_choice" AS ENUM (
    'for',
    'against',
    'abstain'
);


ALTER TYPE "public"."vote_choice" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_balance_entry_atomic"("p_balance_id" "uuid", "p_amount" numeric, "p_reason" "text", "p_reference_type" "text" DEFAULT NULL::"text", "p_reference_id" "uuid" DEFAULT NULL::"uuid", "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "member_balance_id" "uuid", "amount" numeric, "reason" "text", "reference_type" "text", "reference_id" "uuid", "created_by" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert entry
  INSERT INTO member_balance_entries (
    member_balance_id, amount, reason, reference_type, reference_id, created_by
  ) VALUES (
    p_balance_id, p_amount, p_reason, p_reference_type, p_reference_id, p_created_by
  )
  RETURNING
    member_balance_entries.id,
    member_balance_entries.member_balance_id,
    member_balance_entries.amount,
    member_balance_entries.reason,
    member_balance_entries.reference_type,
    member_balance_entries.reference_id,
    member_balance_entries.created_by,
    member_balance_entries.created_at
  INTO
    add_balance_entry_atomic.id,
    add_balance_entry_atomic.member_balance_id,
    add_balance_entry_atomic.amount,
    add_balance_entry_atomic.reason,
    add_balance_entry_atomic.reference_type,
    add_balance_entry_atomic.reference_id,
    add_balance_entry_atomic.created_by,
    add_balance_entry_atomic.created_at;

  -- Atomically update balance
  UPDATE member_balances
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = p_balance_id;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."add_balance_entry_atomic"("p_balance_id" "uuid", "p_amount" numeric, "p_reason" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_finance_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."audit_finance_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."audit_finance_change"() IS 'Schreibt jede Änderung an invoices/payments/sepa_mandates nach audit_logs (GoBD).';



CREATE OR REPLACE FUNCTION "public"."calculate_dunning_level"("p_invoice_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_due_date date;
  v_days_overdue integer;
BEGIN
  SELECT due_date INTO v_due_date
  FROM invoices
  WHERE id = p_invoice_id;

  IF v_due_date IS NULL THEN
    RETURN 0;
  END IF;

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
$$;


ALTER FUNCTION "public"."calculate_dunning_level"("p_invoice_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_dunning_level"("p_invoice_id" "uuid") IS 'Returns recommended dunning level (0-3) based on days overdue. Level 1=14d, 2=28d, 3=42d.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."fee_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "name" character varying(200) NOT NULL,
    "description" "text",
    "type" character varying(20) NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'EUR'::character varying NOT NULL,
    "billing_cycle" character varying(20) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "valid_from" "date",
    "valid_until" "date",
    "conditions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "billing_unit_count" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "fee_configurations_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "fee_configurations_billing_cycle_check" CHECK ((("billing_cycle")::"text" = ANY (ARRAY[('monthly'::character varying)::"text", ('quarterly'::character varying)::"text", ('yearly'::character varying)::"text", ('one_time'::character varying)::"text"]))),
    CONSTRAINT "fee_configurations_type_check" CHECK ((("type")::"text" = ANY (ARRAY[('membership'::character varying)::"text", ('training'::character varying)::"text", ('court'::character varying)::"text", ('other'::character varying)::"text"]))),
    CONSTRAINT "valid_currency_code" CHECK (("length"(("currency")::"text") = 3)),
    CONSTRAINT "valid_date_range" CHECK ((("valid_from" IS NULL) OR ("valid_until" IS NULL) OR ("valid_from" <= "valid_until")))
);

ALTER TABLE ONLY "public"."fee_configurations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."fee_configurations" OWNER TO "postgres";


COMMENT ON TABLE "public"."fee_configurations" IS 'RLS policies updated: club_members → is_club_admin()/is_club_trainer()/is_club_member() helper functions (20260625)';



COMMENT ON COLUMN "public"."fee_configurations"."type" IS 'Fee type: membership, training, court, or other';



COMMENT ON COLUMN "public"."fee_configurations"."billing_cycle" IS 'Billing frequency: monthly, quarterly, yearly, or one_time';



COMMENT ON COLUMN "public"."fee_configurations"."valid_from" IS 'Start date for this fee configuration';



COMMENT ON COLUMN "public"."fee_configurations"."valid_until" IS 'End date for this fee configuration (NULL = no expiry)';



COMMENT ON COLUMN "public"."fee_configurations"."conditions" IS 'JSONB rules for conditional pricing (age, member type, training group)';



CREATE OR REPLACE FUNCTION "public"."calculate_member_fees"("p_club_id" "uuid", "p_member_age" integer, "p_member_type" character varying, "p_training_group" character varying DEFAULT NULL::character varying) RETURNS SETOF "public"."fee_configurations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT fc.*
  FROM fee_configurations fc
  WHERE fc.club_id = p_club_id
    AND fc.is_active = true
    AND (fc.valid_from IS NULL OR fc.valid_from <= CURRENT_DATE)
    AND (fc.valid_until IS NULL OR fc.valid_until >= CURRENT_DATE)
    -- Check conditions
    AND (
      fc.conditions = '{}'::jsonb OR (
        (fc.conditions->>'minAge' IS NULL OR (fc.conditions->>'minAge')::INTEGER <= p_member_age) AND
        (fc.conditions->>'maxAge' IS NULL OR (fc.conditions->>'maxAge')::INTEGER >= p_member_age) AND
        (fc.conditions->'memberType' IS NULL OR fc.conditions->'memberType' @> to_jsonb(p_member_type)) AND
        (p_training_group IS NULL OR fc.conditions->'trainingGroup' IS NULL OR fc.conditions->'trainingGroup' @> to_jsonb(p_training_group))
      )
    );
END;
$$;


ALTER FUNCTION "public"."calculate_member_fees"("p_club_id" "uuid", "p_member_age" integer, "p_member_type" character varying, "p_training_group" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_member_fees"("p_club_id" "uuid", "p_member_age" integer, "p_member_type" character varying, "p_training_group" character varying) IS 'Calculate applicable fees for a member based on conditions';



CREATE OR REPLACE FUNCTION "public"."calculate_payment_fee"("p_payment_settings_id" "uuid", "p_amount" numeric) RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_fees JSONB;
  v_fixed_fee NUMERIC;
  v_percentage_fee NUMERIC;
  v_total_fee NUMERIC;
BEGIN
  -- Get fees from payment settings
  SELECT fees INTO v_fees
  FROM payment_settings
  WHERE id = p_payment_settings_id;
  
  IF v_fees IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate fixed fee
  v_fixed_fee := COALESCE((v_fees->>'fixed')::NUMERIC, 0);
  
  -- Calculate percentage fee
  v_percentage_fee := COALESCE((v_fees->>'percentage')::NUMERIC, 0);
  v_percentage_fee := p_amount * (v_percentage_fee / 100);
  
  -- Total fee
  v_total_fee := v_fixed_fee + v_percentage_fee;
  
  RETURN ROUND(v_total_fee, 2);
END;
$$;


ALTER FUNCTION "public"."calculate_payment_fee"("p_payment_settings_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_payment_fee"("p_payment_settings_id" "uuid", "p_amount" numeric) IS 'Calculate total payment processing fee for a given amount';



CREATE OR REPLACE FUNCTION "public"."calculate_season_weeks"("season_start" "date", "season_end" "date") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN CEIL(EXTRACT(EPOCH FROM (season_end - season_start)) / (7 * 24 * 60 * 60))::integer;
END;
$$;


ALTER FUNCTION "public"."calculate_season_weeks"("season_start" "date", "season_end" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_record_stripe_event"("p_event_id" "text", "p_event_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_already_exists boolean;
BEGIN
  -- Try to insert; if duplicate, the ON CONFLICT clause handles it
  INSERT INTO stripe_events (stripe_event_id, event_type)
  VALUES (p_event_id, p_event_type)
  ON CONFLICT (stripe_event_id) DO NOTHING;

  -- Check whether the row was newly inserted or already existed
  GET DIAGNOSTICS v_already_exists = ROW_COUNT;
  RETURN v_already_exists > 0;
END;
$$;


ALTER FUNCTION "public"."check_and_record_stripe_event"("p_event_id" "text", "p_event_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_availability_overlap"("p_trainer_id" "uuid", "p_date" timestamp with time zone, "p_start_time" character varying, "p_end_time" character varying, "p_exclude_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "start_time" character varying, "end_time" character varying, "status" character varying)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ta.id,
        ta.start_time,
        ta.end_time,
        ta.status
    FROM trainer_availabilities ta
    WHERE ta.trainer_id = p_trainer_id
      AND ta.date = p_date
      AND (p_exclude_id IS NULL OR ta.id != p_exclude_id)
      AND (
        -- Overlap detection: new slot overlaps with existing
        (p_start_time >= ta.start_time AND p_start_time < ta.end_time) OR
        (p_end_time > ta.start_time AND p_end_time <= ta.end_time) OR
        (p_start_time <= ta.start_time AND p_end_time >= ta.end_time)
      );
END;
$$;


ALTER FUNCTION "public"."check_availability_overlap"("p_trainer_id" "uuid", "p_date" timestamp with time zone, "p_start_time" character varying, "p_end_time" character varying, "p_exclude_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_availability_overlap"("p_trainer_id" "uuid", "p_date" timestamp with time zone, "p_start_time" character varying, "p_end_time" character varying, "p_exclude_id" "uuid") IS 'Detect time slot conflicts for a trainer on a specific date';



CREATE OR REPLACE FUNCTION "public"."check_booking_overlap"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_session_end timestamptz;
  v_conflict_count int;
BEGIN
  -- Only check confirmed and pending bookings
  IF NEW.status NOT IN ('confirmed', 'pending') THEN
    RETURN NEW;
  END IF;

  -- Get the session end time
  SELECT timeslot_end::timestamptz INTO v_session_end
  FROM sessions WHERE id = NEW.session_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Check for overlapping confirmed/pending bookings on the same court
  -- Exclude the current booking (for UPDATEs) and all bookings that belong to
  -- the same session (participants of one training share the court by design).
  SELECT COUNT(*) INTO v_conflict_count
  FROM bookings b
  JOIN sessions s ON s.id = b.session_id
  WHERE b.court_id = NEW.court_id
    AND b.id != NEW.id
    AND b.session_id IS DISTINCT FROM NEW.session_id
    AND b.status IN ('confirmed', 'pending')
    AND b.session_start_time < v_session_end
    AND s.timeslot_end::timestamptz > NEW.session_start_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Booking overlaps with % existing booking(s) on this court', v_conflict_count;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_booking_overlap"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_background_job"("p_job_name" "text", "p_job_type" "text", "p_payload" "jsonb", "p_stale_after" interval DEFAULT '00:15:00'::interval) RETURNS TABLE("id" "uuid", "retry_count" integer, "max_retries" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  INSERT INTO background_jobs (job_name, job_type, status, payload, started_at)
  VALUES (p_job_name, p_job_type, 'running', p_payload, NOW())
  ON CONFLICT (job_name) DO UPDATE
    SET status = 'running',
        payload = EXCLUDED.payload,
        started_at = NOW()
    WHERE background_jobs.status != 'running'
       OR background_jobs.started_at < NOW() - p_stale_after
  RETURNING background_jobs.id, background_jobs.retry_count, background_jobs.max_retries;
END;
$$;


ALTER FUNCTION "public"."claim_background_job"("p_job_name" "text", "p_job_type" "text", "p_payload" "jsonb", "p_stale_after" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_background_job"("p_job_name" "text", "p_job_type" "text", "p_payload" "jsonb", "p_stale_after" interval) IS 'Atomically claims a recurring job by name; returns no rows if another run already holds the lock and is not stale.';



CREATE OR REPLACE FUNCTION "public"."complete_job"("p_job_id" "uuid", "p_result" "jsonb" DEFAULT '{}'::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_started_at TIMESTAMPTZ;
BEGIN
  SELECT started_at INTO v_started_at FROM background_jobs WHERE id = p_job_id;
  UPDATE background_jobs SET status = 'completed', completed_at = NOW(), result = p_result, updated_at = NOW() WHERE id = p_job_id;
  INSERT INTO job_execution_log (job_id, execution_started_at, execution_completed_at, execution_duration_ms, success, result)
  VALUES (p_job_id, v_started_at, NOW(), EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000, TRUE, p_result);
  RETURN FOUND;
END; $$;


ALTER FUNCTION "public"."complete_job"("p_job_id" "uuid", "p_result" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."complete_job"("p_job_id" "uuid", "p_result" "jsonb") IS 'Mark job as completed with result';



CREATE OR REPLACE FUNCTION "public"."create_booking_safe"("p_member_id" "uuid", "p_session_id" "uuid", "p_club_id" "uuid", "p_schedule_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_booking_id uuid;
  v_current_count int;
  v_max_participants int;
  v_session_start timestamptz;
BEGIN
  -- Lock session row for update to prevent race conditions
  SELECT max_participants, timeslot_start 
  INTO v_max_participants, v_session_start
  FROM sessions 
  WHERE id = p_session_id 
  FOR UPDATE;
  
  -- Check if session exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;
  
  -- Check if session is in the future
  IF v_session_start < NOW() THEN
    RAISE EXCEPTION 'Cannot book past sessions';
  END IF;
  
  -- Count current active bookings
  SELECT COUNT(*) INTO v_current_count
  FROM bookings 
  WHERE session_id = p_session_id 
    AND status IN ('confirmed', 'pending');
  
  -- Check if session is full
  IF v_current_count >= v_max_participants THEN
    RAISE EXCEPTION 'Session is full (% / %)', v_current_count, v_max_participants;
  END IF;
  
  -- Check for existing booking (this will be caught by unique constraint too)
  IF EXISTS (
    SELECT 1 FROM bookings 
    WHERE member_id = p_member_id 
      AND session_id = p_session_id
      AND status NOT IN ('cancelled')
  ) THEN
    RAISE EXCEPTION 'Member already has an active booking for this session';
  END IF;
  
  -- Create booking
  INSERT INTO bookings (
    member_id, 
    session_id, 
    club_id, 
    schedule_id, 
    status,
    booked_at
  )
  VALUES (
    p_member_id, 
    p_session_id, 
    p_club_id, 
    p_schedule_id, 
    'pending',
    NOW()
  )
  RETURNING id INTO v_booking_id;
  
  RETURN v_booking_id;
END;
$$;


ALTER FUNCTION "public"."create_booking_safe"("p_member_id" "uuid", "p_session_id" "uuid", "p_club_id" "uuid", "p_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invoice_with_items"("p_invoice" "jsonb", "p_items" "jsonb"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_invoice_id uuid;
  v_item jsonb;
  v_subtotal numeric := 0;
  v_tax_amount numeric := 0;
  v_total_amount numeric := 0;
BEGIN
  -- Insert invoice
  INSERT INTO invoices (
    club_id,
    member_id,
    due_date,
    notes,
    status,
    created_at
  )
  VALUES (
    (p_invoice->>'club_id')::uuid,
    (p_invoice->>'member_id')::uuid,
    (p_invoice->>'due_date')::timestamptz,
    p_invoice->>'notes',
    COALESCE(p_invoice->>'status', 'draft'),
    NOW()
  )
  RETURNING id INTO v_invoice_id;
  
  -- Insert items and calculate totals
  FOREACH v_item IN ARRAY p_items
  LOOP
    INSERT INTO invoice_items (
      invoice_id,
      description,
      quantity,
      unit_price,
      tax_rate
    )
    VALUES (
      v_invoice_id,
      v_item->>'description',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'tax_rate')::numeric, 19.0)
    );
    
    -- Calculate item total
    v_subtotal := v_subtotal + (
      (v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric
    );
    
    v_tax_amount := v_tax_amount + (
      (v_item->>'quantity')::integer * 
      (v_item->>'unit_price')::numeric * 
      COALESCE((v_item->>'tax_rate')::numeric, 19.0) / 100
    );
  END LOOP;
  
  v_total_amount := v_subtotal + v_tax_amount;
  
  -- Update invoice totals
  UPDATE invoices 
  SET 
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_total_amount
  WHERE id = v_invoice_id;
  
  RETURN v_invoice_id;
END;
$$;


ALTER FUNCTION "public"."create_invoice_with_items"("p_invoice" "jsonb", "p_items" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decision_changes_validate_actor"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_club_id UUID;
BEGIN
  SELECT d.club_id INTO v_club_id
  FROM public.board_decisions d
  WHERE d.id = NEW.decision_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'decision_changes: Beschluss % existiert nicht', NEW.decision_id;
  END IF;

  -- Wenn actor_id NULL → System-/Cron-/anonymisierte Aktion → erlaubt.
  IF NEW.actor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.user_club_memberships m
    WHERE m.user_id = NEW.actor_id
      AND m.club_id = v_club_id
      AND m.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'decision_changes: actor_id % ist kein aktives Mitglied von Club %',
      NEW.actor_id, v_club_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."decision_changes_validate_actor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_job"("p_job_name" "text", "p_job_type" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_schedule_expression" "text" DEFAULT NULL::"text", "p_scheduled_at" timestamp with time zone DEFAULT "now"(), "p_priority" integer DEFAULT 5) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_job_id UUID;
BEGIN
  INSERT INTO background_jobs (job_name, job_type, payload, schedule_expression, scheduled_at, priority, status)
  VALUES (p_job_name, p_job_type, p_payload, p_schedule_expression, p_scheduled_at, p_priority, 'pending')
  RETURNING id INTO v_job_id;
  RETURN v_job_id;
END; $$;


ALTER FUNCTION "public"."enqueue_job"("p_job_name" "text", "p_job_type" "text", "p_payload" "jsonb", "p_schedule_expression" "text", "p_scheduled_at" timestamp with time zone, "p_priority" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enqueue_job"("p_job_name" "text", "p_job_type" "text", "p_payload" "jsonb", "p_schedule_expression" "text", "p_scheduled_at" timestamp with time zone, "p_priority" integer) IS 'Enqueue a new background job';



CREATE OR REPLACE FUNCTION "public"."ensure_single_default_payment_setting"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If setting new default to true, unset all other defaults for this club
  IF NEW.is_default = true THEN
    UPDATE payment_settings
    SET is_default = false
    WHERE club_id = NEW.club_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_payment_setting"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fail_job"("p_job_id" "uuid", "p_error_message" "text", "p_stack_trace" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_started_at TIMESTAMPTZ; v_retry_count INTEGER; v_max_retries INTEGER;
BEGIN
  SELECT started_at, retry_count, max_retries INTO v_started_at, v_retry_count, v_max_retries FROM background_jobs WHERE id = p_job_id;
  IF v_retry_count < v_max_retries THEN
    UPDATE background_jobs SET status = 'pending', retry_count = retry_count + 1, scheduled_at = NOW() + INTERVAL '5 minutes', updated_at = NOW() WHERE id = p_job_id;
  ELSE
    UPDATE background_jobs SET status = 'failed', completed_at = NOW(), error_message = p_error_message, updated_at = NOW() WHERE id = p_job_id;
  END IF;
  INSERT INTO job_execution_log (job_id, execution_started_at, execution_completed_at, execution_duration_ms, success, error_message, stack_trace)
  VALUES (p_job_id, v_started_at, NOW(), EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000, FALSE, p_error_message, p_stack_trace);
  RETURN FOUND;
END; $$;


ALTER FUNCTION "public"."fail_job"("p_job_id" "uuid", "p_error_message" "text", "p_stack_trace" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fail_job"("p_job_id" "uuid", "p_error_message" "text", "p_stack_trace" "text") IS 'Mark job as failed with error, retry if possible';



CREATE OR REPLACE FUNCTION "public"."generate_invoice_number"("p_club_id" "uuid") RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_invoice_number"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_season_invoices_atomic"("p_season_id" "uuid", "p_club_id" "uuid", "p_invoices" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_season_invoices_atomic"("p_season_id" "uuid", "p_club_id" "uuid", "p_invoices" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_season_invoices_atomic"("p_season_id" "uuid", "p_club_id" "uuid", "p_invoices" "jsonb") IS 'Atomic batch creation of season invoices + line items. Per-member savepoints isolate failures so a single bad member does not roll back the whole batch. Idempotent: skips members who already have a season invoice for (club, season). Returns JSONB: { created: [...], skipped: [...], failed: [...] }';



CREATE OR REPLACE FUNCTION "public"."generate_slug"("p_title" "text", "p_club_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_slug text;
  v_counter integer := 0;
  v_final_slug text;
BEGIN
  -- Convert to lowercase and replace spaces with hyphens
  v_slug := lower(regexp_replace(p_title, '[^a-zA-Z0-9äöüÄÖÜß ]+', '', 'g'));
  v_slug := regexp_replace(v_slug, '\s+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  
  -- Ensure uniqueness
  v_final_slug := v_slug;
  WHILE EXISTS (SELECT 1 FROM news_posts WHERE slug = v_final_slug) LOOP
    v_counter := v_counter + 1;
    v_final_slug := v_slug || '-' || v_counter;
  END LOOP;
  
  RETURN v_final_slug;
END;
$$;


ALTER FUNCTION "public"."generate_slug"("p_title" "text", "p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_weekly_club_reports"("week_ago" timestamp with time zone) RETURNS TABLE("club_id" "uuid", "club_name" "text", "total_members" bigint, "new_members_week" bigint, "sessions_week" bigint, "rsvps_week" bigint, "trial_requests_week" bigint, "pending_approvals" bigint, "open_invoices" bigint, "overdue_total" numeric)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS club_id,
    c.name::TEXT AS club_name,
    COALESCE(cm.total_members, 0)::BIGINT,
    COALESCE(cm.new_members_week, 0)::BIGINT,
    COALESCE(cs.sessions_week, 0)::BIGINT,
    COALESCE(cr.rsvps_week, 0)::BIGINT,
    COALESCE(ct.trial_requests_week, 0)::BIGINT,
    COALESCE(ct.pending_approvals, 0)::BIGINT,
    COALESCE(ci.open_invoices, 0)::BIGINT,
    COALESCE(ci.overdue_total, 0)::NUMERIC
  FROM clubs c
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE m.is_active = true) AS total_members,
      COUNT(*) FILTER (WHERE m.created_at >= week_ago) AS new_members_week
    FROM user_club_memberships m
    WHERE m.club_id = c.id AND m.role = 'member'
  ) cm ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS sessions_week
    FROM sessions s
    JOIN schedules sch ON sch.id = s.schedule_id
    WHERE sch.club_id = c.id AND s.created_at >= week_ago
  ) cs ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS rsvps_week
    FROM session_rsvps r
    WHERE r.club_id = c.id AND r.created_at >= week_ago
  ) cr ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE t.created_at >= week_ago) AS trial_requests_week,
      COUNT(*) FILTER (WHERE t.status = 'requested') AS pending_approvals
    FROM trial_trainings t
    WHERE t.club_id = c.id
  ) ct ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE i.status IN ('open', 'sent', 'overdue')) AS open_invoices,
      COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'overdue'), 0) AS overdue_total
    FROM invoices i
    WHERE i.club_id = c.id
  ) ci ON true
  WHERE c.status = 'active'
  ORDER BY c.name;
END;
$$;


ALTER FUNCTION "public"."generate_weekly_club_reports"("week_ago" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_weekly_club_reports"("week_ago" timestamp with time zone) IS 'Aggregates weekly club activity metrics for the generate-reports edge function. Uses LATERAL joins for efficient per-club aggregation.';



CREATE TABLE IF NOT EXISTS "public"."hourly_rate_tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "base_rate" numeric(10,2) NOT NULL,
    "training_types" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "experience_level" character varying(20) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hourly_rate_tiers_base_rate_positive" CHECK (("base_rate" > (0)::numeric)),
    CONSTRAINT "hourly_rate_tiers_experience_level_check" CHECK ((("experience_level")::"text" = ANY (ARRAY[('beginner'::character varying)::"text", ('intermediate'::character varying)::"text", ('advanced'::character varying)::"text", ('professional'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."hourly_rate_tiers" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."hourly_rate_tiers" OWNER TO "postgres";


COMMENT ON TABLE "public"."hourly_rate_tiers" IS 'Base hourly rate tiers for different training types and experience levels';



CREATE OR REPLACE FUNCTION "public"."get_active_rate_tiers"("p_club_id" "uuid") RETURNS SETOF "public"."hourly_rate_tiers"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT *
  FROM public.hourly_rate_tiers
  WHERE club_id = p_club_id
    AND is_active = true
  ORDER BY experience_level, name;
$$;


ALTER FUNCTION "public"."get_active_rate_tiers"("p_club_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sepa_mandates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "member_id" "uuid" NOT NULL,
    "account_holder" character varying(200) NOT NULL,
    "iban" character varying(34) NOT NULL,
    "bic" character varying(11) NOT NULL,
    "bank_name" character varying(200) NOT NULL,
    "address" "jsonb" NOT NULL,
    "mandate_reference" character varying(50) NOT NULL,
    "creditor_id" character varying(35) DEFAULT 'DE98ZZZ00000000000'::character varying NOT NULL,
    "signature_date" "date" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoke_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sepa_mandates_bic_length" CHECK ((("length"(("bic")::"text") >= 8) AND ("length"(("bic")::"text") <= 11))),
    CONSTRAINT "sepa_mandates_iban_length" CHECK ((("length"(("iban")::"text") >= 15) AND ("length"(("iban")::"text") <= 34))),
    CONSTRAINT "sepa_mandates_revoked_consistency" CHECK (((("is_active" = false) AND ("revoked_at" IS NOT NULL)) OR (("is_active" = true) AND ("revoked_at" IS NULL))))
);

ALTER TABLE ONLY "public"."sepa_mandates" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."sepa_mandates" OWNER TO "postgres";


COMMENT ON TABLE "public"."sepa_mandates" IS 'SEPA direct debit mandates for automated member payments';



COMMENT ON COLUMN "public"."sepa_mandates"."address" IS 'JSONB object containing street, houseNumber, postalCode, city';



COMMENT ON COLUMN "public"."sepa_mandates"."mandate_reference" IS 'Unique mandate reference number (e.g., M-1234567890)';



COMMENT ON COLUMN "public"."sepa_mandates"."creditor_id" IS 'Club creditor ID for SEPA transactions';



COMMENT ON COLUMN "public"."sepa_mandates"."is_active" IS 'Whether the mandate is currently active';



COMMENT ON COLUMN "public"."sepa_mandates"."revoked_at" IS 'Timestamp when the mandate was revoked (NULL if active)';



CREATE OR REPLACE FUNCTION "public"."get_active_sepa_mandate"("p_member_id" "uuid") RETURNS "public"."sepa_mandates"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT *
  FROM public.sepa_mandates
  WHERE member_id = p_member_id
    AND is_active = true
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_active_sepa_mandate"("p_member_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trainer_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "first_name" character varying(100) NOT NULL,
    "last_name" character varying(100) NOT NULL,
    "email" character varying(255) NOT NULL,
    "phone" character varying(50) NOT NULL,
    "date_of_birth" "date" NOT NULL,
    "bio" "text",
    "profile_image_url" "text",
    "qualifications" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "specializations" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "experience" "jsonb" DEFAULT '{"years": 0, "achievements": [], "previousClubs": []}'::"jsonb" NOT NULL,
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "hourly_rate" numeric(10,2),
    "availability" "jsonb" DEFAULT '{"friday": true, "monday": true, "sunday": false, "tuesday": true, "saturday": false, "thursday": true, "wednesday": true}'::"jsonb" NOT NULL,
    "preferred_time_slots" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "languages" "jsonb" DEFAULT '["Deutsch"]'::"jsonb" NOT NULL,
    "emergency_contact" "jsonb" DEFAULT '{"name": "", "phone": "", "relationship": ""}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "extra_hours_rate" numeric(10,2),
    "contracted_hourly_rate" numeric(10,2),
    CONSTRAINT "trainer_profiles_contracted_hourly_rate_check" CHECK ((("contracted_hourly_rate" IS NULL) OR ("contracted_hourly_rate" >= (0)::numeric))),
    CONSTRAINT "trainer_profiles_extra_hours_rate_check" CHECK ((("extra_hours_rate" IS NULL) OR ("extra_hours_rate" >= (0)::numeric))),
    CONSTRAINT "trainer_profiles_hourly_rate_positive" CHECK ((("hourly_rate" IS NULL) OR ("hourly_rate" > (0)::numeric))),
    CONSTRAINT "trainer_profiles_phone_valid" CHECK (("length"(("phone")::"text") >= 5)),
    CONSTRAINT "trainer_profiles_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('active'::character varying)::"text", ('inactive'::character varying)::"text", ('on_leave'::character varying)::"text", ('terminated'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."trainer_profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."trainer_profiles" IS 'Comprehensive trainer profile information including qualifications, specializations, availability, and emergency contacts';



COMMENT ON COLUMN "public"."trainer_profiles"."extra_hours_rate" IS 'Hourly rate the trainer can freely set for additional hours they offer (e.g. extra sessions beyond the contract). Numeric(10,2), EUR. Editable by the trainer themselves; admin can also write.';



COMMENT ON COLUMN "public"."trainer_profiles"."contracted_hourly_rate" IS 'Contractually agreed hourly rate (admin-only write, read-only for trainer). Numeric(10,2), EUR. NULL = no contract rate set; in that case fall back to hourly_rate.';



CREATE OR REPLACE FUNCTION "public"."get_active_trainers"("p_club_id" "uuid") RETURNS SETOF "public"."trainer_profiles"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT *
  FROM public.trainer_profiles
  WHERE club_id = p_club_id
    AND status = 'active'
  ORDER BY last_name, first_name;
$$;


ALTER FUNCTION "public"."get_active_trainers"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_trainers"("p_club_id" "uuid", "p_datetime" timestamp without time zone) RETURNS TABLE("user_id" "uuid", "full_name" "text", "specialization" "text"[], "hourly_rate" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_day_of_week integer;
  v_time time;
  v_date date;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_datetime)::integer;
  v_time := p_datetime::time;
  v_date := p_datetime::date;
  
  RETURN QUERY
  SELECT DISTINCT
    ta.user_id,
    u.full_name,
    ta.specialization,
    ta.hourly_rate
  FROM trainer_assignments ta
  JOIN users u ON u.id = ta.user_id
  WHERE ta.club_id = p_club_id
    AND ta.is_active = true
    AND EXISTS (
      SELECT 1 FROM trainer_availability tav
      WHERE tav.user_id = ta.user_id
        AND tav.club_id = p_club_id
        AND tav.day_of_week = v_day_of_week
        AND tav.start_time <= v_time
        AND tav.end_time >= v_time
        AND tav.is_available = true
    )
    AND NOT EXISTS (
      SELECT 1 FROM trainer_absences tabs
      WHERE tabs.user_id = ta.user_id
        AND tabs.club_id = p_club_id
        AND tabs.start_date <= v_date
        AND tabs.end_date >= v_date
    );
END;
$$;


ALTER FUNCTION "public"."get_available_trainers"("p_club_id" "uuid", "p_datetime" timestamp without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cron_failures"("hours_back" integer DEFAULT 24) RETURNS TABLE("job_id" bigint, "job_name" "text", "run_time" timestamp with time zone, "error_message" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.jobid AS job_id,
    j.jobname::TEXT AS job_name,
    r.start_time AS run_time,
    r.return_message AS error_message
  FROM cron.job_run_details r
  JOIN cron.job j ON j.jobid = r.jobid
  WHERE r.status = 'failed'
    AND r.start_time > NOW() - (hours_back || ' hours')::INTERVAL
  ORDER BY r.start_time DESC;
END;
$$;


ALTER FUNCTION "public"."get_cron_failures"("hours_back" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_cron_failures"("hours_back" integer) IS 'Returns failed cron job runs within the specified time window for alerting';



CREATE OR REPLACE FUNCTION "public"."get_current_trainer_rate"("p_trainer_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT effective_rate
  FROM public.trainer_hourly_rates
  WHERE trainer_id = p_trainer_id
    AND valid_from <= CURRENT_DATE
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
  ORDER BY valid_from DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_current_trainer_rate"("p_trainer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_trainer_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_email TEXT;
  v_trainer_id UUID;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  SELECT id INTO v_trainer_id FROM trainers 
  WHERE email = v_email OR user_id = auth.uid()
  LIMIT 1;
  RETURN v_trainer_id;
END;
$$;


ALTER FUNCTION "public"."get_my_trainer_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_jobs"("p_limit" integer DEFAULT 10) RETURNS TABLE("job_id" "uuid", "job_name" "text", "job_type" "text", "payload" "jsonb", "priority" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT id, job_name, job_type, payload, priority FROM background_jobs
  WHERE status = 'pending' AND scheduled_at <= NOW()
  ORDER BY priority DESC, scheduled_at ASC LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_pending_jobs"("p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_pending_jobs"("p_limit" integer) IS 'Get pending jobs ordered by priority';



CREATE OR REPLACE FUNCTION "public"."get_session_end_time"("p_session_id" "uuid") RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT timeslot_end::timestamptz FROM sessions WHERE id = p_session_id;
$$;


ALTER FUNCTION "public"."get_session_end_time"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_setting_value"("p_key" character varying, "p_club_id" "uuid" DEFAULT NULL::"uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT value INTO v_value
  FROM system_settings
  WHERE key = p_key
    AND (club_id = p_club_id OR (club_id IS NULL AND p_club_id IS NULL))
  LIMIT 1;
  
  RETURN v_value;
END;
$$;


ALTER FUNCTION "public"."get_setting_value"("p_key" character varying, "p_club_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_setting_value"("p_key" character varying, "p_club_id" "uuid") IS 'Get setting value by key for a club or global';



CREATE OR REPLACE FUNCTION "public"."get_settings_as_object"("p_category" character varying DEFAULT NULL::character varying, "p_club_id" "uuid" DEFAULT NULL::"uuid", "p_public_only" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_object_agg(
    key,
    CASE
      WHEN type = 'number' THEN to_jsonb(value::numeric)
      WHEN type = 'boolean' THEN to_jsonb(value::boolean)
      WHEN type = 'json' OR type = 'array' THEN value::jsonb
      ELSE to_jsonb(value)
    END
  ) INTO v_result
  FROM system_settings
  WHERE (p_category IS NULL OR category = p_category)
    AND (club_id = p_club_id OR (club_id IS NULL AND p_club_id IS NULL))
    AND (p_public_only = false OR is_public = true);
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_settings_as_object"("p_category" character varying, "p_club_id" "uuid", "p_public_only" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_settings_as_object"("p_category" character varying, "p_club_id" "uuid", "p_public_only" boolean) IS 'Get settings as JSONB object with type conversion';



CREATE OR REPLACE FUNCTION "public"."get_trainer_full_name"("p_trainer_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT first_name || ' ' || last_name
  FROM public.trainer_profiles
  WHERE id = p_trainer_id;
$$;


ALTER FUNCTION "public"."get_trainer_full_name"("p_trainer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trial_training_stats"("p_club_id" "uuid", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("total" bigint, "scheduled" bigint, "completed" bigint, "cancelled" bigint, "no_show" bigint, "converted" bigint, "conversion_rate" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total,
    COUNT(*) FILTER (WHERE status = 'scheduled')::BIGINT as scheduled,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed,
    COUNT(*) FILTER (WHERE status = 'cancelled')::BIGINT as cancelled,
    COUNT(*) FILTER (WHERE status = 'no_show')::BIGINT as no_show,
    COUNT(*) FILTER (WHERE status = 'converted')::BIGINT as converted,
    CASE
      WHEN COUNT(*) FILTER (WHERE status = 'completed') > 0
      THEN ROUND(
        (COUNT(*) FILTER (WHERE status = 'converted')::NUMERIC / 
         COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC) * 100,
        2
      )
      ELSE 0
    END as conversion_rate
  FROM trial_trainings
  WHERE club_id = p_club_id
    AND (p_start_date IS NULL OR scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR scheduled_date <= p_end_date);
END;
$$;


ALTER FUNCTION "public"."get_trial_training_stats"("p_club_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_trial_training_stats"("p_club_id" "uuid", "p_start_date" "date", "p_end_date" "date") IS 'Calculate trial training statistics including conversion rate';



CREATE TABLE IF NOT EXISTS "public"."trial_trainings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "participant_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_first_name" character varying(100) NOT NULL,
    "participant_last_name" character varying(100) NOT NULL,
    "participant_email" character varying(255) NOT NULL,
    "participant_phone" character varying(50) NOT NULL,
    "participant_date_of_birth" "date" NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "scheduled_time" character varying(5) NOT NULL,
    "duration" integer NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "trainer_name" character varying(100) NOT NULL,
    "court_id" "uuid" NOT NULL,
    "court_name" character varying(100) NOT NULL,
    "status" character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    "notes" "text",
    "feedback_rating" integer,
    "feedback_comments" "text",
    "feedback_would_recommend" boolean,
    "converted_to_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "marketing_consent" boolean DEFAULT false NOT NULL,
    "marketing_consent_token" "text",
    "marketing_consent_confirmed_at" timestamp with time zone,
    CONSTRAINT "trial_trainings_duration_check" CHECK ((("duration" >= 30) AND ("duration" <= 180))),
    CONSTRAINT "trial_trainings_feedback_rating_check" CHECK ((("feedback_rating" >= 1) AND ("feedback_rating" <= 5))),
    CONSTRAINT "trial_trainings_scheduled_time_check" CHECK ((("scheduled_time")::"text" ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'::"text")),
    CONSTRAINT "trial_trainings_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('requested'::character varying)::"text", ('scheduled'::character varying)::"text", ('completed'::character varying)::"text", ('cancelled'::character varying)::"text", ('no_show'::character varying)::"text", ('converted'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."trial_trainings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trial_trainings" OWNER TO "postgres";


COMMENT ON TABLE "public"."trial_trainings" IS 'RLS policies updated: club_members → is_club_trainer() helper function (20260625)';



COMMENT ON COLUMN "public"."trial_trainings"."status" IS 'Session status: scheduled, completed, cancelled, no_show, or converted';



COMMENT ON COLUMN "public"."trial_trainings"."feedback_rating" IS 'Participant rating (1-5 stars)';



COMMENT ON COLUMN "public"."trial_trainings"."converted_to_member_id" IS 'Member ID if participant converted to full member';



COMMENT ON COLUMN "public"."trial_trainings"."marketing_consent" IS 'Participant opted in to marketing emails during trial-training signup (DOI required before any send)';



COMMENT ON COLUMN "public"."trial_trainings"."marketing_consent_token" IS 'Single-use token for the double opt-in confirmation link; cleared once confirmed';



COMMENT ON COLUMN "public"."trial_trainings"."marketing_consent_confirmed_at" IS 'Set when the participant confirms the DOI link; NULL means no confirmed consent — must not send marketing email';



CREATE OR REPLACE FUNCTION "public"."get_upcoming_trial_trainings"("p_club_id" "uuid", "p_days" integer DEFAULT 7) RETURNS SETOF "public"."trial_trainings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM trial_trainings
  WHERE club_id = p_club_id
    AND status = 'scheduled'
    AND scheduled_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + p_days)
  ORDER BY scheduled_date, scheduled_time;
END;
$$;


ALTER FUNCTION "public"."get_upcoming_trial_trainings"("p_club_id" "uuid", "p_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_upcoming_trial_trainings"("p_club_id" "uuid", "p_days" integer) IS 'Get scheduled trial trainings in the next N days';



CREATE OR REPLACE FUNCTION "public"."get_user_club_ids"() RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    AS $$
  SELECT ARRAY_AGG(club_id)
  FROM user_club_memberships
  WHERE user_id = auth.uid()
    AND is_active = true
$$;


ALTER FUNCTION "public"."get_user_club_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_valid_fee_configurations"("p_club_id" "uuid", "p_date" "date" DEFAULT CURRENT_DATE) RETURNS SETOF "public"."fee_configurations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM fee_configurations
  WHERE club_id = p_club_id
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= p_date)
    AND (valid_until IS NULL OR valid_until >= p_date);
END;
$$;


ALTER FUNCTION "public"."get_valid_fee_configurations"("p_club_id" "uuid", "p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_valid_fee_configurations"("p_club_id" "uuid", "p_date" "date") IS 'Get all valid fee configurations for a club on a specific date';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.created_at,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_active_sepa_mandate"("p_member_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.sepa_mandates
    WHERE member_id = p_member_id
      AND is_active = true
  );
$$;


ALTER FUNCTION "public"."has_active_sepa_mandate"("p_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_member_balance"("p_balance_id" "uuid", "p_amount" numeric) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE member_balances
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = p_balance_id;
$$;


ALTER FUNCTION "public"."increment_member_balance"("p_balance_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_news_view_count"("p_post_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE news_posts
  SET view_count = view_count + 1
  WHERE id = p_post_id;
END;
$$;


ALTER FUNCTION "public"."increment_news_view_count"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_admin"("p_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND role IN ('admin', 'superadmin')
      AND is_active = true
  )
$$;


ALTER FUNCTION "public"."is_club_admin"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_member"("p_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND is_active = true
  )
$$;


ALTER FUNCTION "public"."is_club_member"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_trainer"("p_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND role IN ('trainer', 'admin', 'superadmin')
      AND is_active = true
  )
$$;


ALTER FUNCTION "public"."is_club_trainer"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
  )
$$;


ALTER FUNCTION "public"."is_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_superadmin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
      AND role = 'superadmin'
      AND is_active = true
  )
$$;


ALTER FUNCTION "public"."is_superadmin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_superadmin_of"("p_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND role = 'superadmin'
      AND is_active = true
  )
$$;


ALTER FUNCTION "public"."is_superadmin_of"("p_club_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_superadmin_of"("p_club_id" "uuid") IS 'Returns true if current user is superadmin of the specified club (real user_club_memberships row, role=superadmin). Unlike is_superadmin(), this is scoped to one club.';



CREATE OR REPLACE FUNCTION "public"."is_trainer_available"("p_user_id" "uuid", "p_club_id" "uuid", "p_datetime" timestamp without time zone) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_day_of_week integer;
  v_time time;
  v_date date;
  v_available_count integer;
  v_absence_count integer;
BEGIN
  -- Extract components
  v_day_of_week := EXTRACT(DOW FROM p_datetime)::integer;
  v_time := p_datetime::time;
  v_date := p_datetime::date;
  
  -- Check if trainer has availability for this day/time
  SELECT COUNT(*) INTO v_available_count
  FROM trainer_availability
  WHERE user_id = p_user_id
    AND club_id = p_club_id
    AND day_of_week = v_day_of_week
    AND start_time <= v_time
    AND end_time >= v_time
    AND is_available = true;
  
  IF v_available_count = 0 THEN
    RETURN false;
  END IF;
  
  -- Check if trainer has an absence on this date
  SELECT COUNT(*) INTO v_absence_count
  FROM trainer_absences
  WHERE user_id = p_user_id
    AND club_id = p_club_id
    AND start_date <= v_date
    AND end_date >= v_date;
  
  IF v_absence_count > 0 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."is_trainer_available"("p_user_id" "uuid", "p_club_id" "uuid", "p_datetime" timestamp without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_season_plan_entry_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO season_planning_history (
      season_id, club_id, action_type, entity_type, entity_id,
      changed_by, changes
    ) VALUES (
      NEW.season_id, NEW.club_id, 'created', 'plan_entry', NEW.id,
      auth.uid(), row_to_json(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO season_planning_history (
      season_id, club_id, action_type, entity_type, entity_id,
      changed_by, changes
    ) VALUES (
      NEW.season_id, NEW.club_id, 'updated', 'plan_entry', NEW.id,
      auth.uid(), jsonb_build_object(
        'old', row_to_json(OLD),
        'new', row_to_json(NEW)
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    -- Nur loggen, wenn die Saison noch existiert (kein Cascade-Delete des Parents).
    IF EXISTS (SELECT 1 FROM seasons WHERE id = OLD.season_id) THEN
      INSERT INTO season_planning_history (
        season_id, club_id, action_type, entity_type, entity_id,
        changed_by, changes
      ) VALUES (
        OLD.season_id, OLD.club_id, 'deleted', 'plan_entry', OLD.id,
        auth.uid(), row_to_json(OLD)
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_season_plan_entry_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_season_planning_action"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO season_planning_history (season_id, club_id, action_type, actor_id, details)
    VALUES (NEW.id, NEW.club_id, 'season_created', NEW.created_by,
            jsonb_build_object('season_name', NEW.name, 'season_type', NEW.season_type));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.planning_status != NEW.planning_status THEN
      INSERT INTO season_planning_history (season_id, club_id, action_type, details)
      VALUES (NEW.id, NEW.club_id,
              CASE NEW.planning_status
                WHEN 'collecting_preferences' THEN 'preferences_opened'
                WHEN 'auto_planning' THEN 'auto_plan_started'
                WHEN 'published' THEN 'plan_published'
                WHEN 'active' THEN 'season_activated'
                WHEN 'completed' THEN 'season_completed'
                ELSE 'manual_edit'
              END,
              jsonb_build_object('old_status', OLD.planning_status, 'new_status', NEW.planning_status));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_season_planning_action"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_invoice_items_for_recalc_on_plan_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_affected_count INTEGER := 0;
BEGIN
  -- Only mark items where pricing-relevant columns actually changed.
  -- Old-vs-new comparison: status/notes/admin_notes don't trigger recalc.
  IF (
       NEW.duration_minutes      IS DISTINCT FROM OLD.duration_minutes
    OR NEW.group_id              IS DISTINCT FROM OLD.group_id
    OR NEW.trainer_id            IS DISTINCT FROM OLD.trainer_id
    OR NEW.court_id              IS DISTINCT FROM OLD.court_id
    OR NEW.max_participants      IS DISTINCT FROM OLD.max_participants
    OR NEW.expected_participants IS DISTINCT FROM OLD.expected_participants
  ) THEN
    UPDATE public.invoice_items
       SET recalc_required_at = NOW()
     WHERE reference_type = 'plan_entry'
       AND reference_id = NEW.id
       AND (
            recalc_required_at IS NULL
         OR recalc_required_at < NOW() - INTERVAL '1 second'
       );
    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
  END IF;

  IF v_affected_count > 0 THEN
    RAISE LOG 'invoice_items recalc-flagged: plan_entry=% affected=%',
              NEW.id, v_affected_count;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mark_invoice_items_for_recalc_on_plan_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_invoice_items_for_recalc_on_plan_change"() IS 'Pricing audit trigger: marks invoice_items needing recalculation when their referenced season_plan_entries changes pricing-relevant fields. Idempotent — re-evaluating the same change within a 1-second window does not update the timestamp again (debounce).';



CREATE OR REPLACE FUNCTION "public"."mark_overdue_invoices"() RETURNS TABLE("club_id" "uuid", "invoice_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH updated AS (
    UPDATE invoices
    SET status = 'overdue'
    WHERE status IN ('sent', 'partially_paid')
      AND due_date < NOW()
    RETURNING invoices.club_id
  )
  SELECT updated.club_id, COUNT(*) AS invoice_count
  FROM updated
  WHERE updated.club_id IS NOT NULL
  GROUP BY updated.club_id;
END;
$$;


ALTER FUNCTION "public"."mark_overdue_invoices"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_overdue_invoices"() IS 'Marks invoices past due_date as overdue. Returns affected club_ids with counts.
   Designed for pg_cron daily execution (3 AM). Manual invocation via
   SELECT * FROM mark_overdue_invoices() for testing.';



CREATE OR REPLACE FUNCTION "public"."match_results_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."match_results_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_results_validate_outcome"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.outcome = 'home_won' AND NEW.home_sets_won <= NEW.away_sets_won THEN
    RAISE EXCEPTION 'match_results: outcome=home_won verlangt home_sets_won > away_sets_won (aktuell % vs. %)',
      NEW.home_sets_won, NEW.away_sets_won;
  END IF;
  IF NEW.outcome = 'away_won' AND NEW.away_sets_won <= NEW.home_sets_won THEN
    RAISE EXCEPTION 'match_results: outcome=away_won verlangt away_sets_won > home_sets_won (aktuell % vs. %)',
      NEW.away_sets_won, NEW.home_sets_won;
  END IF;
  IF NEW.outcome IN ('home_won', 'away_won') AND NEW.home_sets_won + NEW.away_sets_won < 2 THEN
    RAISE EXCEPTION 'match_results: best-of-3 → mindestens 2 Sätze erforderlich';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."match_results_validate_outcome"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_invoice_content_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.status IN (
    'open','sent','partially_paid','paid',
    'overdue','dunning','reminder_sent','void','uncollectible','refunded'
  ) THEN
    IF (NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
        NEW.amount IS DISTINCT FROM OLD.amount OR
        NEW.invoice_date IS DISTINCT FROM OLD.invoice_date OR
        NEW.invoice_type IS DISTINCT FROM OLD.invoice_type) THEN
      RAISE EXCEPTION 'GoBD: Cannot modify content of finalized invoice %', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_invoice_content_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_required_setting_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.is_required = true THEN
    RAISE EXCEPTION 'Cannot delete required system setting: %', OLD.key;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."prevent_required_setting_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_audit_logs"() RETURNS TABLE("deleted_security" bigint, "deleted_read" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."prune_audit_logs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prune_audit_logs"() IS 'Aufbewahrung: Lese-Protokolle 90 Tage, Sicherheitsprotokolle 12 Monate, Finanzvorgänge unbegrenzt (§ 147 AO, 10 Jahre). Aufruf über /api/cron/prune-audit-logs.';



CREATE OR REPLACE FUNCTION "public"."season_group_weeks_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."season_group_weeks_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_dunning_member_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.member_id IS NULL AND NEW.invoice_id IS NOT NULL THEN
    SELECT i.member_id INTO NEW.member_id
    FROM invoices i
    WHERE i.id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_dunning_member_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_dunning_member_id"() IS 'Auto-populates member_id from the referenced invoice on INSERT. Ensures dunning_records are always linked to a member when possible.';



CREATE OR REPLACE FUNCTION "public"."set_preference_last_modified"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.last_modified_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_preference_last_modified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_trainer_absence_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT t.user_id INTO NEW.user_id FROM trainers t WHERE t.id = NEW.trainer_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_trainer_absence_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."shares_active_club_with"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_club_memberships own
    JOIN user_club_memberships other ON other.club_id = own.club_id
    WHERE own.user_id = auth.uid()
      AND own.is_active = true
      AND other.user_id = target_user_id
      AND other.is_active = true
  );
$$;


ALTER FUNCTION "public"."shares_active_club_with"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."shares_active_club_with"("target_user_id" "uuid") IS 'Teilt der aufrufende Nutzer einen aktiven Verein mit target_user_id? SECURITY DEFINER, weil die Prüfung sonst an der RLS von user_club_memberships scheitert.';



CREATE OR REPLACE FUNCTION "public"."start_job"("p_job_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE background_jobs SET status = 'running', started_at = NOW(), updated_at = NOW()
  WHERE id = p_job_id AND status = 'pending';
  RETURN FOUND;
END; $$;


ALTER FUNCTION "public"."start_job"("p_job_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."start_job"("p_job_id" "uuid") IS 'Mark job as running';



CREATE OR REPLACE FUNCTION "public"."timeslots_overlap"("day1" integer, "start1" time without time zone, "end1" time without time zone, "day2" integer, "start2" time without time zone, "end2" time without time zone) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  -- Different days = no overlap
  IF day1 != day2 THEN
    RETURN false;
  END IF;
  
  -- Check time overlap on same day
  RETURN (start1 < end2) AND (start2 < end1);
END;
$$;


ALTER FUNCTION "public"."timeslots_overlap"("day1" integer, "start1" time without time zone, "end1" time without time zone, "day2" integer, "start2" time without time zone, "end2" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_dashboard_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_dashboard_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_elo_after_match"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_k_factor       CONSTANT NUMERIC := 32.0;
  v_winner_ids     UUID[];
  v_loser_ids      UUID[];
  v_winner_avg     NUMERIC;
  v_loser_avg      NUMERIC;
  v_winner_expected NUMERIC;
  v_loser_expected  NUMERIC;
  v_winner_delta   INTEGER;
  v_loser_delta    INTEGER;
BEGIN
  -- Nur bei entschiedenen Spielen ELO aktualisieren
  IF NEW.outcome NOT IN ('home_won', 'away_won') THEN
    RETURN NEW;
  END IF;

  -- Sieger- und Verlierer-IDs bestimmen
  IF NEW.outcome = 'home_won' THEN
    v_winner_ids := NEW.home_player_ids;
    v_loser_ids  := NEW.away_player_ids;
  ELSE
    v_winner_ids := NEW.away_player_ids;
    v_loser_ids  := NEW.home_player_ids;
  END IF;

  -- Durchschnitts-ELO beider Seiten (Fallback 1200 falls keine Spieler gefunden)
  SELECT COALESCE(AVG(elo_rating), 1200) INTO v_winner_avg
  FROM public.players WHERE id = ANY(v_winner_ids);

  SELECT COALESCE(AVG(elo_rating), 1200) INTO v_loser_avg
  FROM public.players WHERE id = ANY(v_loser_ids);

  -- Expected Score (1.0 = sicherer Sieg, 0.0 = sicherer Verlierer, 0.5 = gleich)
  v_winner_expected := 1.0 / (1.0 + POWER(10, (v_loser_avg - v_winner_avg) / 400.0));
  v_loser_expected  := 1.0 - v_winner_expected;

  -- Delta = ROUND(K * (actual - expected)), actual = 1 für Sieger, 0 für Verlierer
  v_winner_delta := ROUND(v_k_factor * (1.0 - v_winner_expected));
  v_loser_delta  := ROUND(v_k_factor * (0.0 - v_loser_expected));

  -- ELO der Sieger erhöhen
  UPDATE public.players
  SET elo_rating = elo_rating + v_winner_delta, updated_at = NOW()
  WHERE id = ANY(v_winner_ids);

  -- ELO der Verlierer senken
  UPDATE public.players
  SET elo_rating = elo_rating + v_loser_delta, updated_at = NOW()
  WHERE id = ANY(v_loser_ids);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_elo_after_match"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_elo_after_match"() IS 'ELO-Update-Trigger: aktualisiert players.elo_rating nach jedem entschiedenen Medenspiel (K=32).';



CREATE OR REPLACE FUNCTION "public"."update_fee_configurations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_fee_configurations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_invoice_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_paid numeric(10, 2);
  v_invoice_amount numeric(10, 2);
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Sum all completed payments for this invoice
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM payments
    WHERE invoice_id = NEW.invoice_id
      AND status = 'completed';

    -- Get invoice total (amount column = subtotal + tax)
    SELECT amount INTO v_invoice_amount
    FROM invoices
    WHERE id = NEW.invoice_id;

    IF v_total_paid >= v_invoice_amount THEN
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

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_invoice_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_invoice_status"() IS 'Auto-updates invoices.paid_amount and status after payment INSERT/UPDATE. Sets status=paid when paid_amount >= amount.';



CREATE OR REPLACE FUNCTION "public"."update_open_matches_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_open_matches_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_payment_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_push_subscriptions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_push_subscriptions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_season_billing_configs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_season_billing_configs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_season_plan_entries_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_season_plan_entries_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_system_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_system_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_trainer_absences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_trainer_absences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_trainer_rating_summary"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update or insert rating summary
  INSERT INTO trainer_rating_summary (
    trainer_id,
    club_id,
    average_rating,
    total_ratings,
    avg_teaching_quality,
    avg_communication,
    avg_motivation,
    avg_punctuality,
    rating_5_count,
    rating_4_count,
    rating_3_count,
    rating_2_count,
    rating_1_count,
    last_updated
  )
  SELECT 
    trainer_id,
    club_id,
    ROUND(AVG(rating)::numeric, 2) as average_rating,
    COUNT(*) as total_ratings,
    ROUND(AVG(teaching_quality)::numeric, 2) as avg_teaching_quality,
    ROUND(AVG(communication)::numeric, 2) as avg_communication,
    ROUND(AVG(motivation)::numeric, 2) as avg_motivation,
    ROUND(AVG(punctuality)::numeric, 2) as avg_punctuality,
    COUNT(*) FILTER (WHERE rating = 5) as rating_5_count,
    COUNT(*) FILTER (WHERE rating = 4) as rating_4_count,
    COUNT(*) FILTER (WHERE rating = 3) as rating_3_count,
    COUNT(*) FILTER (WHERE rating = 2) as rating_2_count,
    COUNT(*) FILTER (WHERE rating = 1) as rating_1_count,
    NOW()
  FROM trainer_feedback
  WHERE 
    trainer_id = COALESCE(NEW.trainer_id, OLD.trainer_id)
    AND is_visible = true
  GROUP BY trainer_id, club_id
  ON CONFLICT (trainer_id, club_id) 
  DO UPDATE SET
    average_rating = EXCLUDED.average_rating,
    total_ratings = EXCLUDED.total_ratings,
    avg_teaching_quality = EXCLUDED.avg_teaching_quality,
    avg_communication = EXCLUDED.avg_communication,
    avg_motivation = EXCLUDED.avg_motivation,
    avg_punctuality = EXCLUDED.avg_punctuality,
    rating_5_count = EXCLUDED.rating_5_count,
    rating_4_count = EXCLUDED.rating_4_count,
    rating_3_count = EXCLUDED.rating_3_count,
    rating_2_count = EXCLUDED.rating_2_count,
    rating_1_count = EXCLUDED.rating_1_count,
    last_updated = NOW();
    
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_trainer_rating_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_trial_trainings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_trial_trainings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_available_at"("p_user_id" "uuid", "p_season_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_specific_date" "date" DEFAULT NULL::"date") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_prefs jsonb;
  v_day_key text;
  v_availability jsonb;
  v_slot jsonb;
  v_unavailable_dates jsonb;
BEGIN
  -- Get user preferences
  SELECT weekly_availability, unavailable_dates
  INTO v_prefs, v_unavailable_dates
  FROM user_training_preferences
  WHERE user_id = p_user_id AND season_id = p_season_id;
  
  -- No preferences = assume unavailable
  IF v_prefs IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check specific date unavailability
  IF p_specific_date IS NOT NULL AND v_unavailable_dates IS NOT NULL THEN
    IF v_unavailable_dates ? p_specific_date::text THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Get day name
  v_day_key := CASE p_day_of_week
    WHEN 0 THEN 'monday'
    WHEN 1 THEN 'tuesday'
    WHEN 2 THEN 'wednesday'
    WHEN 3 THEN 'thursday'
    WHEN 4 THEN 'friday'
    WHEN 5 THEN 'saturday'
    WHEN 6 THEN 'sunday'
  END;
  
  -- Get availability for that day
  v_availability := v_prefs->v_day_key;
  
  -- If no availability specified for that day, assume unavailable
  IF v_availability IS NULL OR jsonb_array_length(v_availability) = 0 THEN
    RETURN false;
  END IF;
  
  -- Check if requested time overlaps with any available slot
  FOR v_slot IN SELECT * FROM jsonb_array_elements(v_availability)
  LOOP
    IF (v_slot->>'start')::time <= p_start_time 
       AND (v_slot->>'end')::time >= p_end_time THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$;


ALTER FUNCTION "public"."user_available_at"("p_user_id" "uuid", "p_season_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_specific_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_booking_rules"("p_user_id" "uuid", "p_club_id" "uuid", "p_court_id" "uuid", "p_start_time" timestamp without time zone, "p_end_time" timestamp without time zone, "p_booking_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("is_valid" boolean, "error_code" character varying, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_role varchar;
  v_booking_rule record;
  v_booking_count_day integer;
  v_booking_count_week integer;
  v_duration_minutes integer;
  v_advance_days integer;
  v_day_of_week integer;
  v_restriction_count integer;
BEGIN
  -- Get user role for this club
  SELECT ucm.role INTO v_user_role
  FROM user_club_memberships ucm
  WHERE ucm.user_id = p_user_id
    AND ucm.club_id = p_club_id
    AND ucm.is_active = true
  ORDER BY 
    CASE ucm.role
      WHEN 'superadmin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'trainer' THEN 3
      WHEN 'member' THEN 4
      ELSE 5
    END
  LIMIT 1;

  IF v_user_role IS NULL THEN
    RETURN QUERY SELECT false, 'NO_MEMBERSHIP'::varchar, 'User has no active membership in this club'::text;
    RETURN;
  END IF;

  -- Get booking rule for this role
  SELECT * INTO v_booking_rule
  FROM booking_rules
  WHERE club_id = p_club_id
    AND role = v_user_role
    AND is_active = true
  ORDER BY priority DESC
  LIMIT 1;

  IF v_booking_rule IS NULL THEN
    -- Use default member rules if no specific rule exists
    SELECT * INTO v_booking_rule
    FROM booking_rules
    WHERE club_id = p_club_id
      AND role = 'member'
      AND is_active = true
    ORDER BY priority DESC
    LIMIT 1;
  END IF;

  IF v_booking_rule IS NULL THEN
    RETURN QUERY SELECT false, 'NO_RULES'::varchar, 'No booking rules configured for this club'::text;
    RETURN;
  END IF;

  -- Check duration
  v_duration_minutes := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60;
  
  IF v_duration_minutes < v_booking_rule.min_booking_duration_minutes THEN
    RETURN QUERY SELECT false, 'DURATION_TOO_SHORT'::varchar, 
      format('Booking duration must be at least %s minutes', v_booking_rule.min_booking_duration_minutes)::text;
    RETURN;
  END IF;

  IF v_duration_minutes > v_booking_rule.max_booking_duration_minutes THEN
    RETURN QUERY SELECT false, 'DURATION_TOO_LONG'::varchar,
      format('Booking duration cannot exceed %s minutes', v_booking_rule.max_booking_duration_minutes)::text;
    RETURN;
  END IF;

  -- Check advance booking
  v_advance_days := EXTRACT(DAY FROM (p_start_time::date - CURRENT_DATE));
  
  IF v_advance_days > v_booking_rule.advance_booking_days THEN
    RETURN QUERY SELECT false, 'TOO_FAR_ADVANCE'::varchar,
      format('Bookings can only be made %s days in advance', v_booking_rule.advance_booking_days)::text;
    RETURN;
  END IF;

  IF EXTRACT(EPOCH FROM (p_start_time - NOW())) / 3600 < v_booking_rule.min_advance_booking_hours THEN
    RETURN QUERY SELECT false, 'TOO_SOON'::varchar,
      format('Bookings must be made at least %s hours in advance', v_booking_rule.min_advance_booking_hours)::text;
    RETURN;
  END IF;

  -- Check weekend restrictions
  v_day_of_week := EXTRACT(DOW FROM p_start_time::date);
  IF v_day_of_week IN (0, 6) AND NOT v_booking_rule.allow_weekend_booking THEN
    RETURN QUERY SELECT false, 'WEEKEND_NOT_ALLOWED'::varchar, 'Weekend bookings are not allowed'::text;
    RETURN;
  END IF;

  -- Check bookings per day
  SELECT COUNT(*) INTO v_booking_count_day
  FROM bookings
  WHERE user_id = p_user_id
    AND club_id = p_club_id
    AND DATE(start_time) = DATE(p_start_time)
    AND status IN ('confirmed', 'pending')
    AND (p_booking_id IS NULL OR id != p_booking_id);

  IF v_booking_count_day >= v_booking_rule.max_bookings_per_day THEN
    RETURN QUERY SELECT false, 'MAX_DAILY_BOOKINGS'::varchar,
      format('Maximum %s bookings per day reached', v_booking_rule.max_bookings_per_day)::text;
    RETURN;
  END IF;

  -- Check bookings per week
  SELECT COUNT(*) INTO v_booking_count_week
  FROM bookings
  WHERE user_id = p_user_id
    AND club_id = p_club_id
    AND DATE(start_time) >= DATE(p_start_time) - INTERVAL '7 days'
    AND DATE(start_time) <= DATE(p_start_time) + INTERVAL '7 days'
    AND status IN ('confirmed', 'pending')
    AND (p_booking_id IS NULL OR id != p_booking_id);

  IF v_booking_count_week >= v_booking_rule.max_bookings_per_week THEN
    RETURN QUERY SELECT false, 'MAX_WEEKLY_BOOKINGS'::varchar,
      format('Maximum %s bookings per week reached', v_booking_rule.max_bookings_per_week)::text;
    RETURN;
  END IF;

  -- Check restrictions (holidays, maintenance, etc.)
  SELECT COUNT(*) INTO v_restriction_count
  FROM booking_restrictions
  WHERE club_id = p_club_id
    AND (court_id IS NULL OR court_id = p_court_id)
    AND is_active = true
    AND (
      (start_datetime <= p_start_time AND end_datetime >= p_start_time)
      OR (start_datetime <= p_end_time AND end_datetime >= p_end_time)
      OR (start_datetime >= p_start_time AND end_datetime <= p_end_time)
    );

  IF v_restriction_count > 0 THEN
    RETURN QUERY SELECT false, 'TIME_RESTRICTED'::varchar, 'This time slot is blocked due to maintenance or special event'::text;
    RETURN;
  END IF;

  -- Check court availability conflict
  IF NOT validate_booking_availability(p_court_id, p_start_time, p_end_time, p_booking_id) THEN
    RETURN QUERY SELECT false, 'TIME_CONFLICT'::varchar, 'This time slot is already booked'::text;
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT true, NULL::varchar, NULL::text;
END;
$$;


ALTER FUNCTION "public"."validate_booking_rules"("p_user_id" "uuid", "p_club_id" "uuid", "p_court_id" "uuid", "p_start_time" timestamp without time zone, "p_end_time" timestamp without time zone, "p_booking_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "trainer_name" character varying(255) NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "participant_name" character varying(255) NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "status" character varying(20) NOT NULL,
    "check_in_time" character varying(5),
    "check_out_time" character varying(5),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trainer_confirmed" boolean DEFAULT false NOT NULL,
    "trainer_confirmed_at" timestamp with time zone,
    "member_status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "member_confirmed_at" timestamp with time zone,
    "dispute_reason" "text",
    "dispute_resolved_at" timestamp with time zone,
    "dispute_resolved_by" "uuid",
    "duration_minutes" integer,
    CONSTRAINT "attendance_records_check_in_time_check" CHECK ((("check_in_time" IS NULL) OR (("check_in_time")::"text" ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'::"text"))),
    CONSTRAINT "attendance_records_check_out_time_check" CHECK ((("check_out_time" IS NULL) OR (("check_out_time")::"text" ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'::"text"))),
    CONSTRAINT "attendance_records_duration_minutes_check" CHECK ((("duration_minutes" >= 0) AND ("duration_minutes" <= 480))),
    CONSTRAINT "attendance_records_member_status_check" CHECK ((("member_status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('confirmed'::character varying)::"text", ('disputed'::character varying)::"text"]))),
    CONSTRAINT "attendance_records_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('present'::character varying)::"text", ('absent'::character varying)::"text", ('late'::character varying)::"text", ('excused'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."attendance_records" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_records" OWNER TO "postgres";


COMMENT ON TABLE "public"."attendance_records" IS 'Session attendance tracking (who attended which session)';



COMMENT ON COLUMN "public"."attendance_records"."status" IS 'Status: present, absent, late, excused';



COMMENT ON COLUMN "public"."attendance_records"."trainer_confirmed" IS 'Whether the trainer has confirmed this attendance record';



COMMENT ON COLUMN "public"."attendance_records"."trainer_confirmed_at" IS 'When the trainer confirmed the record';



COMMENT ON COLUMN "public"."attendance_records"."member_status" IS 'Member confirmation status: pending (awaiting), confirmed (accepted), disputed (member disagrees)';



COMMENT ON COLUMN "public"."attendance_records"."member_confirmed_at" IS 'When the member confirmed or disputed';



COMMENT ON COLUMN "public"."attendance_records"."dispute_reason" IS 'Reason provided by member when disputing attendance';



COMMENT ON COLUMN "public"."attendance_records"."dispute_resolved_at" IS 'When admin resolved the dispute';



COMMENT ON COLUMN "public"."attendance_records"."duration_minutes" IS 'Session duration in minutes (for hours calculation)';



CREATE TABLE IF NOT EXISTS "public"."trainers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "name" character varying(100) NOT NULL,
    "specialties" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "max_hours_per_week" integer DEFAULT 30 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid"
);

ALTER TABLE ONLY "public"."trainers" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(100),
    "avatar_url" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "subscription_status" "text" DEFAULT 'active'::"text",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "current_period_end" timestamp with time zone,
    "billing_email" "text",
    "phone" character varying(20),
    "address" "text",
    "city" "text",
    "postal_code" "text",
    "date_of_birth" "date",
    "bio" "text",
    "emergency_contact" "text",
    "emergency_phone" "text",
    "superadmin_setup_completed_at" timestamp without time zone,
    "experience_months" integer DEFAULT 0,
    "skill_level" character varying(20) DEFAULT 'beginner'::character varying,
    "dtb_id" character varying(20),
    "owner_setup_completed_at" timestamp with time zone,
    "lk_rating" numeric(4,2),
    "stripe_subscription_quantity_synced" integer,
    "stripe_subscription_quantity_synced_at" timestamp with time zone,
    CONSTRAINT "users_lk_rating_check" CHECK ((("lk_rating" IS NULL) OR (("lk_rating" >= 1.00) AND ("lk_rating" <= 25.00)))),
    CONSTRAINT "users_stripe_quantity_synced_nonneg_chk" CHECK ((("stripe_subscription_quantity_synced" IS NULL) OR ("stripe_subscription_quantity_synced" >= 0))),
    CONSTRAINT "users_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['active'::"text", 'canceled'::"text", 'past_due'::"text", 'unpaid'::"text", 'incomplete'::"text"]))),
    CONSTRAINT "users_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'pro'::"text", 'enterprise'::"text"])))
);

ALTER TABLE ONLY "public"."users" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."subscription_tier" IS 'Current subscription plan tier: free, pro, enterprise';



COMMENT ON COLUMN "public"."users"."subscription_status" IS 'Subscription status from Stripe';



COMMENT ON COLUMN "public"."users"."stripe_customer_id" IS 'Stripe customer ID for billing';



COMMENT ON COLUMN "public"."users"."stripe_subscription_id" IS 'Stripe subscription ID';



COMMENT ON COLUMN "public"."users"."current_period_end" IS 'Current subscription period end date';



COMMENT ON COLUMN "public"."users"."billing_email" IS 'Email address for billing (may differ from login email)';



COMMENT ON COLUMN "public"."users"."address" IS 'Straße und Hausnummer';



COMMENT ON COLUMN "public"."users"."city" IS 'Stadt';



COMMENT ON COLUMN "public"."users"."postal_code" IS 'Postleitzahl';



COMMENT ON COLUMN "public"."users"."date_of_birth" IS 'Geburtsdatum';



COMMENT ON COLUMN "public"."users"."bio" IS 'Kurzbeschreibung / Bio';



COMMENT ON COLUMN "public"."users"."emergency_contact" IS 'Name des Notfallkontakts';



COMMENT ON COLUMN "public"."users"."emergency_phone" IS 'Telefonnummer des Notfallkontakts';



COMMENT ON COLUMN "public"."users"."experience_months" IS 'Spielerfahrung in Monaten';



COMMENT ON COLUMN "public"."users"."skill_level" IS 'Selbst eingeschätztes Spielniveau (beginner, intermediate, advanced)';



COMMENT ON COLUMN "public"."users"."dtb_id" IS 'DTB-Spielernummer (Deutscher Tennis Bund). Format: numeric ID assigned by tennis.de. Used for linking to official profiles and league standings.';



COMMENT ON COLUMN "public"."users"."lk_rating" IS 'Manuelle DTB-Leistungsklasse (1.00 - 25.00, Granularitaet 0.05). Vom
   Member oder Admin manuell eingetragen - kein automatischer Sync mit dem
   DTB-Portal (siehe ADR-002 docs/decisions/lk-sync-deferral.md). Wird fuer
   Season-Planning-Clustering und Matchmaking-Range genutzt sobald der
   Matching-Algorithmus LK-Constraints verlangt; aktuell nur Anzeige im Profil.';



COMMENT ON COLUMN "public"."users"."stripe_subscription_quantity_synced" IS 'Last Stripe subscription item quantity pushed for active-member pricing. NULL = never synced. Idempotency-cache for ticket 3.6.1.';



COMMENT ON COLUMN "public"."users"."stripe_subscription_quantity_synced_at" IS 'Timestamp of last Stripe subscription-quantity push. Audit-only. Idempotency-cache for ticket 3.6.1.';



CREATE OR REPLACE VIEW "public"."attendance_hours_summary" WITH ("security_invoker"='true') AS
 SELECT "ar"."participant_id" AS "member_id",
    "u"."full_name" AS "member_name",
    "ar"."trainer_id",
    "t"."name" AS "trainer_name",
    "count"(*) AS "total_sessions",
    "count"(*) FILTER (WHERE (("ar"."status")::"text" = 'present'::"text")) AS "attended_sessions",
    "count"(*) FILTER (WHERE (("ar"."status")::"text" = 'absent'::"text")) AS "missed_sessions",
    "count"(*) FILTER (WHERE (("ar"."status")::"text" = 'excused'::"text")) AS "excused_sessions",
    "count"(*) FILTER (WHERE (("ar"."status")::"text" = 'late'::"text")) AS "late_sessions",
    "count"(*) FILTER (WHERE ("ar"."trainer_confirmed" = true)) AS "trainer_confirmed_count",
    "count"(*) FILTER (WHERE (("ar"."member_status")::"text" = 'confirmed'::"text")) AS "member_confirmed_count",
    "count"(*) FILTER (WHERE (("ar"."member_status")::"text" = 'disputed'::"text")) AS "disputed_count",
    "count"(*) FILTER (WHERE (("ar"."member_status")::"text" = 'pending'::"text")) AS "pending_confirmation_count",
    COALESCE("sum"("ar"."duration_minutes") FILTER (WHERE (("ar"."status")::"text" = ANY (ARRAY[('present'::character varying)::"text", ('late'::character varying)::"text"]))), (0)::bigint) AS "total_attended_minutes",
    COALESCE("sum"("ar"."duration_minutes"), (0)::bigint) AS "total_scheduled_minutes",
        CASE
            WHEN ("count"(*) > 0) THEN "round"(((("count"(*) FILTER (WHERE (("ar"."status")::"text" = ANY (ARRAY[('present'::character varying)::"text", ('late'::character varying)::"text"]))))::numeric * 100.0) / ("count"(*))::numeric), 1)
            ELSE (0)::numeric
        END AS "attendance_rate"
   FROM (("public"."attendance_records" "ar"
     LEFT JOIN "public"."users" "u" ON (("u"."id" = "ar"."participant_id")))
     LEFT JOIN "public"."trainers" "t" ON (("t"."id" = "ar"."trainer_id")))
  GROUP BY "ar"."participant_id", "u"."full_name", "ar"."trainer_id", "t"."name";


ALTER VIEW "public"."attendance_hours_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."attendance_hours_summary" IS 'Aggregated attendance and hours summary per member per trainer';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" character varying(50) NOT NULL,
    "resource_type" character varying(50) NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" character varying(45),
    "user_agent" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "club_id" "uuid"
);

ALTER TABLE ONLY "public"."audit_logs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."background_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_name" "text" NOT NULL,
    "job_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "schedule_expression" "text",
    "scheduled_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result" "jsonb" DEFAULT '{}'::"jsonb",
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_job_type" CHECK (("job_type" = ANY (ARRAY['scheduled'::"text", 'one_time'::"text", 'recurring'::"text"]))),
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."background_jobs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."background_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."background_jobs" IS 'Queue for background jobs and scheduled tasks';



CREATE TABLE IF NOT EXISTS "public"."base_interest_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "valid_from" "date" NOT NULL,
    "rate" numeric(5,4) NOT NULL,
    "source" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."base_interest_rates" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."base_interest_rates" OWNER TO "postgres";


COMMENT ON TABLE "public"."base_interest_rates" IS 'Halbjährliche Basiszinssätze gem. §247 BGB. Manuell/Cronjob pflegen.';



CREATE TABLE IF NOT EXISTS "public"."billing_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trainer_billing_id" "uuid" NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "description" "text" NOT NULL,
    "hours" numeric(10,2) NOT NULL,
    "rate" numeric(10,2) NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "type" character varying(20) NOT NULL,
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_line_items_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "billing_line_items_hours_check" CHECK (("hours" >= (0)::numeric)),
    CONSTRAINT "billing_line_items_rate_check" CHECK (("rate" >= (0)::numeric)),
    CONSTRAINT "billing_line_items_type_check" CHECK ((("type")::"text" = ANY (ARRAY[('training'::character varying)::"text", ('preparation'::character varying)::"text", ('meeting'::character varying)::"text", ('other'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."billing_line_items" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_line_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_line_items" IS 'Detailed breakdown of trainer hours per billing period';



COMMENT ON COLUMN "public"."billing_line_items"."type" IS 'Type: training (teaching session), preparation (lesson planning), meeting (staff meetings), other';



CREATE TABLE IF NOT EXISTS "public"."billing_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "status" character varying(20) DEFAULT 'open'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    CONSTRAINT "billing_periods_date_range" CHECK (("end_date" > "start_date")),
    CONSTRAINT "billing_periods_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('open'::character varying)::"text", ('processing'::character varying)::"text", ('closed'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."billing_periods" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_periods" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_periods" IS 'Billing periods for trainer compensation (typically monthly)';



COMMENT ON COLUMN "public"."billing_periods"."status" IS 'Status: open (can add billings), processing (generating invoices), closed (finalized)';



CREATE TABLE IF NOT EXISTS "public"."board_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "meeting_date" timestamp with time zone,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "decision_type" "public"."decision_type" DEFAULT 'mitgliederversammlung'::"public"."decision_type" NOT NULL,
    "status" "public"."decision_status" DEFAULT 'draft'::"public"."decision_status" NOT NULL,
    "outcome" "public"."decision_outcome",
    "quorum_met" boolean,
    "votes_for" integer DEFAULT 0 NOT NULL,
    "votes_against" integer DEFAULT 0 NOT NULL,
    "votes_abstain" integer DEFAULT 0 NOT NULL,
    "attachments" "jsonb",
    "next_review" "date",
    "created_by" "uuid" NOT NULL,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."board_decisions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_decisions" OWNER TO "postgres";


COMMENT ON TABLE "public"."board_decisions" IS 'Digitale Beschlussdatenbank für Vereinsrecht-Compliance (BGB §§ 28, 32, 33).';



CREATE TABLE IF NOT EXISTS "public"."booking_restrictions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "court_id" "uuid",
    "restriction_type" character varying(50) NOT NULL,
    "name" character varying(200) NOT NULL,
    "description" "text",
    "start_datetime" timestamp without time zone NOT NULL,
    "end_datetime" timestamp without time zone NOT NULL,
    "affects_existing_bookings" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_restrictions_check" CHECK (("end_datetime" > "start_datetime")),
    CONSTRAINT "booking_restrictions_restriction_type_check" CHECK ((("restriction_type")::"text" = ANY (ARRAY[('holiday'::character varying)::"text", ('maintenance'::character varying)::"text", ('event'::character varying)::"text", ('weather'::character varying)::"text", ('other'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."booking_restrictions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_restrictions" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_restrictions" IS 'Temporary restrictions on bookings (holidays, maintenance, events)';



CREATE TABLE IF NOT EXISTS "public"."booking_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "name" character varying(255) DEFAULT 'Standard'::character varying NOT NULL,
    "max_booking_duration_minutes" integer DEFAULT 90,
    "min_booking_duration_minutes" integer DEFAULT 30,
    "advance_booking_days" integer DEFAULT 14,
    "max_bookings_per_day" integer DEFAULT 2,
    "max_bookings_per_week" integer DEFAULT 5,
    "allow_recurring" boolean DEFAULT false,
    "cancellation_hours_before" integer DEFAULT 24,
    "applies_to_role" "text" DEFAULT 'member'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "require_payment" boolean DEFAULT false NOT NULL,
    "role" character varying(20) DEFAULT 'member'::character varying,
    "min_advance_booking_hours" integer DEFAULT 1 NOT NULL,
    "allow_weekend_booking" boolean DEFAULT true NOT NULL,
    "weekend_advance_days" integer DEFAULT 7 NOT NULL,
    "allow_prime_time_booking" boolean DEFAULT true NOT NULL,
    "prime_time_start" time without time zone DEFAULT '17:00:00'::time without time zone,
    "prime_time_end" time without time zone DEFAULT '21:00:00'::time without time zone,
    "max_concurrent_bookings" integer DEFAULT 3 NOT NULL,
    "allow_partner_booking" boolean DEFAULT true NOT NULL,
    "require_approval" boolean DEFAULT false NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "allowed_time_slots" "jsonb" DEFAULT '[]'::"jsonb",
    "blocked_time_slots" "jsonb" DEFAULT '[]'::"jsonb",
    "season_start_date" "date",
    "season_end_date" "date",
    CONSTRAINT "booking_rules_role_check" CHECK ((("role")::"text" = ANY (ARRAY[('member'::character varying)::"text", ('trainer'::character varying)::"text", ('admin'::character varying)::"text", ('guest'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."booking_rules" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_rules" IS 'Role-based rules governing court bookings';



COMMENT ON COLUMN "public"."booking_rules"."role" IS 'User role this rule applies to: member, trainer, admin, guest';



COMMENT ON COLUMN "public"."booking_rules"."min_advance_booking_hours" IS 'Minimum hours in advance for booking';



COMMENT ON COLUMN "public"."booking_rules"."max_concurrent_bookings" IS 'Maximum simultaneous active bookings';



COMMENT ON COLUMN "public"."booking_rules"."require_approval" IS 'Whether bookings require admin approval';



COMMENT ON COLUMN "public"."booking_rules"."priority" IS 'Rule priority for conflict resolution (higher = more important)';



CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "booked_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "cancelled_at" timestamp without time zone,
    "cancellation_reason" character varying(50),
    "cancellation_notes" "text",
    "session_start_time" timestamp with time zone NOT NULL,
    "booking_number" "text",
    "booking_type" "text" DEFAULT 'court'::"text",
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "is_recurring" boolean DEFAULT false,
    "payment_status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "court_id" "uuid" NOT NULL,
    CONSTRAINT "bookings_booking_type_check" CHECK (("booking_type" = ANY (ARRAY['court'::"text", 'session'::"text", 'trainer_slot'::"text"]))),
    CONSTRAINT "bookings_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'refunded'::"text", 'failed'::"text"]))),
    CONSTRAINT "bookings_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('confirmed'::character varying)::"text", ('cancelled'::character varying)::"text", ('completed'::character varying)::"text", ('no_show'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."bookings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON TABLE "public"."bookings" IS 'Trainings-Buchungen. Has its own club_id (denormalized) + session_id + member_id. RLS corrected 20260626.';



COMMENT ON COLUMN "public"."bookings"."session_start_time" IS 'Denormalized session start time for cancellation policy calculation without JOIN';



CREATE TABLE IF NOT EXISTS "public"."club_access_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "club_name" "text",
    "email" "text" NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."club_access_requests" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_access_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" DEFAULT 'sonstige'::"text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_size_bytes" bigint,
    "mime_type" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."club_documents" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(200) NOT NULL,
    "max_members" integer DEFAULT 500 NOT NULL,
    "opening_hours" "jsonb" NOT NULL,
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "default_hourly_rate" numeric(10,2) DEFAULT 15.00,
    "setup_completed_at" timestamp with time zone,
    "description" "text",
    "logo_url" "text",
    "address" "text",
    "city" "text",
    "phone" "text",
    "email" "text",
    "website" "text",
    "slug" character varying(200),
    "timezone" character varying(100) DEFAULT 'Europe/Berlin'::character varying,
    "default_session_duration_minutes" integer DEFAULT 60,
    "hourly_rate" numeric(10,2),
    "billing_unit_minutes" integer DEFAULT 60 NOT NULL,
    "bundesland" "text",
    "tax_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "default_payment_method" "text" DEFAULT 'sepa'::"text" NOT NULL,
    "invoice_number_prefix" "text" DEFAULT 'INV'::"text" NOT NULL,
    "datev_creditor_number" "text",
    "founding_date" "date",
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "primary_color" character varying(9) DEFAULT '#00599F'::character varying,
    "secondary_color" character varying(9) DEFAULT '#22334F'::character varying,
    "accent_color" character varying(9) DEFAULT '#94C121'::character varying,
    "logo_light_url" "text",
    "logo_dark_url" "text",
    "favicon_url" "text",
    "custom_domain" "text",
    "legal_info" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "dashboard_bg_url" "text",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "deletion_reason" "text",
    "default_revenue_account" "text" DEFAULT '4000'::"text" NOT NULL,
    "nuliga_club_url" "text",
    CONSTRAINT "clubs_billing_unit_minutes_check" CHECK (("billing_unit_minutes" = ANY (ARRAY[45, 60]))),
    CONSTRAINT "clubs_default_payment_method_check" CHECK (("default_payment_method" = ANY (ARRAY['sepa'::"text", 'transfer'::"text", 'cash'::"text", 'stripe'::"text"])))
);

ALTER TABLE ONLY "public"."clubs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."clubs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clubs"."default_hourly_rate" IS 'Default hourly rate for court bookings in this club (in euros)';



COMMENT ON COLUMN "public"."clubs"."features" IS 'Per-club feature flag map. Keys defined in lib/features.ts. Core features (members, trainers, seasons, finance) are immutable and always true.';



COMMENT ON COLUMN "public"."clubs"."primary_color" IS 'Brand primary color (hex)';



COMMENT ON COLUMN "public"."clubs"."secondary_color" IS 'Brand secondary color (hex)';



COMMENT ON COLUMN "public"."clubs"."accent_color" IS 'Brand accent color (hex)';



COMMENT ON COLUMN "public"."clubs"."logo_light_url" IS 'Logo URL for light mode';



COMMENT ON COLUMN "public"."clubs"."logo_dark_url" IS 'Logo URL for dark mode';



COMMENT ON COLUMN "public"."clubs"."favicon_url" IS 'Custom favicon URL';



COMMENT ON COLUMN "public"."clubs"."custom_domain" IS 'Custom domain for white-label';



COMMENT ON COLUMN "public"."clubs"."dashboard_bg_url" IS 'Cover photo shown behind the admin dashboard hero (e.g. club grounds)';



COMMENT ON COLUMN "public"."clubs"."deleted_at" IS 'Soft-Delete: Zeitpunkt der Markierung. NULL = aktiv.';



COMMENT ON COLUMN "public"."clubs"."deleted_by" IS 'Soft-Delete: User, der die Löschung ausgelöst hat (FK auf users.id). NULL = aktiv oder Hard-Delete.';



COMMENT ON COLUMN "public"."clubs"."deletion_reason" IS 'Optionaler Freitext aus Löschdialog (z. B. "DSGVO-Anfrage", "Vereinsauflösung").';



COMMENT ON COLUMN "public"."clubs"."nuliga_club_url" IS 'nuLiga-Vereinsseite (…/wa/clubTeams?club=<nr>). Quelle der Mannschaftsübersicht und zugleich die Datenschutz-Grenze für den Kader-Import: nur hier gelistete Mannschaftsportraits dürfen Spielernamen liefern.';



CREATE TABLE IF NOT EXISTS "public"."contact_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "club_name" "text",
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contact_requests_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'converted'::"text", 'archived'::"text"])))
);

ALTER TABLE ONLY "public"."contact_requests" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "code" character varying(20) NOT NULL,
    "discount_type" character varying(20) NOT NULL,
    "discount_value" numeric(10,2) NOT NULL,
    "max_uses" integer,
    "used_count" integer DEFAULT 0,
    "min_amount" numeric(10,2),
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."coupons" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."court_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "court_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_available" boolean DEFAULT true,
    "valid_from" "date",
    "valid_until" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "court_availability_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);

ALTER TABLE ONLY "public"."court_availability" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."court_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."court_closures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "court_id" "uuid" NOT NULL,
    "reason" character varying(50) NOT NULL,
    "description" "text",
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "weather_condition" character varying(50),
    "auto_generated" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "match_day_id" "uuid"
);

ALTER TABLE ONLY "public"."court_closures" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."court_closures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."court_maintenance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "court_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "text" DEFAULT 'geplant'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."court_maintenance" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."court_maintenance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."court_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "surface_type" "text",
    "is_indoor" boolean DEFAULT false,
    "is_outdoor" boolean DEFAULT true,
    "requires_lighting" boolean DEFAULT false,
    "max_players" integer DEFAULT 2,
    "hourly_rate" numeric(10,2),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "court_types_surface_type_check" CHECK (("surface_type" = ANY (ARRAY['hard'::"text", 'clay'::"text", 'grass'::"text", 'carpet'::"text", 'artificial_grass'::"text"])))
);

ALTER TABLE ONLY "public"."court_types" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."court_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "surface" character varying(20) DEFAULT 'hard'::character varying NOT NULL,
    "has_indoor" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "court_type_id" "uuid",
    "has_lighting" boolean DEFAULT false,
    "number" integer,
    "location" "text",
    "description" "text",
    "status" "text" DEFAULT 'active'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "usable_for_training" boolean DEFAULT true NOT NULL,
    CONSTRAINT "courts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'maintenance'::"text"])))
);

ALTER TABLE ONLY "public"."courts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."courts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."decision_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "decision_id" "uuid" NOT NULL,
    "action" "public"."decision_change_action" NOT NULL,
    "actor_id" "uuid",
    "actor_label_snapshot" "text",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."decision_changes" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."decision_changes" OWNER TO "postgres";


COMMENT ON TABLE "public"."decision_changes" IS 'Append-only Audit-Log für board_decisions. BGB §32 Abs. 2: Protokollierungspflicht.';



COMMENT ON COLUMN "public"."decision_changes"."actor_id" IS 'Optional: User-UUID. Null = System-/Cronjob-Aktion oder nach DSGVO-Löschung anonymisiert.';



COMMENT ON COLUMN "public"."decision_changes"."actor_label_snapshot" IS 'Anzeigename des Actors zum Audit-Zeitpunkt. Bleibt erhalten, auch wenn User gelöscht wird (DSGVO-konformer Audit-Trail).';



COMMENT ON COLUMN "public"."decision_changes"."old_values" IS 'Vollständiger Zustand des Beschlusses VOR der Änderung (NULL bei INSERT).';



COMMENT ON COLUMN "public"."decision_changes"."new_values" IS 'Vollständiger Zustand des Beschlusses NACH der Änderung.';



COMMENT ON COLUMN "public"."decision_changes"."details" IS 'Optionale Kontextdaten: user_agent, ip_address, notes, etc.';



CREATE TABLE IF NOT EXISTS "public"."decision_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "decision_id" "uuid" NOT NULL,
    "voter_id" "uuid" NOT NULL,
    "choice" "public"."vote_choice" NOT NULL,
    "voted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."decision_votes" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."decision_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dunning_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "level" smallint DEFAULT 1,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "due_date" "date",
    "fee_amount" numeric(10,2) DEFAULT 0,
    "notes" "text",
    "club_id" "uuid" NOT NULL,
    "member_id" "uuid",
    "status" character varying(20) DEFAULT 'sent'::character varying,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "original_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "escalated_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "interest_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "interest_days" integer DEFAULT 0 NOT NULL,
    "is_b2b" boolean DEFAULT false NOT NULL,
    "base_rate_applied" numeric(5,4) DEFAULT 0 NOT NULL,
    "total_due" numeric(10,2) DEFAULT 0 NOT NULL,
    "legal_basis" character varying(255)
);

ALTER TABLE ONLY "public"."dunning_records" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."dunning_records" OWNER TO "postgres";


COMMENT ON COLUMN "public"."dunning_records"."interest_amount" IS 'Berechnete Verzugszinsen nach §288 BGB (B2C: Basis+5PP, B2B: Basis+9PP), ACT/360.';



COMMENT ON COLUMN "public"."dunning_records"."is_b2b" IS 'TRUE für Unternehmen (§288 Abs. 2 BGB), FALSE für Verbraucher (§288 Abs. 1 BGB).';



COMMENT ON COLUMN "public"."dunning_records"."total_due" IS 'principal + fee_amount + interest_amount — Anzeigewert im Mahnbrief.';



CREATE TABLE IF NOT EXISTS "public"."email_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "subject" character varying(255) NOT NULL,
    "body" "text" NOT NULL,
    "target_group" character varying(100) DEFAULT 'all'::character varying,
    "recipient_count" integer DEFAULT 0,
    "status" character varying(20) DEFAULT 'queued'::character varying,
    "scheduled_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);

ALTER TABLE ONLY "public"."email_campaigns" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "campaign_id" "uuid",
    "recipient_email" character varying(255) NOT NULL,
    "recipient_name" character varying(255),
    "subject" character varying(255) NOT NULL,
    "body" "text" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "sent_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."email_queue" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family_group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "relationship" character varying(50) DEFAULT 'family'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "role" character varying(20) DEFAULT 'member'::character varying,
    "parent_pin_hash" character varying(255),
    CONSTRAINT "family_accounts_role_check" CHECK ((("role")::"text" = ANY (ARRAY[('parent'::character varying)::"text", ('child'::character varying)::"text", ('member'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."family_accounts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family_group_id" "uuid" NOT NULL,
    "code" character varying(20) NOT NULL,
    "is_used" boolean DEFAULT false,
    "used_by" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval)
);

ALTER TABLE ONLY "public"."family_invites" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gamification_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" character varying(255),
    "icon" character varying(20) DEFAULT '⭐'::character varying,
    "earned_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."gamification_badges" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."gamification_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gamification_points" (
    "user_id" "uuid" NOT NULL,
    "points" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."gamification_points" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."gamification_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "level" character varying(100),
    "age_group" character varying(100),
    "description" "text",
    "max_members" integer DEFAULT 20,
    "member_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "max_size" integer
);

ALTER TABLE ONLY "public"."groups" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."groups"."max_size" IS 'Optionale individuelle Kapazitaet dieser Gruppe. NULL = globaler Default aus season_planning_configs (group_max_size / kids_group_max_size).';



CREATE TABLE IF NOT EXISTS "public"."hours_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "trainer_name" character varying(255) NOT NULL,
    "session_id" "uuid",
    "date" timestamp with time zone NOT NULL,
    "start_time" character varying(5) NOT NULL,
    "end_time" character varying(5) NOT NULL,
    "duration" integer NOT NULL,
    "type" character varying(20) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "notes" "text",
    "approved_by" character varying(100),
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "club_id" "uuid",
    "rejection_reason" "text",
    CONSTRAINT "hours_logs_duration_check" CHECK ((("duration" >= 0) AND ("duration" <= 720))),
    CONSTRAINT "hours_logs_end_time_check" CHECK ((("end_time")::"text" ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'::"text")),
    CONSTRAINT "hours_logs_start_time_check" CHECK ((("start_time")::"text" ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'::"text")),
    CONSTRAINT "hours_logs_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('approved'::character varying)::"text", ('rejected'::character varying)::"text"]))),
    CONSTRAINT "hours_logs_time_order" CHECK ((("start_time")::"text" < ("end_time")::"text")),
    CONSTRAINT "hours_logs_type_check" CHECK ((("type")::"text" = ANY (ARRAY[('training'::character varying)::"text", ('preparation'::character varying)::"text", ('meeting'::character varying)::"text", ('other'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."hours_logs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."hours_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."hours_logs" IS 'Trainer time tracking (hours worked per session)';



COMMENT ON COLUMN "public"."hours_logs"."duration" IS 'Duration in minutes (calculated: end_time - start_time)';



COMMENT ON COLUMN "public"."hours_logs"."type" IS 'Type: training (teaching), preparation (lesson planning), meeting (staff), other';



COMMENT ON COLUMN "public"."hours_logs"."status" IS 'Status: pending (awaiting approval), approved, rejected';



CREATE TABLE IF NOT EXISTS "public"."invoice_installments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "installment_number" integer NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "due_date" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    "payment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoice_installments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'overdue'::"text"])))
);

ALTER TABLE ONLY "public"."invoice_installments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_installments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric(10,2) DEFAULT 1,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) GENERATED ALWAYS AS (("quantity" * "unit_price")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "datev_account_number" "text",
    "item_type" character varying(20) NOT NULL,
    "tax_rate" numeric(5,2) DEFAULT 19.00 NOT NULL,
    "reference_id" "uuid",
    "reference_type" character varying(50),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recalc_required_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."invoice_items" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."invoice_items"."recalc_required_at" IS 'Non-null timestamp set by the season_plan_entries recalc trigger. NULL means the line item is in sync with its referenced plan entry. Non-null means the pricing engine should re-evaluate the line on next billing-cycle run. Cleared (=NULL) by the pricing engine after recompute.';



CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "member_id" "uuid",
    "trainer_id" "uuid",
    "invoice_number" "text" NOT NULL,
    "amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(10,2) DEFAULT 0,
    "currency" "text" DEFAULT 'EUR'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "due_date" "date",
    "paid_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "invoice_type" "text" DEFAULT 'adhoc'::"text",
    "season_id" "uuid",
    "sent_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" character varying(50),
    "subtotal" numeric(10,2) DEFAULT 0 NOT NULL,
    "invoice_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "paid_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "invoices_invoice_type_check" CHECK (("invoice_type" = ANY (ARRAY['season'::"text", 'membership'::"text", 'adhoc'::"text"]))),
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'sent'::"text", 'partially_paid'::"text", 'paid'::"text", 'overdue'::"text", 'dunning'::"text", 'reminder_sent'::"text", 'cancelled'::"text", 'void'::"text", 'uncollectible'::"text", 'refunded'::"text"])))
);

ALTER TABLE ONLY "public"."invoices" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_execution_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "execution_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "execution_completed_at" timestamp with time zone,
    "execution_duration_ms" integer,
    "success" boolean DEFAULT false NOT NULL,
    "result" "jsonb" DEFAULT '{}'::"jsonb",
    "error_message" "text",
    "stack_trace" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."job_execution_log" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_execution_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_execution_log" IS 'Execution history for background jobs';



CREATE TABLE IF NOT EXISTS "public"."league_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "member_id" "uuid",
    "name" character varying(200) NOT NULL,
    "lk" character varying(10),
    "position_number" integer,
    "source_url" "text",
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."league_players" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."league_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leagues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "name" character varying(200) NOT NULL,
    "season_year" integer NOT NULL,
    "league_type" character varying(50) DEFAULT 'regular'::character varying NOT NULL,
    "division" character varying(100),
    "sport" character varying(50) DEFAULT 'tennis'::character varying NOT NULL,
    "age_group" character varying(50),
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nuliga_url" "text",
    "last_synced_at" timestamp with time zone,
    "own_team_name" character varying(200),
    "nuliga_roster_url" "text"
);

ALTER TABLE ONLY "public"."leagues" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."leagues" OWNER TO "postgres";


COMMENT ON COLUMN "public"."leagues"."nuliga_url" IS 'Full nuLiga groupPage URL (e.g. https://htv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/groupPage?championship=...&group=...). Used by the sync service to pull standings and match results.';



COMMENT ON COLUMN "public"."leagues"."last_synced_at" IS 'Timestamp of the last successful sync from nuLiga.';



COMMENT ON COLUMN "public"."leagues"."own_team_name" IS 'Name der eigenen Mannschaft exakt wie in der nuLiga-Tabelle, z. B. "TC Rheinland II". Steuert den Spielplan-Filter im Sync.';



CREATE TABLE IF NOT EXISTS "public"."match_caterings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_day_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "status" "public"."catering_status" DEFAULT 'not_planned'::"public"."catering_status" NOT NULL,
    "organizer_name" "text",
    "expected_guests" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "match_caterings_expected_guests_check" CHECK (("expected_guests" >= 0))
);

ALTER TABLE ONLY "public"."match_caterings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_caterings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "matchday_number" integer NOT NULL,
    "scheduled_date" timestamp with time zone,
    "opponent" character varying(200) NOT NULL,
    "is_home" boolean DEFAULT true NOT NULL,
    "venue" "text",
    "result" character varying(20),
    "score_home" integer,
    "score_away" integer,
    "notes" "text",
    "status" character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nuliga_report_url" "text"
);

ALTER TABLE ONLY "public"."match_days" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_days" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_day_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "position_number" smallint NOT NULL,
    "position_type" "public"."match_position_type" NOT NULL,
    "home_player_ids" "uuid"[] NOT NULL,
    "away_player_ids" "uuid"[] NOT NULL,
    "home_sets_won" smallint DEFAULT 0 NOT NULL,
    "away_sets_won" smallint DEFAULT 0 NOT NULL,
    "set_scores" "jsonb",
    "outcome" "public"."match_outcome" DEFAULT 'not_played'::"public"."match_outcome" NOT NULL,
    "notes" "text",
    "recorded_by" "uuid",
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "match_results_away_sets_won_check" CHECK ((("away_sets_won" >= 0) AND ("away_sets_won" <= 3))),
    CONSTRAINT "match_results_check" CHECK (((("position_type" = 'singles'::"public"."match_position_type") AND ("array_length"("home_player_ids", 1) = 1)) OR (("position_type" = 'doubles'::"public"."match_position_type") AND ("array_length"("home_player_ids", 1) = 2)))),
    CONSTRAINT "match_results_check1" CHECK (((("position_type" = 'singles'::"public"."match_position_type") AND ("array_length"("away_player_ids", 1) = 1)) OR (("position_type" = 'doubles'::"public"."match_position_type") AND ("array_length"("away_player_ids", 1) = 2)))),
    CONSTRAINT "match_results_home_sets_won_check" CHECK ((("home_sets_won" >= 0) AND ("home_sets_won" <= 3))),
    CONSTRAINT "match_results_notes_check" CHECK (("char_length"("notes") <= 2000)),
    CONSTRAINT "match_results_position_number_check" CHECK ((("position_number" >= 1) AND ("position_number" <= 8)))
);

ALTER TABLE ONLY "public"."match_results" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_results" OWNER TO "postgres";


COMMENT ON TABLE "public"."match_results" IS 'Detaillierte Spielberichte pro Medenspiel-Spieltag (6 Einzel + 2 Doppel).';



COMMENT ON COLUMN "public"."match_results"."position_number" IS '1-6 = Einzel, 7-8 = Doppel. tennisübliche Reihenfolge.';



COMMENT ON COLUMN "public"."match_results"."set_scores" IS 'JSONB-Array der Satzstände: [{ home, away, tiebreak? }, ...] für Verband-Spielbericht.';



CREATE TABLE IF NOT EXISTS "public"."matchday_reminder_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "matchday_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "provider_message_id" "text",
    "payload" "jsonb",
    "is_succeeded" boolean DEFAULT true NOT NULL,
    "error_message" "text",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "matchday_reminder_logs_channel_check" CHECK (("channel" = ANY (ARRAY['push'::"text", 'email'::"text", 'sms'::"text", 'whatsapp'::"text"])))
);

ALTER TABLE ONLY "public"."matchday_reminder_logs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."matchday_reminder_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."matchday_reminder_logs" IS 'F2: Audit-log fuer Spieltag-Erinnerungen (multi-channel: push, email, sms, whatsapp). UNIQUE(matchday_id, user_id, channel) garantiert Idempotenz gegen Cron-Retries.';



COMMENT ON COLUMN "public"."matchday_reminder_logs"."channel" IS 'push | email | sms | whatsapp — Channel-Name passend zu notification_consents.channel';



COMMENT ON COLUMN "public"."matchday_reminder_logs"."is_succeeded" IS 'false = Versand fehlgeschlagen (Provider-Error). Audit-Trail bleibt erhalten.';



CREATE TABLE IF NOT EXISTS "public"."meeting_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "decision_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "status" "public"."invitation_status" DEFAULT 'pending'::"public"."invitation_status" NOT NULL,
    "responded_at" timestamp with time zone,
    "response_note" "text",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reminded_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."meeting_invitations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_balance_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_balance_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "reason" "text" NOT NULL,
    "reference_type" "text",
    "reference_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "member_balance_entries_reference_type_check" CHECK (("reference_type" = ANY (ARRAY['group_change'::"text", 'invoice'::"text", 'payment'::"text", 'manual'::"text"])))
);

ALTER TABLE ONLY "public"."member_balance_entries" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_balance_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "balance" numeric(10,2) DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."member_balances" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_booking_preferences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "preferred_courts" "uuid"[] DEFAULT '{}'::"uuid"[],
    "preferred_time_slots" "jsonb" DEFAULT '[]'::"jsonb",
    "preferred_partners" "uuid"[] DEFAULT '{}'::"uuid"[],
    "avoid_partners" "uuid"[] DEFAULT '{}'::"uuid"[],
    "notification_preferences" "jsonb" DEFAULT '{"reminder_1h": false, "reminder_24h": true, "booking_cancelled": true, "booking_confirmed": true, "waitlist_available": true}'::"jsonb",
    "auto_cancel_no_show" boolean DEFAULT false NOT NULL,
    "default_booking_duration" integer DEFAULT 90 NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."member_booking_preferences" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_booking_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."member_booking_preferences" IS 'User preferences for court bookings and notifications';



CREATE TABLE IF NOT EXISTS "public"."member_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "meeting_date" timestamp with time zone NOT NULL,
    "location" "text",
    "description" "text",
    "status" "text" DEFAULT 'geplant'::"text" NOT NULL,
    "agenda" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."member_meetings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_schedule_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "preferred_level" character varying(20),
    "preferred_age_group" character varying(20),
    "weekly_availability" "jsonb" DEFAULT '{"friday": [], "monday": [], "sunday": [], "tuesday": [], "saturday": [], "thursday": [], "wednesday": []}'::"jsonb" NOT NULL,
    "wish_partner_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "preferred_trainer_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "preferred_court_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "max_sessions_per_week" integer,
    "special_requests" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."member_schedule_preferences" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_schedule_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "club_id" "uuid",
    "subject" character varying(255) NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "replied_to_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "broadcast_type" "text",
    "archived_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "sender_deleted_at" timestamp with time zone,
    CONSTRAINT "messages_broadcast_type_check" CHECK ((("broadcast_type" = ANY (ARRAY['all'::"text", 'trainers'::"text", 'members'::"text"])) OR ("broadcast_type" IS NULL)))
);

ALTER TABLE ONLY "public"."messages" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Internal messaging between club members';



COMMENT ON COLUMN "public"."messages"."archived_at" IS 'Empfänger hat die Nachricht archiviert. Posteingang zeigt nur archived_at IS NULL.';



COMMENT ON COLUMN "public"."messages"."deleted_at" IS 'Empfänger hat die Nachricht gelöscht (soft). Für den Empfänger überall unsichtbar.';



COMMENT ON COLUMN "public"."messages"."sender_deleted_at" IS 'Absender hat die Nachricht aus dem Ordner „Gesendet" entfernt (soft).';



CREATE TABLE IF NOT EXISTS "public"."news_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "news_post_id" "uuid",
    "is_edited" boolean DEFAULT false,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."news_comments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."news_comments" OWNER TO "postgres";


COMMENT ON TABLE "public"."news_comments" IS 'Comments on news posts';



CREATE TABLE IF NOT EXISTS "public"."news_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "title" "text" NOT NULL,
    "content" "text",
    "excerpt" "text",
    "is_published" boolean DEFAULT false,
    "is_pinned" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" character varying(250),
    "cover_image_url" "text",
    "category" character varying(50) DEFAULT 'general'::character varying,
    "status" character varying(20) DEFAULT 'draft'::character varying,
    "tags" "text"[],
    "view_count" integer DEFAULT 0
);

ALTER TABLE ONLY "public"."news_posts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."news_posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."news_posts" IS 'News posts and announcements for clubs';



COMMENT ON COLUMN "public"."news_posts"."is_pinned" IS 'Pinned posts appear at the top';



COMMENT ON COLUMN "public"."news_posts"."slug" IS 'URL-friendly identifier';



COMMENT ON COLUMN "public"."news_posts"."category" IS 'general, event, announcement, tournament, training, maintenance';



COMMENT ON COLUMN "public"."news_posts"."status" IS 'draft, published, or archived';



CREATE TABLE IF NOT EXISTS "public"."newsletter_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "template" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body_html" "text" NOT NULL,
    "recipient_count" integer DEFAULT 0 NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."newsletter_campaigns" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_send_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "error_message" "text",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."newsletter_send_logs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_send_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_consents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel" character varying(20) NOT NULL,
    "is_opted_in" boolean DEFAULT false NOT NULL,
    "consented_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "consent_source" character varying(100),
    "privacy_policy_version" character varying(20),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_consents_channel_check" CHECK ((("channel")::"text" = ANY (ARRAY[('sms'::character varying)::"text", ('whatsapp'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."notification_consents" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_consents" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_consents" IS 'F9 DSGVO/TTDSG Audit: Per-User Per-Channel Opt-In für SMS und WhatsApp. Default false (KEIN Default-Opt-In). Vor dem Versand ist ein aktiver Eintrag Pflicht.';



COMMENT ON COLUMN "public"."notification_consents"."is_opted_in" IS 'Aktueller Opt-In-Status. Default false — Hinzufügen ist explizite Aktion des Mitglieds über /api/notifications/consents.';



COMMENT ON COLUMN "public"."notification_consents"."consented_at" IS 'Timestamp der Einwilligung (DSGVO Art. 7 Beweislast). NULL bis Opt-In aktiviert.';



COMMENT ON COLUMN "public"."notification_consents"."revoked_at" IS 'Widerruf-Timestamp. Soft-Withdraw: revoked_at != NULL überschreibt is_opted_in → kein Versand.';



COMMENT ON COLUMN "public"."notification_consents"."consent_source" IS 'Quelle der Einwilligung (settings_page | api | cron-import). DSGVO Art. 7 Audit-Pflicht.';



COMMENT ON COLUMN "public"."notification_consents"."privacy_policy_version" IS 'Verweis auf Datenschutzerklärung-Stand zum Zeitpunkt der Einwilligung. DSGVO Art. 7.';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "club_id" "uuid",
    "title" "text" NOT NULL,
    "message" "text",
    "type" "text" DEFAULT 'info'::"text",
    "read" boolean DEFAULT false,
    "action_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "link" character varying(500),
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['info'::"text", 'warning'::"text", 'success'::"text", 'error'::"text", 'booking'::"text", 'invoice'::"text", 'training'::"text", 'booking_cancelled'::"text", 'booking_reactivated'::"text", 'waitlist'::"text", 'waitlist_promoted'::"text", 'absence_alert'::"text", 'membership_created'::"text", 'member_deactivated'::"text", 'message_received'::"text", 'billing'::"text"])))
);

ALTER TABLE ONLY "public"."notifications" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON CONSTRAINT "notifications_type_check" ON "public"."notifications" IS 'Erlaubte Benachrichtigungstypen. Neue Typen im Code brauchen hier einen Eintrag — sonst schlaegt der Insert still fehl (siehe Migration 20260813090000).';



CREATE TABLE IF NOT EXISTS "public"."nuliga_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'success'::character varying NOT NULL,
    "trigger" character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    "teams_created" integer DEFAULT 0 NOT NULL,
    "teams_updated" integer DEFAULT 0 NOT NULL,
    "matches_created" integer DEFAULT 0 NOT NULL,
    "matches_updated" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "nuliga_url" "text" NOT NULL,
    "nuliga_group_name" character varying(300),
    "nuliga_championship" character varying(300),
    "started_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."nuliga_sync_log" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."nuliga_sync_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."nuliga_sync_log" IS 'Audit log for nuLiga sync operations. Tracks every sync attempt with results and errors.';



CREATE TABLE IF NOT EXISTS "public"."open_match_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'player'::"text" NOT NULL,
    "status" "text" DEFAULT 'joined'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "open_match_participants_role_check" CHECK (("role" = ANY (ARRAY['creator'::"text", 'player'::"text"]))),
    CONSTRAINT "open_match_participants_status_check" CHECK (("status" = ANY (ARRAY['joined'::"text", 'left'::"text", 'kicked'::"text"])))
);

ALTER TABLE ONLY "public"."open_match_participants" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."open_match_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."open_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "court_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "match_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "skill_level" "text" DEFAULT 'all'::"text" NOT NULL,
    "match_type" "text" DEFAULT 'singles'::"text" NOT NULL,
    "max_players" integer DEFAULT 2 NOT NULL,
    "current_players" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "open_matches_match_type_check" CHECK (("match_type" = ANY (ARRAY['singles'::"text", 'doubles'::"text", 'mixed'::"text", 'social'::"text"]))),
    CONSTRAINT "open_matches_max_players_check" CHECK ((("max_players" >= 2) AND ("max_players" <= 12))),
    CONSTRAINT "open_matches_skill_level_check" CHECK (("skill_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text", 'tournament'::"text", 'all'::"text"]))),
    CONSTRAINT "open_matches_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'full'::"text", 'cancelled'::"text", 'completed'::"text", 'expired'::"text"])))
);

ALTER TABLE ONLY "public"."open_matches" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."open_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "gateway" character varying(20) NOT NULL,
    "gateway_name" character varying(100) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "supported_currencies" "text"[] NOT NULL,
    "supported_methods" "text"[] NOT NULL,
    "min_amount" numeric(10,2),
    "max_amount" numeric(10,2),
    "fees" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_settings_gateway_check" CHECK ((("gateway")::"text" = ANY (ARRAY[('stripe'::character varying)::"text", ('paypal'::character varying)::"text", ('sepa'::character varying)::"text", ('cash'::character varying)::"text", ('other'::character varying)::"text"]))),
    CONSTRAINT "payment_settings_max_amount_check" CHECK (("max_amount" >= (0)::numeric)),
    CONSTRAINT "payment_settings_min_amount_check" CHECK (("min_amount" >= (0)::numeric)),
    CONSTRAINT "valid_amount_range" CHECK ((("min_amount" IS NULL) OR ("max_amount" IS NULL) OR ("min_amount" <= "max_amount"))),
    CONSTRAINT "valid_currencies" CHECK (("array_length"("supported_currencies", 1) > 0)),
    CONSTRAINT "valid_methods" CHECK (("array_length"("supported_methods", 1) > 0))
);

ALTER TABLE ONLY "public"."payment_settings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_settings" IS 'RLS policies updated: club_members → is_club_admin() helper function (20260625)';



COMMENT ON COLUMN "public"."payment_settings"."gateway" IS 'Payment gateway type: stripe, paypal, sepa, cash, or other';



COMMENT ON COLUMN "public"."payment_settings"."is_default" IS 'Whether this is the default payment gateway for the club';



COMMENT ON COLUMN "public"."payment_settings"."config" IS 'JSONB configuration (API keys, merchant IDs, webhook URLs)';



COMMENT ON COLUMN "public"."payment_settings"."supported_currencies" IS 'Array of supported currency codes (e.g., EUR, USD)';



COMMENT ON COLUMN "public"."payment_settings"."supported_methods" IS 'Array of supported payment methods (e.g., card, sepa_debit, paypal)';



COMMENT ON COLUMN "public"."payment_settings"."fees" IS 'JSONB fee structure with fixed and percentage components';



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text",
    "payment_method" "text" DEFAULT 'sepa'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "external_id" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['sepa'::"text", 'stripe'::"text", 'cash'::"text", 'transfer'::"text", 'other'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'refunded'::"text"])))
);

ALTER TABLE ONLY "public"."payments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planning_conflicts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "conflict_type" character varying(50) NOT NULL,
    "severity" character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    "affected_plan_entry_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "affected_trainer_id" "uuid",
    "affected_court_id" "uuid",
    "affected_user_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "affected_group_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "conflict_time_slot" "jsonb",
    "description" "text" NOT NULL,
    "suggested_resolution" "text",
    "status" character varying(20) DEFAULT 'open'::character varying NOT NULL,
    "resolved_at" timestamp without time zone,
    "resolved_by" "uuid",
    "resolution_notes" "text",
    "resolution_action" character varying(50),
    "detected_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "detection_source" character varying(20) DEFAULT 'auto_planner'::character varying,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "planning_conflicts_conflict_type_check" CHECK ((("conflict_type")::"text" = ANY ((ARRAY['trainer_double_booking'::character varying, 'member_double_booking'::character varying, 'no_trainer_assigned'::character varying, 'court_unavailable'::character varying, 'trainer_over_limit'::character varying, 'high_failure_rate_slot'::character varying, 'large_niveau_span'::character varying, 'avoid_partner_conflict'::character varying, 'no_court_assigned'::character varying, 'member_unavailable'::character varying, 'member_unplanned'::character varying])::"text"[]))),
    CONSTRAINT "planning_conflicts_detection_source_check" CHECK ((("detection_source")::"text" = ANY (ARRAY[('auto_planner'::character varying)::"text", ('manual_check'::character varying)::"text", ('user_report'::character varying)::"text", ('system'::character varying)::"text"]))),
    CONSTRAINT "planning_conflicts_severity_check" CHECK ((("severity")::"text" = ANY (ARRAY[('critical'::character varying)::"text", ('warning'::character varying)::"text", ('info'::character varying)::"text"]))),
    CONSTRAINT "planning_conflicts_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('open'::character varying)::"text", ('investigating'::character varying)::"text", ('resolved'::character varying)::"text", ('ignored'::character varying)::"text", ('wont_fix'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."planning_conflicts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."planning_conflicts" OWNER TO "postgres";


COMMENT ON TABLE "public"."planning_conflicts" IS 'Detected scheduling conflicts during planning';



CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" "uuid" NOT NULL,
    "elo_rating" integer DEFAULT 1200 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."players" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."players" OWNER TO "postgres";


COMMENT ON TABLE "public"."players" IS 'ELO-Rating pro Spieler. IDs müssen mit match_results.home_player_ids / away_player_ids übereinstimmen.';



COMMENT ON COLUMN "public"."players"."elo_rating" IS 'Standard-ELO (K=32, Startwert 1200). Wird durch Trigger update_elo_after_match aktualisiert.';



CREATE TABLE IF NOT EXISTS "public"."pricing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "rule_type" "text" DEFAULT 'hourly'::"text",
    "price_per_hour" numeric(10,2) DEFAULT 0,
    "applies_to" "text" DEFAULT 'all'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "time_ranges" "jsonb" DEFAULT '[]'::"jsonb",
    "days_of_week" smallint[],
    "season_id" "uuid",
    "valid_from" timestamp with time zone,
    "valid_until" timestamp with time zone,
    "description" "text"
);

ALTER TABLE ONLY "public"."pricing_rules" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_rules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pricing_rules"."time_ranges" IS 'Array of {start: "HH:MM", end: "HH:MM", price_multiplier: number} for time-of-day pricing';



COMMENT ON COLUMN "public"."pricing_rules"."days_of_week" IS 'Array of day numbers (0=Sunday, 6=Saturday). NULL = all days.';



COMMENT ON COLUMN "public"."pricing_rules"."season_id" IS 'Optional link to a season — rule only active during that season';



COMMENT ON COLUMN "public"."pricing_rules"."valid_from" IS 'Optional start date for rule validity';



COMMENT ON COLUMN "public"."pricing_rules"."valid_until" IS 'Optional end date for rule validity';



CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."push_subscriptions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qr_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "checked_in_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."qr_checkins" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."qr_checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "trainer_name" character varying(100) NOT NULL,
    "old_rate" numeric(10,2) NOT NULL,
    "new_rate" numeric(10,2) NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by" character varying(100) NOT NULL,
    "reason" "text",
    CONSTRAINT "rate_history_new_rate_positive" CHECK (("new_rate" > (0)::numeric)),
    CONSTRAINT "rate_history_old_rate_positive" CHECK (("old_rate" > (0)::numeric))
);

ALTER TABLE ONLY "public"."rate_history" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."rate_history" IS 'Audit trail for all trainer rate changes';



CREATE TABLE IF NOT EXISTS "public"."registration_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "first_name" character varying(100) NOT NULL,
    "last_name" character varying(100) NOT NULL,
    "email" character varying(255) NOT NULL,
    "phone" character varying(30),
    "street" character varying(255),
    "city" character varying(100),
    "postal_code" character varying(10),
    "playing_level" character varying(30) DEFAULT 'intermediate'::character varying,
    "previous_club" character varying(255),
    "motivation" "text",
    "wants_trial_training" boolean DEFAULT true,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "rejection_reason" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."registration_requests" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."registration_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "season_type" character varying(20) NOT NULL,
    "season_year" integer NOT NULL,
    "season_start_date" timestamp without time zone NOT NULL,
    "season_end_date" timestamp without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."schedules" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."schedules" IS 'Trainings-Schedules (one per club, typically per season). club_id is the canonical tenant boundary. RLS corrected 20260626: was using id = ANY(get_user_club_ids()) which is wrong — should be club_id.';



CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "filename" "text" NOT NULL,
    "checksum" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_by" "text" DEFAULT CURRENT_USER NOT NULL,
    "baselined" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."schema_migrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."schema_migrations" IS 'Welche Datei aus supabase/migrations/ auf dieser DB gelaufen ist. Gepflegt von scripts/migrate.ts.';



CREATE TABLE IF NOT EXISTS "public"."school_holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bundesland" "text" NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "year" integer NOT NULL
);

ALTER TABLE ONLY "public"."school_holidays" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."school_holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."season_billing_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "trainer_hourly_rate" numeric(10,2) DEFAULT 50.00 NOT NULL,
    "use_trainer_profile_rate" boolean DEFAULT false NOT NULL,
    "include_membership_fee" boolean DEFAULT true NOT NULL,
    "membership_fee_amount" numeric(10,2),
    "membership_fee_type" character varying(20) DEFAULT 'yearly'::character varying,
    "payment_terms_days" integer DEFAULT 30 NOT NULL,
    "invoice_notes" "text",
    "tax_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "cost_split_method" character varying(20) DEFAULT 'per_participant'::character varying NOT NULL,
    "additional_fees" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "billing_model" character varying(30) DEFAULT 'per_session'::character varying NOT NULL,
    CONSTRAINT "season_billing_configs_cost_split_method_check" CHECK ((("cost_split_method")::"text" = ANY (ARRAY[('per_participant'::character varying)::"text", ('flat_rate'::character varying)::"text", ('per_group'::character varying)::"text"]))),
    CONSTRAINT "season_billing_configs_membership_fee_type_check" CHECK ((("membership_fee_type")::"text" = ANY (ARRAY[('yearly'::character varying)::"text", ('seasonal'::character varying)::"text", ('monthly'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."season_billing_configs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."season_billing_configs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."season_billing_configs"."billing_model" IS 'per_session=Trainer-Stundensatz/Teilnehmer, membership_included=kein Rechnungs-Gen, block_of_10=Zehner-Block';



CREATE TABLE IF NOT EXISTS "public"."season_group_weeks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "season_id" "uuid" NOT NULL,
    "week_monday" "date" NOT NULL,
    "week_number" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "season_group_weeks_week_number_check" CHECK ((("week_number" >= 1) AND ("week_number" <= 53)))
);

ALTER TABLE ONLY "public"."season_group_weeks" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."season_group_weeks" OWNER TO "postgres";


COMMENT ON TABLE "public"."season_group_weeks" IS 'Per-group per-week active/inactive flag for a season. Drives session filtering and billing in season-billing.service.ts. Admin-editable via the Season Calendar UI.';



COMMENT ON COLUMN "public"."season_group_weeks"."week_monday" IS 'ISO date (YYYY-MM-DD) of the Monday that anchors the week. Must be a Monday.';



COMMENT ON COLUMN "public"."season_group_weeks"."week_number" IS 'ISO 8601 calendar week (1-53) for convenience — can be derived from week_monday but is stored for query speed.';



COMMENT ON COLUMN "public"."season_group_weeks"."is_active" IS 'Defaults to true. When false, the week is excluded from session creation (confirm route) and from totalSessions in billing.';



COMMENT ON COLUMN "public"."season_group_weeks"."reason" IS 'Optional human-readable note (e.g. "Sommercamp-Ausfall", "Platz-Renovierung").';



CREATE TABLE IF NOT EXISTS "public"."season_plan_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "court_id" "uuid",
    "group_id" "uuid",
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "duration_minutes" integer NOT NULL,
    "starts_from_week" integer DEFAULT 1 NOT NULL,
    "ends_at_week" integer,
    "entry_type" character varying(20) DEFAULT 'training'::character varying NOT NULL,
    "planning_source" character varying(20) DEFAULT 'auto'::character varying NOT NULL,
    "preference_match_score" numeric(5,2) DEFAULT 0,
    "conflict_score" numeric(5,2) DEFAULT 0,
    "optimization_score" numeric(5,2) DEFAULT 0,
    "max_participants" integer DEFAULT 10 NOT NULL,
    "expected_participants" "jsonb" DEFAULT '[]'::"jsonb",
    "status" character varying(20) DEFAULT 'planned'::character varying NOT NULL,
    "published_session_id" "uuid",
    "published_at" timestamp without time zone,
    "notes" "text",
    "admin_notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "substitute_trainer_id" "uuid",
    "substitute_from_week" integer,
    "substitute_to_week" integer,
    "sessions_per_week" integer DEFAULT 1 NOT NULL,
    "day_of_week_2" integer,
    CONSTRAINT "season_plan_entries_check" CHECK (("end_time" > "start_time")),
    CONSTRAINT "season_plan_entries_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "season_plan_entries_duration_minutes_check" CHECK (("duration_minutes" > 0)),
    CONSTRAINT "season_plan_entries_entry_type_check" CHECK ((("entry_type")::"text" = ANY (ARRAY[('training'::character varying)::"text", ('trial_lesson'::character varying)::"text", ('group_session'::character varying)::"text", ('private_lesson'::character varying)::"text", ('tournament'::character varying)::"text"]))),
    CONSTRAINT "season_plan_entries_planning_source_check" CHECK ((("planning_source")::"text" = ANY (ARRAY[('auto'::character varying)::"text", ('manual'::character varying)::"text", ('imported'::character varying)::"text", ('copied'::character varying)::"text"]))),
    CONSTRAINT "season_plan_entries_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('planned'::character varying)::"text", ('confirmed'::character varying)::"text", ('published'::character varying)::"text", ('active'::character varying)::"text", ('cancelled'::character varying)::"text", ('completed'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."season_plan_entries" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."season_plan_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."season_plan_entries" IS 'Planning entries for training sessions within a season. Generated by auto-planning or created manually.';



COMMENT ON COLUMN "public"."season_plan_entries"."group_id" IS 'Reference to training_groups table';



COMMENT ON COLUMN "public"."season_plan_entries"."substitute_trainer_id" IS 'Vertretungs-Trainer für einen Wochen-Bereich';



COMMENT ON COLUMN "public"."season_plan_entries"."substitute_from_week" IS 'Ab dieser Woche gilt die Vertretung (inklusiv)';



COMMENT ON COLUMN "public"."season_plan_entries"."substitute_to_week" IS 'Bis einschließlich dieser Woche gilt die Vertretung';



COMMENT ON COLUMN "public"."season_plan_entries"."sessions_per_week" IS '1 = once/week (default), 2 = twice/week';



COMMENT ON COLUMN "public"."season_plan_entries"."day_of_week_2" IS 'Day index for second weekly session (0=Mon..6=Sun). NULL = day_of_week+3.';



CREATE TABLE IF NOT EXISTS "public"."season_plan_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "label" character varying(100) NOT NULL,
    "slots" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."season_plan_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."season_planning_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "season_id" "uuid",
    "max_niveau_span_beginner_months" integer DEFAULT 4 NOT NULL,
    "max_niveau_span_advanced_months" integer DEFAULT 8 NOT NULL,
    "trainer_utilization_max_pct" integer DEFAULT 80 NOT NULL,
    "slot_failure_rate_threshold_pct" integer DEFAULT 30 NOT NULL,
    "waitlist_priority_rule" character varying(30) DEFAULT 'registration_time'::character varying NOT NULL,
    "group_min_size" integer DEFAULT 3 NOT NULL,
    "group_max_size" integer DEFAULT 12 NOT NULL,
    "proven_group_attendance_threshold_pct" integer DEFAULT 80 NOT NULL,
    "ai_clustering_enabled" boolean DEFAULT true NOT NULL,
    "prefer_historic_groups" boolean DEFAULT true NOT NULL,
    "avoid_high_failure_slots" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "kids_group_max_size" integer DEFAULT 6 NOT NULL,
    "kids_group_min_size" integer DEFAULT 3 NOT NULL,
    "slot_duration_minutes" integer DEFAULT 90 NOT NULL,
    "unassigned_rate_threshold" numeric DEFAULT 0.05 NOT NULL,
    "treat_high_failure_as_hard" boolean DEFAULT false NOT NULL,
    "backtrack_depth" integer DEFAULT 3 NOT NULL,
    "max_niveau_level_steps" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "season_planning_configs_backtrack_depth_check" CHECK ((("backtrack_depth" >= 0) AND ("backtrack_depth" <= 10))),
    CONSTRAINT "season_planning_configs_unassigned_rate_threshold_check" CHECK ((("unassigned_rate_threshold" >= (0)::numeric) AND ("unassigned_rate_threshold" <= (1)::numeric)))
);

ALTER TABLE ONLY "public"."season_planning_configs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."season_planning_configs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."season_planning_configs"."unassigned_rate_threshold" IS 'Sprint 4 P0 #3 (Adaptive Backtrack): if the unassigned-member rate after the first backtrack pass is still above this threshold (default 5%, range 0..1), the engine runs a second pass with depth=5 to give the algorithm more freedom to re-slot victims. Set to 1.0 to disable the second pass.';



COMMENT ON COLUMN "public"."season_planning_configs"."treat_high_failure_as_hard" IS 'When true, skip slots with failure_rate >= slot_failure_rate_threshold_pct entirely (Optimization #5). Default false preserves the soft -50 score behavior.';



COMMENT ON COLUMN "public"."season_planning_configs"."backtrack_depth" IS 'Anzahl der zuletzt gebildeten Gruppen, die bei nicht zugewiesenen Mitgliedern wieder aufgelöst und neu verplant werden. 0 = kein Backtracking. Default 3.';



CREATE TABLE IF NOT EXISTS "public"."season_planning_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "action_type" character varying(50) NOT NULL,
    "actor_id" "uuid",
    "actor_role" character varying(20),
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "entries_affected" integer DEFAULT 0,
    "conflicts_created" integer DEFAULT 0,
    "conflicts_resolved" integer DEFAULT 0,
    "algorithm_metrics" "jsonb",
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "entity_type" character varying(50),
    "entity_id" "uuid",
    "changed_by" "uuid",
    "changed_by_role" character varying(20),
    "changes" "jsonb",
    CONSTRAINT "season_planning_history_action_type_check" CHECK ((("action_type")::"text" = ANY ((ARRAY['created'::character varying, 'updated'::character varying, 'deleted'::character varying, 'season_created'::character varying, 'preferences_opened'::character varying, 'auto_plan_started'::character varying, 'auto_plan_completed'::character varying, 'plan_published'::character varying, 'season_activated'::character varying, 'season_completed'::character varying, 'manual_edit'::character varying, 'plan_created'::character varying, 'plan_regenerated'::character varying, 'entry_added'::character varying, 'entry_modified'::character varying, 'entry_removed'::character varying, 'conflict_resolved'::character varying, 'preferences_closed'::character varying, 'published'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."season_planning_history" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."season_planning_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."season_planning_history" IS 'Audit trail for all planning actions';



CREATE TABLE IF NOT EXISTS "public"."season_statistics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "total_groups" integer DEFAULT 0 NOT NULL,
    "total_members_planned" integer DEFAULT 0 NOT NULL,
    "avg_group_size" numeric(5,2) DEFAULT '0'::numeric,
    "groups_below_min_size" integer DEFAULT 0 NOT NULL,
    "overall_attendance_quote" numeric(5,2),
    "attendance_by_group" "jsonb" DEFAULT '{}'::"jsonb",
    "attendance_by_trainer" "jsonb" DEFAULT '{}'::"jsonb",
    "slot_failure_rates" "jsonb" DEFAULT '{}'::"jsonb",
    "wish_partner_requests" integer DEFAULT 0 NOT NULL,
    "wish_partner_fulfilled" integer DEFAULT 0 NOT NULL,
    "wish_partner_fulfillment_rate" numeric(5,2),
    "total_waitlist_entries" integer DEFAULT 0 NOT NULL,
    "avg_waitlist_duration_days" numeric(7,2),
    "waitlist_acceptance_rate" numeric(5,2),
    "level_upgrades_recommended" integer DEFAULT 0 NOT NULL,
    "level_upgrades_applied" integer DEFAULT 0 NOT NULL,
    "trainer_utilization_avg" numeric(5,2),
    "trainer_burnout_warnings" integer DEFAULT 0 NOT NULL,
    "total_conflicts_detected" integer DEFAULT 0 NOT NULL,
    "critical_conflicts" integer DEFAULT 0 NOT NULL,
    "conflicts_resolved" integer DEFAULT 0 NOT NULL,
    "preferences_submitted" integer DEFAULT 0 NOT NULL,
    "preferences_total" integer DEFAULT 0 NOT NULL,
    "preference_satisfaction_score" numeric(5,2),
    "niveau_span_violations" integer DEFAULT 0 NOT NULL,
    "avg_niveau_span_months" numeric(5,2),
    "computed_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."season_statistics" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."season_statistics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."season_waitlists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "priority_reason" character varying(50) DEFAULT 'registration_time'::character varying,
    "status" character varying(20) DEFAULT 'waiting'::character varying NOT NULL,
    "registered_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "notified_at" timestamp without time zone,
    "accepted_at" timestamp without time zone,
    "alternative_group_id" "uuid",
    "alternative_assigned_at" timestamp without time zone,
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."season_waitlists" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."season_waitlists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seasons" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "season_type" character varying(20) NOT NULL,
    "year" integer NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "planning_status" character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    "preferences_deadline" "date",
    "preferences_open" boolean DEFAULT false NOT NULL,
    "auto_plan_enabled" boolean DEFAULT true NOT NULL,
    "auto_plan_config" "jsonb" DEFAULT '{"max_iterations": 1000, "allow_overbooking": false, "optimization_goals": ["minimize_conflicts", "balance_trainer_load", "maximize_preferences"], "prefer_consistent_timeslots": true}'::"jsonb",
    "description" "text",
    "notes" "text",
    "created_by" "uuid",
    "last_planned_at" timestamp without time zone,
    "published_at" timestamp without time zone,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "seasons_check" CHECK (("end_date" > "start_date")),
    CONSTRAINT "seasons_check1" CHECK ((("preferences_deadline" IS NULL) OR ("preferences_deadline" <= "start_date"))),
    CONSTRAINT "seasons_planning_status_check" CHECK ((("planning_status")::"text" = ANY (ARRAY[('draft'::character varying)::"text", ('collecting_preferences'::character varying)::"text", ('preferences_open'::character varying)::"text", ('auto_planning'::character varying)::"text", ('manual_review'::character varying)::"text", ('invoices_generated'::character varying)::"text", ('published'::character varying)::"text", ('active'::character varying)::"text", ('completed'::character varying)::"text", ('archived'::character varying)::"text"]))),
    CONSTRAINT "seasons_season_type_check" CHECK ((("season_type")::"text" = ANY (ARRAY[('summer'::character varying)::"text", ('winter'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."seasons" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."seasons" OWNER TO "postgres";


COMMENT ON TABLE "public"."seasons" IS 'Training seasons with planning workflow';



COMMENT ON COLUMN "public"."seasons"."planning_status" IS 'Workflow: draft -> collecting_preferences -> auto_planning -> manual_review -> published -> active -> completed';



CREATE TABLE IF NOT EXISTS "public"."session_rsvps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "responded_at" timestamp with time zone,
    "notes" "text",
    "reminded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."session_rsvps" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_rsvps" OWNER TO "postgres";


COMMENT ON TABLE "public"."session_rsvps" IS 'Session RSVPs – member attendance confirmations for training sessions';



CREATE TABLE IF NOT EXISTS "public"."session_waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notified_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."session_waitlist" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_waitlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "trainer_id" "uuid",
    "group_ids" "jsonb" NOT NULL,
    "week_number" integer NOT NULL,
    "timeslot_start" timestamp without time zone NOT NULL,
    "timeslot_end" timestamp without time zone NOT NULL,
    "court_id" "uuid",
    "max_participants" integer DEFAULT 10 NOT NULL,
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "session_type" "text" DEFAULT 'training'::"text" NOT NULL,
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "plan_entry_id" "uuid",
    CONSTRAINT "sessions_max_participants_check" CHECK ((("max_participants" >= 1) AND ("max_participants" <= 50))),
    CONSTRAINT "sessions_session_type_check" CHECK (("session_type" = ANY (ARRAY['training'::"text", 'walk_in'::"text", 'event'::"text", 'maintenance'::"text"]))),
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'ongoing'::"text", 'completed'::"text", 'cancelled'::"text", 'holiday_cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."sessions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."sessions" IS 'Trainings-Sessions. Club affiliation via sessions.schedule_id → schedules.club_id (NOT a sessions.club_id column). RLS corrected 20260626: was referencing nonexistent sessions.club_id.';



COMMENT ON COLUMN "public"."sessions"."session_type" IS 'training = regular trainer session, walk_in = ad-hoc member booking, event = club event, maintenance = court blocked';



COMMENT ON COLUMN "public"."sessions"."cancelled_at" IS 'Zeitpunkt der Absage; NULL = nicht abgesagt';



COMMENT ON COLUMN "public"."sessions"."cancellation_reason" IS 'Grund der Absage (Pflichtfeld bei Absage)';



CREATE TABLE IF NOT EXISTS "public"."shop_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "payment_status" character varying(20) DEFAULT 'unpaid'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."shop_orders" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "category" character varying(100) DEFAULT 'general'::character varying,
    "image_url" "text",
    "stock" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."shop_products" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."special_event_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'registered'::character varying NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."special_event_registrations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."special_event_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."special_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "name" character varying(200) NOT NULL,
    "event_type" "public"."special_event_type" DEFAULT 'sommercamp'::"public"."special_event_type" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "location" character varying(200),
    "max_participants" integer DEFAULT 12 NOT NULL,
    "price_per_person" numeric(10,2) DEFAULT 0 NOT NULL,
    "trainer_id" "uuid",
    "status" "public"."special_event_status" DEFAULT 'draft'::"public"."special_event_status" NOT NULL,
    "age_groups" "text"[] DEFAULT '{}'::"text"[],
    "skill_levels" "text"[] DEFAULT '{}'::"text"[],
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_dates" CHECK (("end_date" >= "start_date"))
);

ALTER TABLE ONLY "public"."special_events" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."special_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."stripe_events" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."stripe_events" IS 'Webhook idempotency log — each Stripe event is recorded before processing to prevent duplicate handling.';



CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "category" character varying(20) NOT NULL,
    "key" character varying(100) NOT NULL,
    "value" "text" NOT NULL,
    "type" character varying(20) NOT NULL,
    "description" "text",
    "is_public" boolean DEFAULT false NOT NULL,
    "is_required" boolean DEFAULT false NOT NULL,
    "validation" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "system_settings_category_check" CHECK ((("category")::"text" = ANY (ARRAY[('general'::character varying)::"text", ('email'::character varying)::"text", ('notifications'::character varying)::"text", ('security'::character varying)::"text", ('integrations'::character varying)::"text", ('other'::character varying)::"text"]))),
    CONSTRAINT "system_settings_type_check" CHECK ((("type")::"text" = ANY (ARRAY[('string'::character varying)::"text", ('number'::character varying)::"text", ('boolean'::character varying)::"text", ('json'::character varying)::"text", ('array'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."system_settings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_settings" IS 'RLS policies updated: club_members → is_club_admin()/is_club_member() helper functions (20260625)';



COMMENT ON COLUMN "public"."system_settings"."club_id" IS 'Club ID for club-specific settings, NULL for global settings';



COMMENT ON COLUMN "public"."system_settings"."category" IS 'Setting category: general, email, notifications, security, integrations, or other';



COMMENT ON COLUMN "public"."system_settings"."key" IS 'Unique setting key (e.g., club_name, email_provider)';



COMMENT ON COLUMN "public"."system_settings"."value" IS 'Setting value stored as text (type-converted at application layer)';



COMMENT ON COLUMN "public"."system_settings"."type" IS 'Value type for validation and parsing: string, number, boolean, json, or array';



COMMENT ON COLUMN "public"."system_settings"."is_public" IS 'Whether this setting is visible to non-admin users';



COMMENT ON COLUMN "public"."system_settings"."is_required" IS 'Whether this setting is required and cannot be deleted';



COMMENT ON COLUMN "public"."system_settings"."validation" IS 'JSONB validation rules (min, max, pattern, enum)';



CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "role" character varying(20) DEFAULT 'player'::character varying NOT NULL,
    "position_number" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."team_members" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "league_id" "uuid" NOT NULL,
    "name" character varying(200) NOT NULL,
    "captain_id" "uuid",
    "position" integer,
    "matches_played" integer DEFAULT 0 NOT NULL,
    "matches_won" integer DEFAULT 0 NOT NULL,
    "matches_lost" integer DEFAULT 0 NOT NULL,
    "matches_drawn" integer DEFAULT 0 NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."teams" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "round" integer NOT NULL,
    "match_number" integer NOT NULL,
    "player1_id" "uuid",
    "player2_id" "uuid",
    "court_id" "uuid",
    "scheduled_at" timestamp with time zone,
    "score" "text",
    "winner_id" "uuid",
    "status" "text" DEFAULT 'scheduled'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tournament_matches_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'in_progress'::"text", 'completed'::"text", 'walkover'::"text"])))
);

ALTER TABLE ONLY "public"."tournament_matches" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "partner_id" "uuid",
    "registration_date" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'registered'::"text",
    "seed" integer,
    "payment_status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    CONSTRAINT "tournament_registrations_status_check" CHECK (("status" = ANY (ARRAY['registered'::"text", 'confirmed'::"text", 'withdrawn'::"text", 'disqualified'::"text"])))
);

ALTER TABLE ONLY "public"."tournament_registrations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "format" "text" DEFAULT 'single_elimination'::"text",
    "category" "text" DEFAULT 'open'::"text",
    "surface" "text",
    "max_participants" integer DEFAULT 16,
    "registration_deadline" "date",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "status" "text" DEFAULT 'registration'::"text",
    "prize_info" "text",
    "entry_fee" numeric(10,2) DEFAULT 0,
    "organizer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tournaments_category_check" CHECK (("category" = ANY (ARRAY['open'::"text", 'men'::"text", 'women'::"text", 'mixed'::"text", 'junior'::"text", 'senior'::"text"]))),
    CONSTRAINT "tournaments_format_check" CHECK (("format" = ANY (ARRAY['single_elimination'::"text", 'double_elimination'::"text", 'round_robin'::"text", 'swiss'::"text"]))),
    CONSTRAINT "tournaments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'registration'::"text", 'active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."tournaments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournaments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trainer_absences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "trainer_name" character varying(100) NOT NULL,
    "type" character varying(20) NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "reason" "text",
    "notes" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "substitute_trainer_id" "uuid",
    CONSTRAINT "trainer_absences_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('approved'::character varying)::"text", ('rejected'::character varying)::"text"]))),
    CONSTRAINT "trainer_absences_type_check" CHECK ((("type")::"text" = ANY (ARRAY[('sick'::character varying)::"text", ('vacation'::character varying)::"text", ('personal'::character varying)::"text", ('other'::character varying)::"text"]))),
    CONSTRAINT "valid_approval" CHECK ((((("status")::"text" = 'approved'::"text") AND ("approved_by" IS NOT NULL) AND ("approved_at" IS NOT NULL)) OR ((("status")::"text" = 'rejected'::"text") AND ("approved_by" IS NOT NULL) AND ("approved_at" IS NOT NULL)) OR ((("status")::"text" = 'pending'::"text") AND ("approved_by" IS NULL) AND ("approved_at" IS NULL)))),
    CONSTRAINT "valid_date_range" CHECK (("start_date" <= "end_date"))
);

ALTER TABLE ONLY "public"."trainer_absences" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_absences" OWNER TO "postgres";


COMMENT ON TABLE "public"."trainer_absences" IS 'RLS policies updated: club_members → is_club_admin()/is_club_trainer() helper functions (20260625)';



COMMENT ON COLUMN "public"."trainer_absences"."type" IS 'Absence type: sick, vacation, personal, or other';



COMMENT ON COLUMN "public"."trainer_absences"."status" IS 'Approval status: pending, approved, or rejected';



COMMENT ON COLUMN "public"."trainer_absences"."approved_by" IS 'User ID of admin who approved/rejected the absence';



COMMENT ON COLUMN "public"."trainer_absences"."approved_at" IS 'Timestamp when absence was approved/rejected';



CREATE TABLE IF NOT EXISTS "public"."trainer_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "hourly_rate" numeric(10,2) DEFAULT 0.00,
    "specialization" "text"[],
    "max_students_per_session" integer DEFAULT 10,
    "bio" "text",
    "qualifications" "text"[],
    "languages" "text"[] DEFAULT ARRAY['de'::"text"],
    "is_active" boolean DEFAULT true NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."trainer_assignments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."trainer_assignments" IS 'Trainer assignments to clubs with rates and qualifications';



COMMENT ON COLUMN "public"."trainer_assignments"."specialization" IS 'Array of specializations: beginner, advanced, kids, etc.';



COMMENT ON COLUMN "public"."trainer_assignments"."qualifications" IS 'Array of qualifications and certifications';



CREATE TABLE IF NOT EXISTS "public"."trainer_availabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "start_time" character varying(5) NOT NULL,
    "end_time" character varying(5) NOT NULL,
    "status" character varying(20) DEFAULT 'available'::character varying NOT NULL,
    "notes" "text",
    "recurring_pattern" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trainer_availabilities_end_time_check" CHECK ((("end_time")::"text" ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'::"text")),
    CONSTRAINT "trainer_availabilities_start_time_check" CHECK ((("start_time")::"text" ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'::"text")),
    CONSTRAINT "trainer_availabilities_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('available'::character varying)::"text", ('unavailable'::character varying)::"text", ('booked'::character varying)::"text", ('blocked'::character varying)::"text"]))),
    CONSTRAINT "trainer_availabilities_time_order" CHECK ((("start_time")::"text" < ("end_time")::"text"))
);

ALTER TABLE ONLY "public"."trainer_availabilities" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_availabilities" OWNER TO "postgres";


COMMENT ON TABLE "public"."trainer_availabilities" IS 'Trainer availability slots (when trainers can work)';



COMMENT ON COLUMN "public"."trainer_availabilities"."status" IS 'Status: available (free), unavailable (off), booked (assigned), blocked (admin hold)';



COMMENT ON COLUMN "public"."trainer_availabilities"."recurring_pattern" IS 'Optional: JSON pattern for recurring availability (e.g., every Monday 10:00-18:00)';



CREATE TABLE IF NOT EXISTS "public"."trainer_billings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "billing_period_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "trainer_name" character varying(255) NOT NULL,
    "total_hours" numeric(10,2) NOT NULL,
    "hourly_rate" numeric(10,2) NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "invoice_id" "uuid",
    "invoice_number" character varying(50),
    "due_date" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tax_free_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "taxable_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "trainer_billings_hourly_rate_check" CHECK (("hourly_rate" >= (0)::numeric)),
    CONSTRAINT "trainer_billings_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('processed'::character varying)::"text", ('paid'::character varying)::"text", ('overdue'::character varying)::"text"]))),
    CONSTRAINT "trainer_billings_total_amount_check" CHECK (("total_amount" >= (0)::numeric)),
    CONSTRAINT "trainer_billings_total_hours_check" CHECK (("total_hours" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."trainer_billings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_billings" OWNER TO "postgres";


COMMENT ON TABLE "public"."trainer_billings" IS 'Trainer compensation records per billing period';



COMMENT ON COLUMN "public"."trainer_billings"."status" IS 'Status: pending (awaiting approval), processed (invoice generated), paid (payment completed), overdue (payment late)';



COMMENT ON COLUMN "public"."trainer_billings"."invoice_number" IS 'Generated invoice number (e.g., INV-202605-0001)';



COMMENT ON COLUMN "public"."trainer_billings"."tax_free_amount" IS 'Steuerfreier Anteil (§ 3 Nr. 26 EStG Übungsleiterpauschale, max. 3.000 € p.a.)';



COMMENT ON COLUMN "public"."trainer_billings"."taxable_amount" IS 'Steuerpflichtiger Anteil (Betrag über der Übungsleiterpauschale)';



CREATE TABLE IF NOT EXISTS "public"."trainer_club" (
    "trainer_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."trainer_club" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_club" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trainer_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "club_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "teaching_quality" integer,
    "communication" integer,
    "motivation" integer,
    "punctuality" integer,
    "comment" "text",
    "is_visible" boolean DEFAULT true,
    "is_flagged" boolean DEFAULT false,
    "flagged_reason" "text",
    "moderated_at" timestamp with time zone,
    "moderated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "season_id" "uuid",
    "group_id" "uuid",
    "attendance_quote" numeric(5,2),
    "ready_for_next_level" character varying(20) DEFAULT 'undecided'::character varying,
    "recommended_level" character varying(20),
    "notes" "text",
    "performance_rating" integer,
    "strengths" "jsonb" DEFAULT '[]'::"jsonb",
    "areas_for_improvement" "jsonb" DEFAULT '[]'::"jsonb",
    "submitted_at" timestamp with time zone,
    "is_submitted" boolean DEFAULT false NOT NULL,
    CONSTRAINT "feedback_rating_required" CHECK (("rating" IS NOT NULL)),
    CONSTRAINT "trainer_feedback_communication_check" CHECK ((("communication" >= 1) AND ("communication" <= 5))),
    CONSTRAINT "trainer_feedback_motivation_check" CHECK ((("motivation" >= 1) AND ("motivation" <= 5))),
    CONSTRAINT "trainer_feedback_punctuality_check" CHECK ((("punctuality" >= 1) AND ("punctuality" <= 5))),
    CONSTRAINT "trainer_feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "trainer_feedback_teaching_quality_check" CHECK ((("teaching_quality" >= 1) AND ("teaching_quality" <= 5)))
);

ALTER TABLE ONLY "public"."trainer_feedback" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_feedback" OWNER TO "postgres";


COMMENT ON TABLE "public"."trainer_feedback" IS 'Member feedback and ratings for trainers after training sessions';



COMMENT ON COLUMN "public"."trainer_feedback"."rating" IS 'Overall rating from 1 (poor) to 5 (excellent)';



COMMENT ON COLUMN "public"."trainer_feedback"."is_visible" IS 'Whether feedback is visible to other members';



COMMENT ON COLUMN "public"."trainer_feedback"."is_flagged" IS 'Flagged for moderation (inappropriate content)';



CREATE TABLE IF NOT EXISTS "public"."trainer_hourly_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "trainer_name" character varying(100) NOT NULL,
    "base_rate" numeric(10,2) NOT NULL,
    "override_rate" numeric(10,2),
    "effective_rate" numeric(10,2) NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_until" "date",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trainer_hourly_rates_base_rate_positive" CHECK (("base_rate" > (0)::numeric)),
    CONSTRAINT "trainer_hourly_rates_effective_rate_positive" CHECK (("effective_rate" > (0)::numeric)),
    CONSTRAINT "trainer_hourly_rates_override_rate_positive" CHECK ((("override_rate" IS NULL) OR ("override_rate" > (0)::numeric))),
    CONSTRAINT "trainer_hourly_rates_valid_period" CHECK ((("valid_until" IS NULL) OR ("valid_until" >= "valid_from")))
);

ALTER TABLE ONLY "public"."trainer_hourly_rates" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_hourly_rates" OWNER TO "postgres";


COMMENT ON TABLE "public"."trainer_hourly_rates" IS 'Individual trainer hourly rates with validity periods and override capability';



CREATE TABLE IF NOT EXISTS "public"."trainer_member_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."trainer_member_notes" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_member_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trainer_rating_summary" (
    "trainer_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "average_rating" numeric(3,2) DEFAULT 0,
    "total_ratings" integer DEFAULT 0,
    "avg_teaching_quality" numeric(3,2) DEFAULT 0,
    "avg_communication" numeric(3,2) DEFAULT 0,
    "avg_motivation" numeric(3,2) DEFAULT 0,
    "avg_punctuality" numeric(3,2) DEFAULT 0,
    "rating_5_count" integer DEFAULT 0,
    "rating_4_count" integer DEFAULT 0,
    "rating_3_count" integer DEFAULT 0,
    "rating_2_count" integer DEFAULT 0,
    "rating_1_count" integer DEFAULT 0,
    "last_updated" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."trainer_rating_summary" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_rating_summary" OWNER TO "postgres";


COMMENT ON TABLE "public"."trainer_rating_summary" IS 'Aggregated trainer ratings for quick lookups and display';



COMMENT ON COLUMN "public"."trainer_rating_summary"."average_rating" IS 'Average rating across all visible feedback';



COMMENT ON COLUMN "public"."trainer_rating_summary"."total_ratings" IS 'Total count of visible feedback entries';



CREATE TABLE IF NOT EXISTS "public"."trainer_slot_waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slot_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."trainer_slot_waitlist" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_slot_waitlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_group_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "training_group_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "joined_at" "date" NOT NULL,
    "left_at" "date",
    "left_reason" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "training_group_memberships_left_reason_check" CHECK (("left_reason" = ANY (ARRAY['group_change'::"text", 'season_end'::"text", 'cancelled'::"text", 'manual'::"text"])))
);

ALTER TABLE ONLY "public"."training_group_memberships" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_group_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "level" character varying(20) DEFAULT 'intermediate'::character varying NOT NULL,
    "age_group" character varying(20) DEFAULT 'senior'::character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "club_id" "uuid" NOT NULL
);

ALTER TABLE ONLY "public"."training_groups" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_club_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "club_id" "uuid",
    "role" character varying(20) DEFAULT 'member'::character varying NOT NULL,
    "joined_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "tenant_id" character varying(100),
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "deactivated_at" timestamp with time zone,
    "deactivated_by" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "fee_configuration_id" "uuid",
    "include_in_planning" boolean DEFAULT true NOT NULL,
    "is_honorary" boolean DEFAULT false NOT NULL,
    "honorary_since" "date",
    "office_flags" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_reactivation_sent_at" timestamp with time zone,
    "reactivation_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "user_club_memberships_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'pending'::"text", 'suspended'::"text", 'left'::"text"])))
);

ALTER TABLE ONLY "public"."user_club_memberships" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_club_memberships" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_club_memberships"."role" IS 'owner | superadmin | admin | trainer | member — owner = Plattformbetreiber (Swingz GmbH), superadmin = Tennisschule-Chef';



COMMENT ON COLUMN "public"."user_club_memberships"."include_in_planning" IS 'Ob das Mitglied in die Saisonplanung einbezogen werden soll';



COMMENT ON COLUMN "public"."user_club_memberships"."office_flags" IS 'Funktionale Vereinsämter: {"kassenwart":true,"mannschaftsfuehrer":true,...}. Ergänzt die Rolle, ersetzt sie nicht.';



COMMENT ON COLUMN "public"."user_club_memberships"."last_reactivation_sent_at" IS 'Timestamp of the most recent reactivation push notification sent. Idempotency guard for the 14-day reactivation cron (ticket 2.5.2).';



COMMENT ON COLUMN "public"."user_club_memberships"."reactivation_count" IS 'Total number of reactivation notifications sent to this member. Marketing analytics — how many push nudges did it take to re-engage?';



CREATE TABLE IF NOT EXISTS "public"."user_dashboard_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "dashboard_type" character varying(20) NOT NULL,
    "club_id" "uuid",
    "layout" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."user_dashboard_preferences" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_dashboard_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_training_preferences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "user_role" character varying(20) NOT NULL,
    "preferred_level" character varying(20),
    "preferred_age_group" character varying(20),
    "preferred_group_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "weekly_availability" "jsonb" DEFAULT '{"friday": [], "monday": [], "sunday": [], "tuesday": [], "saturday": [], "thursday": [], "wednesday": []}'::"jsonb" NOT NULL,
    "unavailable_dates" "jsonb" DEFAULT '[]'::"jsonb",
    "max_sessions_per_week" integer,
    "preferred_court_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "can_teach_groups" "jsonb" DEFAULT '[]'::"jsonb",
    "priority" integer DEFAULT 5 NOT NULL,
    "special_requests" "text",
    "notes" "text",
    "submitted_at" timestamp without time zone,
    "is_submitted" boolean DEFAULT false NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"(),
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "wish_partner_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "self_assessed_level" character varying(20),
    "avoid_member_ids" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "user_training_preferences_user_role_check" CHECK ((("user_role")::"text" = ANY (ARRAY[('member'::character varying)::"text", ('trainer'::character varying)::"text", ('admin'::character varying)::"text"])))
);

ALTER TABLE ONLY "public"."user_training_preferences" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_training_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_training_preferences" IS 'Member and trainer availability and preferences per season';



CREATE TABLE IF NOT EXISTS "public"."waitlist_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "court_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'waiting'::"text",
    "priority" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "waitlist_entries_status_check" CHECK (("status" = ANY (ARRAY['waiting'::"text", 'notified'::"text", 'expired'::"text", 'fulfilled'::"text"])))
);

ALTER TABLE ONLY "public"."waitlist_entries" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_duties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "title" character varying(200) NOT NULL,
    "description" "text",
    "duty_type" character varying(50) NOT NULL,
    "scheduled_date" timestamp with time zone,
    "start_time" character varying(5),
    "end_time" character varying(5),
    "max_participants" integer DEFAULT 1,
    "status" character varying(20) DEFAULT 'open'::character varying NOT NULL,
    "assigned_to" "uuid",
    "priority" character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    "season_year" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."work_duties" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_duties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_duty_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "duty_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'assigned'::character varying NOT NULL,
    "completed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."work_duty_assignments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_duty_assignments" OWNER TO "postgres";


ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."background_jobs"
    ADD CONSTRAINT "background_jobs_job_name_key" UNIQUE ("job_name");



ALTER TABLE ONLY "public"."background_jobs"
    ADD CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."base_interest_rates"
    ADD CONSTRAINT "base_interest_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."base_interest_rates"
    ADD CONSTRAINT "base_interest_rates_valid_from_key" UNIQUE ("valid_from");



ALTER TABLE ONLY "public"."billing_line_items"
    ADD CONSTRAINT "billing_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_periods"
    ADD CONSTRAINT "billing_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_decisions"
    ADD CONSTRAINT "board_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_restrictions"
    ADD CONSTRAINT "booking_restrictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_rules"
    ADD CONSTRAINT "booking_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_member_session_unique" UNIQUE ("member_id", "session_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_access_requests"
    ADD CONSTRAINT "club_access_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_documents"
    ADD CONSTRAINT "club_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_requests"
    ADD CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."court_availability"
    ADD CONSTRAINT "court_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."court_closures"
    ADD CONSTRAINT "court_closures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."court_maintenance"
    ADD CONSTRAINT "court_maintenance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."court_types"
    ADD CONSTRAINT "court_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courts"
    ADD CONSTRAINT "courts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."decision_changes"
    ADD CONSTRAINT "decision_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."decision_votes"
    ADD CONSTRAINT "decision_votes_decision_id_voter_id_key" UNIQUE ("decision_id", "voter_id");



ALTER TABLE ONLY "public"."decision_votes"
    ADD CONSTRAINT "decision_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dunning_records"
    ADD CONSTRAINT "dunning_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_campaigns"
    ADD CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_accounts"
    ADD CONSTRAINT "family_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_accounts"
    ADD CONSTRAINT "family_accounts_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."family_invites"
    ADD CONSTRAINT "family_invites_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."family_invites"
    ADD CONSTRAINT "family_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_configurations"
    ADD CONSTRAINT "fee_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_feedback"
    ADD CONSTRAINT "feedback_unique_session" UNIQUE ("member_id", "session_id");



ALTER TABLE ONLY "public"."gamification_badges"
    ADD CONSTRAINT "gamification_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gamification_badges"
    ADD CONSTRAINT "gamification_badges_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."gamification_points"
    ADD CONSTRAINT "gamification_points_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hourly_rate_tiers"
    ADD CONSTRAINT "hourly_rate_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hours_logs"
    ADD CONSTRAINT "hours_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_installments"
    ADD CONSTRAINT "invoice_installments_invoice_id_installment_number_key" UNIQUE ("invoice_id", "installment_number");



ALTER TABLE ONLY "public"."invoice_installments"
    ADD CONSTRAINT "invoice_installments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_execution_log"
    ADD CONSTRAINT "job_execution_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."league_players"
    ADD CONSTRAINT "league_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_caterings"
    ADD CONSTRAINT "match_caterings_match_day_id_key" UNIQUE ("match_day_id");



ALTER TABLE ONLY "public"."match_caterings"
    ADD CONSTRAINT "match_caterings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_days"
    ADD CONSTRAINT "match_days_league_id_matchday_number_key" UNIQUE ("league_id", "matchday_number");



ALTER TABLE ONLY "public"."match_days"
    ADD CONSTRAINT "match_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_match_day_id_position_number_key" UNIQUE ("match_day_id", "position_number");



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matchday_reminder_logs"
    ADD CONSTRAINT "matchday_reminder_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_invitations"
    ADD CONSTRAINT "meeting_invitations_decision_id_member_id_key" UNIQUE ("decision_id", "member_id");



ALTER TABLE ONLY "public"."meeting_invitations"
    ADD CONSTRAINT "meeting_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_balance_entries"
    ADD CONSTRAINT "member_balance_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_balances"
    ADD CONSTRAINT "member_balances_member_id_club_id_key" UNIQUE ("member_id", "club_id");



ALTER TABLE ONLY "public"."member_balances"
    ADD CONSTRAINT "member_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_booking_preferences"
    ADD CONSTRAINT "member_booking_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_booking_preferences"
    ADD CONSTRAINT "member_booking_preferences_user_id_club_id_key" UNIQUE ("user_id", "club_id");



ALTER TABLE ONLY "public"."member_meetings"
    ADD CONSTRAINT "member_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_schedule_preferences"
    ADD CONSTRAINT "member_schedule_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."news_comments"
    ADD CONSTRAINT "news_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."news_posts"
    ADD CONSTRAINT "news_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_campaigns"
    ADD CONSTRAINT "newsletter_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_send_logs"
    ADD CONSTRAINT "newsletter_send_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_consents"
    ADD CONSTRAINT "notification_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_consents"
    ADD CONSTRAINT "notification_consents_user_id_channel_key" UNIQUE ("user_id", "channel");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nuliga_sync_log"
    ADD CONSTRAINT "nuliga_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."open_match_participants"
    ADD CONSTRAINT "open_match_participants_match_id_user_id_key" UNIQUE ("match_id", "user_id");



ALTER TABLE ONLY "public"."open_match_participants"
    ADD CONSTRAINT "open_match_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."open_matches"
    ADD CONSTRAINT "open_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_settings"
    ADD CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_conflicts"
    ADD CONSTRAINT "planning_conflicts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_checkins"
    ADD CONSTRAINT "qr_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_checkins"
    ADD CONSTRAINT "qr_checkins_session_id_user_id_key" UNIQUE ("session_id", "user_id");



ALTER TABLE ONLY "public"."rate_history"
    ADD CONSTRAINT "rate_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registration_requests"
    ADD CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("filename");



ALTER TABLE ONLY "public"."school_holidays"
    ADD CONSTRAINT "school_holidays_bundesland_name_year_key" UNIQUE ("bundesland", "name", "year");



ALTER TABLE ONLY "public"."school_holidays"
    ADD CONSTRAINT "school_holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."season_billing_configs"
    ADD CONSTRAINT "season_billing_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."season_group_weeks"
    ADD CONSTRAINT "season_group_weeks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."season_group_weeks"
    ADD CONSTRAINT "season_group_weeks_unique_cell" UNIQUE ("season_id", "group_id", "week_monday");



ALTER TABLE ONLY "public"."season_plan_entries"
    ADD CONSTRAINT "season_plan_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."season_plan_versions"
    ADD CONSTRAINT "season_plan_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."season_planning_configs"
    ADD CONSTRAINT "season_planning_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."season_planning_history"
    ADD CONSTRAINT "season_planning_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."season_statistics"
    ADD CONSTRAINT "season_statistics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."season_waitlists"
    ADD CONSTRAINT "season_waitlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_club_id_season_type_year_key" UNIQUE ("club_id", "season_type", "year");



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sepa_mandates"
    ADD CONSTRAINT "sepa_mandates_mandate_reference_key" UNIQUE ("mandate_reference");



ALTER TABLE ONLY "public"."sepa_mandates"
    ADD CONSTRAINT "sepa_mandates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_rsvps"
    ADD CONSTRAINT "session_rsvps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_waitlist"
    ADD CONSTRAINT "session_waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_waitlist"
    ADD CONSTRAINT "session_waitlist_session_id_member_id_key" UNIQUE ("session_id", "member_id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_orders"
    ADD CONSTRAINT "shop_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_products"
    ADD CONSTRAINT "shop_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."special_event_registrations"
    ADD CONSTRAINT "special_event_registrations_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."special_event_registrations"
    ADD CONSTRAINT "special_event_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."special_events"
    ADD CONSTRAINT "special_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_member_id_key" UNIQUE ("team_id", "member_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_league_id_name_key" UNIQUE ("league_id", "name");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_registrations"
    ADD CONSTRAINT "tournament_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_registrations"
    ADD CONSTRAINT "tournament_registrations_tournament_id_user_id_key" UNIQUE ("tournament_id", "user_id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_absences"
    ADD CONSTRAINT "trainer_absences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_assignments"
    ADD CONSTRAINT "trainer_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_assignments"
    ADD CONSTRAINT "trainer_assignments_user_id_club_id_key" UNIQUE ("user_id", "club_id");



ALTER TABLE ONLY "public"."trainer_availabilities"
    ADD CONSTRAINT "trainer_availabilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_billings"
    ADD CONSTRAINT "trainer_billings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_feedback"
    ADD CONSTRAINT "trainer_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_hourly_rates"
    ADD CONSTRAINT "trainer_hourly_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_member_notes"
    ADD CONSTRAINT "trainer_member_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_member_notes"
    ADD CONSTRAINT "trainer_member_notes_trainer_id_member_id_key" UNIQUE ("trainer_id", "member_id");



ALTER TABLE ONLY "public"."trainer_profiles"
    ADD CONSTRAINT "trainer_profiles_email_club_unique" UNIQUE ("email", "club_id");



ALTER TABLE ONLY "public"."trainer_profiles"
    ADD CONSTRAINT "trainer_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_profiles"
    ADD CONSTRAINT "trainer_profiles_user_club_unique" UNIQUE ("user_id", "club_id");



ALTER TABLE ONLY "public"."trainer_rating_summary"
    ADD CONSTRAINT "trainer_rating_club_unique" UNIQUE ("trainer_id", "club_id");



ALTER TABLE ONLY "public"."trainer_rating_summary"
    ADD CONSTRAINT "trainer_rating_summary_pkey" PRIMARY KEY ("trainer_id");



ALTER TABLE ONLY "public"."trainer_slot_waitlist"
    ADD CONSTRAINT "trainer_slot_waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_slot_waitlist"
    ADD CONSTRAINT "trainer_slot_waitlist_unique" UNIQUE ("slot_id", "user_id");



ALTER TABLE ONLY "public"."trainers"
    ADD CONSTRAINT "trainers_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."trainers"
    ADD CONSTRAINT "trainers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_group_memberships"
    ADD CONSTRAINT "training_group_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_groups"
    ADD CONSTRAINT "training_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trial_trainings"
    ADD CONSTRAINT "trial_trainings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_settings"
    ADD CONSTRAINT "unique_default_per_club" UNIQUE NULLS NOT DISTINCT ("club_id", "is_default") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "unique_key_per_club" UNIQUE NULLS NOT DISTINCT ("club_id", "key");



ALTER TABLE ONLY "public"."season_billing_configs"
    ADD CONSTRAINT "unique_season_billing" UNIQUE ("season_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "unique_session_member" UNIQUE ("session_id", "member_id");



ALTER TABLE ONLY "public"."user_club_memberships"
    ADD CONSTRAINT "user_club_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_club_memberships"
    ADD CONSTRAINT "user_club_memberships_user_club_unique" UNIQUE ("user_id", "club_id");



COMMENT ON CONSTRAINT "user_club_memberships_user_club_unique" ON "public"."user_club_memberships" IS 'Jedes Mitglied darf nur einmal pro Verein Mitglied sein';



ALTER TABLE ONLY "public"."user_dashboard_preferences"
    ADD CONSTRAINT "user_dashboard_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_dashboard_preferences"
    ADD CONSTRAINT "user_dashboard_prefs_unique" UNIQUE ("user_id", "dashboard_type", "club_id");



ALTER TABLE ONLY "public"."user_training_preferences"
    ADD CONSTRAINT "user_training_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_training_preferences"
    ADD CONSTRAINT "user_training_preferences_season_id_user_id_key" UNIQUE ("season_id", "user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_duties"
    ADD CONSTRAINT "work_duties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_duty_assignments"
    ADD CONSTRAINT "work_duty_assignments_duty_id_member_id_key" UNIQUE ("duty_id", "member_id");



ALTER TABLE ONLY "public"."work_duty_assignments"
    ADD CONSTRAINT "work_duty_assignments_pkey" PRIMARY KEY ("id");



CREATE INDEX "attendance_records_date_idx" ON "public"."attendance_records" USING "btree" ("date");



CREATE INDEX "attendance_records_member_status_idx" ON "public"."attendance_records" USING "btree" ("member_status");



CREATE INDEX "attendance_records_participant_idx" ON "public"."attendance_records" USING "btree" ("participant_id");



CREATE INDEX "attendance_records_participant_member_status_idx" ON "public"."attendance_records" USING "btree" ("participant_id", "member_status");



CREATE INDEX "attendance_records_session_idx" ON "public"."attendance_records" USING "btree" ("session_id");



CREATE INDEX "attendance_records_trainer_confirmed_idx" ON "public"."attendance_records" USING "btree" ("trainer_confirmed");



CREATE INDEX "attendance_records_trainer_idx" ON "public"."attendance_records" USING "btree" ("trainer_id");



CREATE INDEX "audit_logs_action_resource_type_id_idx" ON "public"."audit_logs" USING "btree" ("action", "resource_type", "resource_id");



CREATE INDEX "audit_logs_actor_created_idx" ON "public"."audit_logs" USING "btree" ("actor_id", "created_at" DESC);



CREATE INDEX "audit_logs_club_id_idx" ON "public"."audit_logs" USING "btree" ("club_id", "created_at" DESC);



CREATE INDEX "audit_logs_resource_type_idx" ON "public"."audit_logs" USING "btree" ("resource_type");



CREATE INDEX "base_interest_rates_valid_from_idx" ON "public"."base_interest_rates" USING "btree" ("valid_from" DESC);



CREATE INDEX "billing_line_items_billing_idx" ON "public"."billing_line_items" USING "btree" ("trainer_billing_id");



CREATE INDEX "billing_line_items_date_idx" ON "public"."billing_line_items" USING "btree" ("date");



CREATE INDEX "billing_line_items_session_idx" ON "public"."billing_line_items" USING "btree" ("session_id");



CREATE INDEX "billing_periods_club_idx" ON "public"."billing_periods" USING "btree" ("club_id");



CREATE INDEX "billing_periods_date_idx" ON "public"."billing_periods" USING "btree" ("start_date", "end_date");



CREATE INDEX "billing_periods_status_idx" ON "public"."billing_periods" USING "btree" ("status");



CREATE INDEX "board_decisions_club_idx" ON "public"."board_decisions" USING "btree" ("club_id");



CREATE INDEX "board_decisions_meeting_idx" ON "public"."board_decisions" USING "btree" ("club_id", "meeting_date" DESC);



CREATE INDEX "board_decisions_next_review_idx" ON "public"."board_decisions" USING "btree" ("next_review") WHERE ("outcome" = 'deferred'::"public"."decision_outcome");



CREATE INDEX "board_decisions_status_idx" ON "public"."board_decisions" USING "btree" ("club_id", "status");



CREATE INDEX "bookings_club_idx" ON "public"."bookings" USING "btree" ("club_id");



CREATE INDEX "bookings_member_idx" ON "public"."bookings" USING "btree" ("member_id");



CREATE INDEX "bookings_session_idx" ON "public"."bookings" USING "btree" ("session_id");



CREATE INDEX "bookings_status_idx" ON "public"."bookings" USING "btree" ("status");



CREATE INDEX "clubs_custom_domain_idx" ON "public"."clubs" USING "btree" ("custom_domain") WHERE ("custom_domain" IS NOT NULL);



CREATE INDEX "clubs_deleted_at_idx" ON "public"."clubs" USING "btree" ("deleted_at" DESC) WHERE (("status")::"text" = 'deleted'::"text");



CREATE INDEX "clubs_status_idx" ON "public"."clubs" USING "btree" ("status");



CREATE INDEX "conflicts_club_idx" ON "public"."planning_conflicts" USING "btree" ("club_id");



CREATE INDEX "conflicts_court_idx" ON "public"."planning_conflicts" USING "btree" ("affected_court_id");



CREATE INDEX "conflicts_season_idx" ON "public"."planning_conflicts" USING "btree" ("season_id");



CREATE INDEX "conflicts_severity_idx" ON "public"."planning_conflicts" USING "btree" ("severity");



CREATE INDEX "conflicts_status_idx" ON "public"."planning_conflicts" USING "btree" ("status");



CREATE INDEX "conflicts_trainer_idx" ON "public"."planning_conflicts" USING "btree" ("affected_trainer_id");



CREATE INDEX "court_closures_match_day_idx" ON "public"."court_closures" USING "btree" ("match_day_id");



CREATE INDEX "courts_club_active_idx" ON "public"."courts" USING "btree" ("club_id", "is_active");



CREATE INDEX "courts_club_id_idx" ON "public"."courts" USING "btree" ("club_id");



CREATE INDEX "courts_is_active_idx" ON "public"."courts" USING "btree" ("is_active");



CREATE INDEX "decision_changes_action_idx" ON "public"."decision_changes" USING "btree" ("action");



CREATE INDEX "decision_changes_actor_idx" ON "public"."decision_changes" USING "btree" ("actor_id");



CREATE INDEX "decision_changes_decision_idx" ON "public"."decision_changes" USING "btree" ("decision_id", "created_at" DESC);



CREATE INDEX "decision_votes_decision_idx" ON "public"."decision_votes" USING "btree" ("decision_id");



CREATE INDEX "dunning_records_overdue_idx" ON "public"."dunning_records" USING "btree" ("invoice_id", "level", "status") WHERE (("status")::"text" = ANY (ARRAY[('sent'::character varying)::"text", ('escalated'::character varying)::"text"]));



CREATE INDEX "feedback_ready_idx" ON "public"."trainer_feedback" USING "btree" ("season_id", "ready_for_next_level");



CREATE INDEX "feedback_season_idx" ON "public"."trainer_feedback" USING "btree" ("season_id");



CREATE INDEX "feedback_submitted_idx" ON "public"."trainer_feedback" USING "btree" ("season_id", "is_submitted");



CREATE INDEX "hours_logs_date_idx" ON "public"."hours_logs" USING "btree" ("date");



CREATE INDEX "hours_logs_session_idx" ON "public"."hours_logs" USING "btree" ("session_id");



CREATE INDEX "hours_logs_status_idx" ON "public"."hours_logs" USING "btree" ("status");



CREATE INDEX "hours_logs_trainer_idx" ON "public"."hours_logs" USING "btree" ("trainer_id");



CREATE INDEX "idx_attendance_date" ON "public"."attendance_records" USING "btree" ("created_at");



CREATE INDEX "idx_attendance_participant" ON "public"."attendance_records" USING "btree" ("participant_id");



CREATE INDEX "idx_attendance_session" ON "public"."attendance_records" USING "btree" ("session_id");



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_actor" ON "public"."audit_logs" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at");



CREATE INDEX "idx_audit_logs_resource" ON "public"."audit_logs" USING "btree" ("resource_id", "resource_type");



CREATE INDEX "idx_background_jobs_created_at" ON "public"."background_jobs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_background_jobs_created_by" ON "public"."background_jobs" USING "btree" ("created_by");



CREATE INDEX "idx_background_jobs_history" ON "public"."background_jobs" USING "btree" ("job_name", "status", "completed_at" DESC) WHERE ("status" = ANY (ARRAY['completed'::"text", 'failed'::"text"]));



CREATE INDEX "idx_background_jobs_job_type" ON "public"."background_jobs" USING "btree" ("job_type");



CREATE INDEX "idx_background_jobs_queue" ON "public"."background_jobs" USING "btree" ("status", "priority" DESC, "scheduled_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_background_jobs_scheduled_at" ON "public"."background_jobs" USING "btree" ("scheduled_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_background_jobs_status" ON "public"."background_jobs" USING "btree" ("status");



CREATE INDEX "idx_booking_restrictions_active" ON "public"."booking_restrictions" USING "btree" ("is_active");



CREATE INDEX "idx_booking_restrictions_club_id" ON "public"."booking_restrictions" USING "btree" ("club_id");



CREATE INDEX "idx_booking_restrictions_court_id" ON "public"."booking_restrictions" USING "btree" ("court_id");



CREATE INDEX "idx_booking_restrictions_dates" ON "public"."booking_restrictions" USING "btree" ("start_datetime", "end_datetime");



CREATE INDEX "idx_booking_restrictions_type" ON "public"."booking_restrictions" USING "btree" ("restriction_type");



CREATE INDEX "idx_booking_rules_club_id" ON "public"."booking_rules" USING "btree" ("club_id");



CREATE UNIQUE INDEX "idx_booking_rules_club_role" ON "public"."booking_rules" USING "btree" ("club_id", "role") WHERE ("is_active" = true);



CREATE INDEX "idx_booking_rules_is_active" ON "public"."booking_rules" USING "btree" ("is_active");



CREATE INDEX "idx_bookings_availability" ON "public"."bookings" USING "btree" ("club_id", "court_id", "session_start_time", "status");



CREATE INDEX "idx_bookings_club_id" ON "public"."bookings" USING "btree" ("club_id");



CREATE INDEX "idx_bookings_court_id" ON "public"."bookings" USING "btree" ("court_id");



CREATE INDEX "idx_bookings_member_id" ON "public"."bookings" USING "btree" ("member_id");



CREATE INDEX "idx_bookings_member_session" ON "public"."bookings" USING "btree" ("member_id", "session_id");



CREATE INDEX "idx_bookings_schedule_id" ON "public"."bookings" USING "btree" ("schedule_id");



CREATE INDEX "idx_bookings_session_id" ON "public"."bookings" USING "btree" ("session_id");



CREATE INDEX "idx_bookings_session_status" ON "public"."bookings" USING "btree" ("session_id", "status") WHERE (("status")::"text" = ANY (ARRAY[('confirmed'::character varying)::"text", ('pending'::character varying)::"text"]));



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");



CREATE INDEX "idx_bookings_status_date" ON "public"."bookings" USING "btree" ("status", "session_start_time");



CREATE INDEX "idx_bookings_status_member" ON "public"."bookings" USING "btree" ("member_id", "status", "booked_at");



CREATE INDEX "idx_clubs_features_gin" ON "public"."clubs" USING "gin" ("features" "jsonb_path_ops");



CREATE INDEX "idx_clubs_max_members" ON "public"."clubs" USING "btree" ("max_members");



CREATE INDEX "idx_conflicts_club" ON "public"."planning_conflicts" USING "btree" ("club_id");



CREATE INDEX "idx_conflicts_court" ON "public"."planning_conflicts" USING "btree" ("affected_court_id");



CREATE INDEX "idx_conflicts_season" ON "public"."planning_conflicts" USING "btree" ("season_id");



CREATE INDEX "idx_conflicts_severity" ON "public"."planning_conflicts" USING "btree" ("severity");



CREATE INDEX "idx_conflicts_status" ON "public"."planning_conflicts" USING "btree" ("status");



CREATE INDEX "idx_conflicts_trainer" ON "public"."planning_conflicts" USING "btree" ("affected_trainer_id");



CREATE INDEX "idx_contact_requests_created" ON "public"."contact_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_contact_requests_status" ON "public"."contact_requests" USING "btree" ("status");



CREATE INDEX "idx_coupons_club" ON "public"."coupons" USING "btree" ("club_id");



CREATE INDEX "idx_coupons_code" ON "public"."coupons" USING "btree" ("code");



CREATE INDEX "idx_coupons_created_by" ON "public"."coupons" USING "btree" ("created_by");



CREATE INDEX "idx_court_availability_court_id" ON "public"."court_availability" USING "btree" ("court_id");



CREATE INDEX "idx_court_closures_active" ON "public"."court_closures" USING "btree" ("is_active");



CREATE INDEX "idx_court_closures_club" ON "public"."court_closures" USING "btree" ("club_id");



CREATE INDEX "idx_court_closures_court" ON "public"."court_closures" USING "btree" ("court_id");



CREATE INDEX "idx_court_closures_dates" ON "public"."court_closures" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_court_closures_reason" ON "public"."court_closures" USING "btree" ("reason");



CREATE INDEX "idx_court_types_club_id" ON "public"."court_types" USING "btree" ("club_id");



CREATE INDEX "idx_court_types_is_active" ON "public"."court_types" USING "btree" ("is_active");



CREATE INDEX "idx_court_types_surface_type" ON "public"."court_types" USING "btree" ("surface_type");



CREATE INDEX "idx_courts_active_club" ON "public"."courts" USING "btree" ("club_id", "is_active");



CREATE INDEX "idx_courts_club_id" ON "public"."courts" USING "btree" ("club_id");



CREATE INDEX "idx_courts_club_number" ON "public"."courts" USING "btree" ("club_id", "number");



CREATE INDEX "idx_courts_court_type_id" ON "public"."courts" USING "btree" ("court_type_id");



CREATE INDEX "idx_courts_is_active" ON "public"."courts" USING "btree" ("is_active");



CREATE INDEX "idx_courts_status" ON "public"."courts" USING "btree" ("status");



CREATE INDEX "idx_dashboard_prefs_club" ON "public"."user_dashboard_preferences" USING "btree" ("club_id");



CREATE INDEX "idx_dashboard_prefs_type" ON "public"."user_dashboard_preferences" USING "btree" ("dashboard_type");



CREATE INDEX "idx_dashboard_prefs_user" ON "public"."user_dashboard_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_dunning_records_club_id" ON "public"."dunning_records" USING "btree" ("club_id");



CREATE INDEX "idx_dunning_records_invoice_id" ON "public"."dunning_records" USING "btree" ("invoice_id");



CREATE INDEX "idx_dunning_records_level" ON "public"."dunning_records" USING "btree" ("level");



CREATE INDEX "idx_dunning_records_member_id" ON "public"."dunning_records" USING "btree" ("member_id");



CREATE INDEX "idx_dunning_records_status" ON "public"."dunning_records" USING "btree" ("status");



CREATE INDEX "idx_email_campaigns_club" ON "public"."email_campaigns" USING "btree" ("club_id");



CREATE INDEX "idx_email_campaigns_created_by" ON "public"."email_campaigns" USING "btree" ("created_by");



CREATE INDEX "idx_email_queue_campaign" ON "public"."email_queue" USING "btree" ("campaign_id");



CREATE INDEX "idx_email_queue_club_id" ON "public"."email_queue" USING "btree" ("club_id");



CREATE INDEX "idx_email_queue_status" ON "public"."email_queue" USING "btree" ("status");



CREATE INDEX "idx_family_accounts_group" ON "public"."family_accounts" USING "btree" ("family_group_id");



CREATE INDEX "idx_family_accounts_role" ON "public"."family_accounts" USING "btree" ("role");



CREATE INDEX "idx_family_invites_code" ON "public"."family_invites" USING "btree" ("code");



CREATE INDEX "idx_family_invites_created_by" ON "public"."family_invites" USING "btree" ("created_by");



CREATE INDEX "idx_family_invites_used_by" ON "public"."family_invites" USING "btree" ("used_by");



CREATE INDEX "idx_fee_configurations_billing_cycle" ON "public"."fee_configurations" USING "btree" ("billing_cycle");



CREATE INDEX "idx_fee_configurations_club_active" ON "public"."fee_configurations" USING "btree" ("club_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_fee_configurations_club_id" ON "public"."fee_configurations" USING "btree" ("club_id");



CREATE INDEX "idx_fee_configurations_club_type" ON "public"."fee_configurations" USING "btree" ("club_id", "type");



CREATE INDEX "idx_fee_configurations_conditions" ON "public"."fee_configurations" USING "gin" ("conditions");



CREATE INDEX "idx_fee_configurations_is_active" ON "public"."fee_configurations" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_fee_configurations_type" ON "public"."fee_configurations" USING "btree" ("type");



CREATE INDEX "idx_fee_configurations_validity" ON "public"."fee_configurations" USING "btree" ("valid_from", "valid_until");



CREATE INDEX "idx_feedback_club" ON "public"."trainer_feedback" USING "btree" ("club_id");



CREATE INDEX "idx_feedback_created" ON "public"."trainer_feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feedback_member" ON "public"."trainer_feedback" USING "btree" ("member_id");



CREATE INDEX "idx_feedback_session" ON "public"."trainer_feedback" USING "btree" ("session_id");



CREATE INDEX "idx_feedback_trainer" ON "public"."trainer_feedback" USING "btree" ("trainer_id");



CREATE INDEX "idx_feedback_visible" ON "public"."trainer_feedback" USING "btree" ("is_visible") WHERE ("is_visible" = true);



CREATE INDEX "idx_gamification_badges_user" ON "public"."gamification_badges" USING "btree" ("user_id");



CREATE INDEX "idx_gamification_points" ON "public"."gamification_points" USING "btree" ("points" DESC);



CREATE INDEX "idx_groups_club_id" ON "public"."groups" USING "btree" ("club_id");



CREATE INDEX "idx_hourly_rate_tiers_club_active" ON "public"."hourly_rate_tiers" USING "btree" ("club_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_hourly_rate_tiers_club_id" ON "public"."hourly_rate_tiers" USING "btree" ("club_id");



CREATE INDEX "idx_hourly_rate_tiers_experience_level" ON "public"."hourly_rate_tiers" USING "btree" ("experience_level");



CREATE INDEX "idx_hourly_rate_tiers_is_active" ON "public"."hourly_rate_tiers" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_hours_logs_club" ON "public"."hours_logs" USING "btree" ("club_id");



CREATE INDEX "idx_hours_logs_trainer" ON "public"."hours_logs" USING "btree" ("trainer_id");



CREATE INDEX "idx_installments_invoice" ON "public"."invoice_installments" USING "btree" ("invoice_id");



CREATE INDEX "idx_installments_status" ON "public"."invoice_installments" USING "btree" ("status");



CREATE INDEX "idx_invoice_installments_payment_id" ON "public"."invoice_installments" USING "btree" ("payment_id");



CREATE INDEX "idx_invoice_items_invoice_id" ON "public"."invoice_items" USING "btree" ("invoice_id");



CREATE INDEX "idx_invoice_items_item_type" ON "public"."invoice_items" USING "btree" ("item_type");



CREATE INDEX "idx_invoice_items_recalc_required_at" ON "public"."invoice_items" USING "btree" ("recalc_required_at") WHERE ("recalc_required_at" IS NOT NULL);



CREATE INDEX "idx_invoices_club_id" ON "public"."invoices" USING "btree" ("club_id");



CREATE INDEX "idx_invoices_due_date" ON "public"."invoices" USING "btree" ("due_date");



CREATE INDEX "idx_invoices_invoice_date" ON "public"."invoices" USING "btree" ("invoice_date");



CREATE INDEX "idx_invoices_invoice_number" ON "public"."invoices" USING "btree" ("invoice_number");



CREATE INDEX "idx_invoices_member_id" ON "public"."invoices" USING "btree" ("member_id");



CREATE INDEX "idx_invoices_season_id" ON "public"."invoices" USING "btree" ("season_id");



CREATE INDEX "idx_invoices_status" ON "public"."invoices" USING "btree" ("status");



CREATE INDEX "idx_invoices_trainer_id" ON "public"."invoices" USING "btree" ("trainer_id");



CREATE INDEX "idx_job_execution_log_created_at" ON "public"."job_execution_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_job_execution_log_job_id" ON "public"."job_execution_log" USING "btree" ("job_id");



CREATE INDEX "idx_leagues_club" ON "public"."leagues" USING "btree" ("club_id");



CREATE INDEX "idx_leagues_season" ON "public"."leagues" USING "btree" ("season_year");



CREATE INDEX "idx_leagues_status" ON "public"."leagues" USING "btree" ("status");



CREATE INDEX "idx_match_days_date" ON "public"."match_days" USING "btree" ("scheduled_date");



CREATE INDEX "idx_match_days_league" ON "public"."match_days" USING "btree" ("league_id");



CREATE INDEX "idx_match_days_status" ON "public"."match_days" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_matchday_reminder_logs_idempotent" ON "public"."matchday_reminder_logs" USING "btree" ("matchday_id", "user_id", "channel");



CREATE INDEX "idx_matchday_reminder_logs_matchday" ON "public"."matchday_reminder_logs" USING "btree" ("matchday_id", "sent_at" DESC);



CREATE INDEX "idx_matchday_reminder_logs_user_recent" ON "public"."matchday_reminder_logs" USING "btree" ("user_id", "sent_at" DESC);



CREATE INDEX "idx_mb_club" ON "public"."member_balances" USING "btree" ("club_id");



CREATE INDEX "idx_mb_member" ON "public"."member_balances" USING "btree" ("member_id");



CREATE INDEX "idx_mbe_balance" ON "public"."member_balance_entries" USING "btree" ("member_balance_id");



CREATE INDEX "idx_mbe_created_by" ON "public"."member_balance_entries" USING "btree" ("created_by");



CREATE INDEX "idx_member_booking_prefs_club_id" ON "public"."member_booking_preferences" USING "btree" ("club_id");



CREATE INDEX "idx_member_booking_prefs_user_id" ON "public"."member_booking_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_memberships_office_flags" ON "public"."user_club_memberships" USING "gin" ("office_flags");



CREATE INDEX "idx_messages_broadcast_type" ON "public"."messages" USING "btree" ("broadcast_type") WHERE ("broadcast_type" IS NOT NULL);



CREATE INDEX "idx_messages_club" ON "public"."messages" USING "btree" ("club_id", "created_at" DESC);



CREATE INDEX "idx_messages_receiver" ON "public"."messages" USING "btree" ("receiver_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_messages_receiver_created" ON "public"."messages" USING "btree" ("receiver_id", "created_at" DESC);



CREATE INDEX "idx_messages_sender" ON "public"."messages" USING "btree" ("sender_id", "created_at" DESC);



CREATE INDEX "idx_messages_sender_created" ON "public"."messages" USING "btree" ("sender_id", "created_at" DESC);



CREATE INDEX "idx_messages_thread" ON "public"."messages" USING "btree" ("replied_to_id");



CREATE INDEX "idx_news_comments_created_at" ON "public"."news_comments" USING "btree" ("created_at");



CREATE INDEX "idx_news_comments_post_id" ON "public"."news_comments" USING "btree" ("post_id");



CREATE INDEX "idx_news_comments_user_id" ON "public"."news_comments" USING "btree" ("user_id");



CREATE INDEX "idx_news_posts_author_id" ON "public"."news_posts" USING "btree" ("author_id");



CREATE INDEX "idx_news_posts_category" ON "public"."news_posts" USING "btree" ("category");



CREATE INDEX "idx_news_posts_club" ON "public"."news_posts" USING "btree" ("club_id");



CREATE INDEX "idx_news_posts_club_id" ON "public"."news_posts" USING "btree" ("club_id");



CREATE INDEX "idx_news_posts_pinned" ON "public"."news_posts" USING "btree" ("is_pinned") WHERE ("is_pinned" = true);



CREATE INDEX "idx_news_posts_published_at" ON "public"."news_posts" USING "btree" ("published_at");



CREATE INDEX "idx_news_posts_slug" ON "public"."news_posts" USING "btree" ("slug");



CREATE INDEX "idx_news_posts_status" ON "public"."news_posts" USING "btree" ("status");



CREATE INDEX "idx_notification_consents_channel" ON "public"."notification_consents" USING "btree" ("channel");



CREATE INDEX "idx_notification_consents_user_id" ON "public"."notification_consents" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_club" ON "public"."notifications" USING "btree" ("club_id", "created_at" DESC);



CREATE INDEX "idx_notifications_club_id" ON "public"."notifications" USING "btree" ("club_id");



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type", "created_at" DESC);



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id", "read") WHERE ("read" = false);



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_open_match_participants_match" ON "public"."open_match_participants" USING "btree" ("match_id");



CREATE INDEX "idx_open_match_participants_user" ON "public"."open_match_participants" USING "btree" ("user_id");



CREATE INDEX "idx_open_matches_club" ON "public"."open_matches" USING "btree" ("club_id");



CREATE INDEX "idx_open_matches_club_date" ON "public"."open_matches" USING "btree" ("club_id", "match_date", "status");



CREATE INDEX "idx_open_matches_date" ON "public"."open_matches" USING "btree" ("match_date");



CREATE INDEX "idx_open_matches_status" ON "public"."open_matches" USING "btree" ("club_id", "status");



CREATE INDEX "idx_payment_settings_club_active" ON "public"."payment_settings" USING "btree" ("club_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_payment_settings_club_id" ON "public"."payment_settings" USING "btree" ("club_id");



CREATE INDEX "idx_payment_settings_config" ON "public"."payment_settings" USING "gin" ("config");



CREATE INDEX "idx_payment_settings_default" ON "public"."payment_settings" USING "btree" ("club_id", "is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_payment_settings_gateway" ON "public"."payment_settings" USING "btree" ("gateway");



CREATE INDEX "idx_payment_settings_is_active" ON "public"."payment_settings" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_payments_invoice_id" ON "public"."payments" USING "btree" ("invoice_id");



CREATE INDEX "idx_plan_entries_club" ON "public"."season_plan_entries" USING "btree" ("club_id");



CREATE INDEX "idx_plan_entries_court" ON "public"."season_plan_entries" USING "btree" ("court_id");



CREATE INDEX "idx_plan_entries_day_time" ON "public"."season_plan_entries" USING "btree" ("day_of_week", "start_time");



CREATE INDEX "idx_plan_entries_group" ON "public"."season_plan_entries" USING "btree" ("group_id");



CREATE INDEX "idx_plan_entries_published_session" ON "public"."season_plan_entries" USING "btree" ("published_session_id") WHERE ("published_session_id" IS NOT NULL);



CREATE INDEX "idx_plan_entries_season" ON "public"."season_plan_entries" USING "btree" ("season_id");



CREATE INDEX "idx_plan_entries_status" ON "public"."season_plan_entries" USING "btree" ("status");



CREATE INDEX "idx_plan_entries_trainer" ON "public"."season_plan_entries" USING "btree" ("trainer_id");



CREATE INDEX "idx_planning_conflicts_resolved_by" ON "public"."planning_conflicts" USING "btree" ("resolved_by");



CREATE INDEX "idx_planning_history_action" ON "public"."season_planning_history" USING "btree" ("action_type");



CREATE INDEX "idx_planning_history_actor" ON "public"."season_planning_history" USING "btree" ("actor_id");



CREATE INDEX "idx_planning_history_club" ON "public"."season_planning_history" USING "btree" ("club_id");



CREATE INDEX "idx_planning_history_created" ON "public"."season_planning_history" USING "btree" ("created_at");



CREATE INDEX "idx_planning_history_season" ON "public"."season_planning_history" USING "btree" ("season_id");



CREATE INDEX "idx_pricing_rules_club_id" ON "public"."pricing_rules" USING "btree" ("club_id");



CREATE INDEX "idx_push_subs_active" ON "public"."push_subscriptions" USING "btree" ("club_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_push_subs_club" ON "public"."push_subscriptions" USING "btree" ("club_id");



CREATE UNIQUE INDEX "idx_push_subs_endpoint" ON "public"."push_subscriptions" USING "btree" ("endpoint");



CREATE INDEX "idx_push_subs_user" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_qr_checkins_booking_id" ON "public"."qr_checkins" USING "btree" ("booking_id");



CREATE INDEX "idx_qr_checkins_session" ON "public"."qr_checkins" USING "btree" ("session_id");



CREATE INDEX "idx_qr_checkins_user" ON "public"."qr_checkins" USING "btree" ("user_id");



CREATE INDEX "idx_rate_history_changed_at" ON "public"."rate_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_rate_history_club_id" ON "public"."rate_history" USING "btree" ("club_id");



CREATE INDEX "idx_rate_history_trainer_id" ON "public"."rate_history" USING "btree" ("trainer_id");



CREATE INDEX "idx_rating_summary_avg" ON "public"."trainer_rating_summary" USING "btree" ("average_rating" DESC);



CREATE INDEX "idx_rating_summary_club" ON "public"."trainer_rating_summary" USING "btree" ("club_id");



CREATE INDEX "idx_rating_summary_trainer" ON "public"."trainer_rating_summary" USING "btree" ("trainer_id");



CREATE INDEX "idx_registration_requests_club" ON "public"."registration_requests" USING "btree" ("club_id");



CREATE INDEX "idx_registration_requests_email" ON "public"."registration_requests" USING "btree" ("email");



CREATE INDEX "idx_registration_requests_reviewed_by" ON "public"."registration_requests" USING "btree" ("reviewed_by");



CREATE INDEX "idx_registration_requests_status" ON "public"."registration_requests" USING "btree" ("status");



CREATE INDEX "idx_schedules_club_id" ON "public"."schedules" USING "btree" ("club_id");



CREATE INDEX "idx_school_holidays_bundesland" ON "public"."school_holidays" USING "btree" ("bundesland");



CREATE INDEX "idx_school_holidays_dates" ON "public"."school_holidays" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_season_billing_configs_club" ON "public"."season_billing_configs" USING "btree" ("club_id");



CREATE INDEX "idx_season_billing_configs_season" ON "public"."season_billing_configs" USING "btree" ("season_id");



CREATE INDEX "idx_season_group_weeks_club_week" ON "public"."season_group_weeks" USING "btree" ("club_id", "week_monday");



CREATE INDEX "idx_season_group_weeks_group" ON "public"."season_group_weeks" USING "btree" ("group_id", "is_active");



CREATE INDEX "idx_season_group_weeks_season" ON "public"."season_group_weeks" USING "btree" ("season_id");



CREATE INDEX "idx_season_waitlists_alternative_group_id" ON "public"."season_waitlists" USING "btree" ("alternative_group_id");



CREATE INDEX "idx_seasons_club_active" ON "public"."seasons" USING "btree" ("club_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_seasons_club_dates" ON "public"."seasons" USING "btree" ("club_id", "start_date", "end_date");



CREATE INDEX "idx_seasons_created_by" ON "public"."seasons" USING "btree" ("created_by");



CREATE INDEX "idx_seasons_planning_status" ON "public"."seasons" USING "btree" ("planning_status");



CREATE INDEX "idx_sepa_mandates_club_id" ON "public"."sepa_mandates" USING "btree" ("club_id");



CREATE INDEX "idx_sepa_mandates_is_active" ON "public"."sepa_mandates" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "idx_sepa_mandates_mandate_reference" ON "public"."sepa_mandates" USING "btree" ("mandate_reference");



CREATE INDEX "idx_sepa_mandates_member_active" ON "public"."sepa_mandates" USING "btree" ("member_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_sepa_mandates_member_id" ON "public"."sepa_mandates" USING "btree" ("member_id");



CREATE INDEX "idx_sessions_cancelled_at" ON "public"."sessions" USING "btree" ("cancelled_at") WHERE ("cancelled_at" IS NOT NULL);



CREATE INDEX "idx_sessions_court_id" ON "public"."sessions" USING "btree" ("court_id");



CREATE INDEX "idx_sessions_schedule_id" ON "public"."sessions" USING "btree" ("schedule_id");



CREATE INDEX "idx_sessions_schedule_week" ON "public"."sessions" USING "btree" ("schedule_id", "week_number");



CREATE INDEX "idx_sessions_timeslot" ON "public"."sessions" USING "btree" ("timeslot_start", "timeslot_end");



CREATE INDEX "idx_sessions_trainer_id" ON "public"."sessions" USING "btree" ("trainer_id");



CREATE INDEX "idx_sessions_type" ON "public"."sessions" USING "btree" ("session_type") WHERE ("session_type" = 'walk_in'::"text");



CREATE INDEX "idx_sessions_week_number" ON "public"."sessions" USING "btree" ("week_number");



CREATE INDEX "idx_shop_orders_user" ON "public"."shop_orders" USING "btree" ("user_id");



CREATE INDEX "idx_shop_products_active" ON "public"."shop_products" USING "btree" ("is_active");



CREATE INDEX "idx_shop_products_club" ON "public"."shop_products" USING "btree" ("club_id");



CREATE INDEX "idx_sync_log_club_id" ON "public"."nuliga_sync_log" USING "btree" ("club_id");



CREATE INDEX "idx_sync_log_created_at" ON "public"."nuliga_sync_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sync_log_league_id" ON "public"."nuliga_sync_log" USING "btree" ("league_id");



CREATE INDEX "idx_sync_log_status" ON "public"."nuliga_sync_log" USING "btree" ("status");



CREATE INDEX "idx_system_settings_category" ON "public"."system_settings" USING "btree" ("category");



CREATE INDEX "idx_system_settings_club_category" ON "public"."system_settings" USING "btree" ("club_id", "category");



CREATE INDEX "idx_system_settings_club_id" ON "public"."system_settings" USING "btree" ("club_id");



CREATE INDEX "idx_system_settings_club_key" ON "public"."system_settings" USING "btree" ("club_id", "key");



CREATE INDEX "idx_system_settings_is_public" ON "public"."system_settings" USING "btree" ("is_public") WHERE ("is_public" = true);



CREATE INDEX "idx_system_settings_key" ON "public"."system_settings" USING "btree" ("key");



CREATE INDEX "idx_system_settings_updated_by" ON "public"."system_settings" USING "btree" ("updated_by");



CREATE INDEX "idx_system_settings_validation" ON "public"."system_settings" USING "gin" ("validation");



CREATE INDEX "idx_team_members_member" ON "public"."team_members" USING "btree" ("member_id");



CREATE INDEX "idx_team_members_team" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "idx_teams_club" ON "public"."teams" USING "btree" ("club_id");



CREATE INDEX "idx_teams_league" ON "public"."teams" USING "btree" ("league_id");



CREATE INDEX "idx_teams_position" ON "public"."teams" USING "btree" ("league_id", "position");



CREATE INDEX "idx_tgm_active" ON "public"."training_group_memberships" USING "btree" ("member_id", "club_id") WHERE ("left_at" IS NULL);



CREATE INDEX "idx_tgm_created_by" ON "public"."training_group_memberships" USING "btree" ("created_by");



CREATE INDEX "idx_tgm_group" ON "public"."training_group_memberships" USING "btree" ("training_group_id");



CREATE INDEX "idx_tgm_member" ON "public"."training_group_memberships" USING "btree" ("member_id");



CREATE INDEX "idx_tournament_matches_court_id" ON "public"."tournament_matches" USING "btree" ("court_id");



CREATE INDEX "idx_tournament_matches_player1_id" ON "public"."tournament_matches" USING "btree" ("player1_id");



CREATE INDEX "idx_tournament_matches_player2_id" ON "public"."tournament_matches" USING "btree" ("player2_id");



CREATE INDEX "idx_tournament_matches_tournament_id" ON "public"."tournament_matches" USING "btree" ("tournament_id");



CREATE INDEX "idx_tournament_matches_winner_id" ON "public"."tournament_matches" USING "btree" ("winner_id");



CREATE INDEX "idx_tournament_registrations_partner_id" ON "public"."tournament_registrations" USING "btree" ("partner_id");



CREATE INDEX "idx_tournaments_club_id" ON "public"."tournaments" USING "btree" ("club_id");



CREATE INDEX "idx_tournaments_organizer_id" ON "public"."tournaments" USING "btree" ("organizer_id");



CREATE INDEX "idx_trainer_absences_approved_by" ON "public"."trainer_absences" USING "btree" ("approved_by");



CREATE INDEX "idx_trainer_absences_club_dates" ON "public"."trainer_absences" USING "btree" ("club_id", "start_date", "end_date");



CREATE INDEX "idx_trainer_absences_club_id" ON "public"."trainer_absences" USING "btree" ("club_id");



CREATE INDEX "idx_trainer_absences_club_status" ON "public"."trainer_absences" USING "btree" ("club_id", "status") WHERE (("status")::"text" = 'pending'::"text");



CREATE INDEX "idx_trainer_absences_date_range" ON "public"."trainer_absences" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_trainer_absences_dates" ON "public"."trainer_absences" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_trainer_absences_status" ON "public"."trainer_absences" USING "btree" ("status");



CREATE INDEX "idx_trainer_absences_substitute" ON "public"."trainer_absences" USING "btree" ("substitute_trainer_id");



CREATE INDEX "idx_trainer_absences_trainer_dates" ON "public"."trainer_absences" USING "btree" ("trainer_id", "start_date", "end_date");



CREATE INDEX "idx_trainer_absences_trainer_id" ON "public"."trainer_absences" USING "btree" ("trainer_id");



CREATE INDEX "idx_trainer_absences_type" ON "public"."trainer_absences" USING "btree" ("type");



CREATE INDEX "idx_trainer_absences_user_id" ON "public"."trainer_absences" USING "btree" ("user_id");



CREATE INDEX "idx_trainer_assignments_active" ON "public"."trainer_assignments" USING "btree" ("is_active");



CREATE INDEX "idx_trainer_assignments_club_id" ON "public"."trainer_assignments" USING "btree" ("club_id");



CREATE INDEX "idx_trainer_assignments_user_id" ON "public"."trainer_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_trainer_availability_lookup" ON "public"."trainer_availabilities" USING "btree" ("trainer_id", "date", "status");



CREATE INDEX "idx_trainer_feedback_group_id" ON "public"."trainer_feedback" USING "btree" ("group_id");



CREATE INDEX "idx_trainer_feedback_moderated_by" ON "public"."trainer_feedback" USING "btree" ("moderated_by");



CREATE INDEX "idx_trainer_hourly_rates_club_id" ON "public"."trainer_hourly_rates" USING "btree" ("club_id");



CREATE INDEX "idx_trainer_hourly_rates_trainer_id" ON "public"."trainer_hourly_rates" USING "btree" ("trainer_id");



CREATE INDEX "idx_trainer_hourly_rates_valid_from" ON "public"."trainer_hourly_rates" USING "btree" ("valid_from" DESC);



CREATE INDEX "idx_trainer_hourly_rates_valid_period" ON "public"."trainer_hourly_rates" USING "btree" ("trainer_id", "valid_from", "valid_until");



CREATE INDEX "idx_trainer_notes_member" ON "public"."trainer_member_notes" USING "btree" ("member_id", "club_id");



CREATE INDEX "idx_trainer_profiles_club_id" ON "public"."trainer_profiles" USING "btree" ("club_id");



CREATE INDEX "idx_trainer_profiles_club_status" ON "public"."trainer_profiles" USING "btree" ("club_id", "status") WHERE (("status")::"text" = 'active'::"text");



CREATE INDEX "idx_trainer_profiles_created_at" ON "public"."trainer_profiles" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_trainer_profiles_email" ON "public"."trainer_profiles" USING "btree" ("email");



CREATE INDEX "idx_trainer_profiles_status" ON "public"."trainer_profiles" USING "btree" ("status");



CREATE INDEX "idx_trainer_profiles_updated_at" ON "public"."trainer_profiles" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_trainer_profiles_user_id" ON "public"."trainer_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_trainers_user_id" ON "public"."trainers" USING "btree" ("user_id");



CREATE INDEX "idx_training_groups_schedule_id" ON "public"."training_groups" USING "btree" ("schedule_id");



CREATE INDEX "idx_trial_trainings_club_date" ON "public"."trial_trainings" USING "btree" ("club_id", "scheduled_date");



CREATE INDEX "idx_trial_trainings_club_id" ON "public"."trial_trainings" USING "btree" ("club_id");



CREATE INDEX "idx_trial_trainings_club_status" ON "public"."trial_trainings" USING "btree" ("club_id", "status");



CREATE INDEX "idx_trial_trainings_court_id" ON "public"."trial_trainings" USING "btree" ("court_id");



CREATE INDEX "idx_trial_trainings_marketing_consent_token" ON "public"."trial_trainings" USING "btree" ("marketing_consent_token") WHERE ("marketing_consent_token" IS NOT NULL);



CREATE INDEX "idx_trial_trainings_participant_email" ON "public"."trial_trainings" USING "btree" ("participant_email");



CREATE INDEX "idx_trial_trainings_participant_name" ON "public"."trial_trainings" USING "gin" ("to_tsvector"('"simple"'::"regconfig", ((("participant_first_name")::"text" || ' '::"text") || ("participant_last_name")::"text")));



CREATE INDEX "idx_trial_trainings_scheduled_date" ON "public"."trial_trainings" USING "btree" ("scheduled_date");



CREATE INDEX "idx_trial_trainings_status" ON "public"."trial_trainings" USING "btree" ("status");



CREATE INDEX "idx_trial_trainings_trainer_id" ON "public"."trial_trainings" USING "btree" ("trainer_id");



CREATE INDEX "idx_trial_trainings_upcoming" ON "public"."trial_trainings" USING "btree" ("scheduled_date", "scheduled_time") WHERE (("status")::"text" = 'scheduled'::"text");



CREATE INDEX "idx_user_club_memberships_club_id" ON "public"."user_club_memberships" USING "btree" ("club_id");



CREATE INDEX "idx_user_club_memberships_deactivated_by" ON "public"."user_club_memberships" USING "btree" ("deactivated_by");



CREATE INDEX "idx_user_club_memberships_fee_configuration_id" ON "public"."user_club_memberships" USING "btree" ("fee_configuration_id");



CREATE INDEX "idx_user_club_memberships_user_id" ON "public"."user_club_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_user_prefs_club" ON "public"."user_training_preferences" USING "btree" ("club_id");



CREATE INDEX "idx_user_prefs_season" ON "public"."user_training_preferences" USING "btree" ("season_id");



CREATE INDEX "idx_user_prefs_submitted" ON "public"."user_training_preferences" USING "btree" ("season_id", "is_submitted");



CREATE INDEX "idx_user_prefs_user" ON "public"."user_training_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_users_stripe_customer" ON "public"."users" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE INDEX "idx_users_subscription_status" ON "public"."users" USING "btree" ("subscription_status");



CREATE INDEX "idx_users_subscription_tier" ON "public"."users" USING "btree" ("subscription_tier");



CREATE INDEX "idx_waitlist_club" ON "public"."session_waitlist" USING "btree" ("club_id");



CREATE INDEX "idx_waitlist_entries_club_id" ON "public"."waitlist_entries" USING "btree" ("club_id");



CREATE INDEX "idx_waitlist_entries_court_id" ON "public"."waitlist_entries" USING "btree" ("court_id");



CREATE INDEX "idx_waitlist_member" ON "public"."session_waitlist" USING "btree" ("member_id");



CREATE INDEX "idx_waitlist_session" ON "public"."session_waitlist" USING "btree" ("session_id", "position");



CREATE INDEX "idx_waitlist_user" ON "public"."waitlist_entries" USING "btree" ("user_id");



CREATE INDEX "idx_work_duties_assigned" ON "public"."work_duties" USING "btree" ("assigned_to");



CREATE INDEX "idx_work_duties_club" ON "public"."work_duties" USING "btree" ("club_id");



CREATE INDEX "idx_work_duties_date" ON "public"."work_duties" USING "btree" ("scheduled_date");



CREATE INDEX "idx_work_duties_status" ON "public"."work_duties" USING "btree" ("status");



CREATE INDEX "idx_work_duties_type" ON "public"."work_duties" USING "btree" ("duty_type");



CREATE INDEX "idx_work_duty_assignments_duty" ON "public"."work_duty_assignments" USING "btree" ("duty_id");



CREATE INDEX "idx_work_duty_assignments_member" ON "public"."work_duty_assignments" USING "btree" ("member_id");



CREATE INDEX "idx_work_duty_assignments_status" ON "public"."work_duty_assignments" USING "btree" ("status");



CREATE INDEX "invoice_items_invoice_idx" ON "public"."invoice_items" USING "btree" ("invoice_id");



CREATE INDEX "invoices_club_idx" ON "public"."invoices" USING "btree" ("club_id");



CREATE INDEX "invoices_due_date_idx" ON "public"."invoices" USING "btree" ("due_date");



CREATE INDEX "invoices_invoice_number_unique" ON "public"."invoices" USING "btree" ("invoice_number");



CREATE INDEX "invoices_member_idx" ON "public"."invoices" USING "btree" ("member_id");



CREATE INDEX "invoices_status_idx" ON "public"."invoices" USING "btree" ("status");



CREATE INDEX "league_players_club_idx" ON "public"."league_players" USING "btree" ("club_id");



CREATE UNIQUE INDEX "league_players_league_name_uniq" ON "public"."league_players" USING "btree" ("league_id", "lower"(("name")::"text"));



CREATE INDEX "league_players_member_idx" ON "public"."league_players" USING "btree" ("member_id");



CREATE INDEX "match_results_away_player_idx" ON "public"."match_results" USING "gin" ("away_player_ids");



CREATE INDEX "match_results_club_idx" ON "public"."match_results" USING "btree" ("club_id");



CREATE INDEX "match_results_home_player_idx" ON "public"."match_results" USING "gin" ("home_player_ids");



CREATE INDEX "match_results_match_day_idx" ON "public"."match_results" USING "btree" ("match_day_id");



CREATE INDEX "match_results_outcome_idx" ON "public"."match_results" USING "btree" ("outcome");



CREATE INDEX "meeting_invitations_member_idx" ON "public"."meeting_invitations" USING "btree" ("member_id");



CREATE INDEX "meeting_invitations_status_idx" ON "public"."meeting_invitations" USING "btree" ("decision_id", "status");



CREATE INDEX "member_sched_prefs_club_idx" ON "public"."member_schedule_preferences" USING "btree" ("club_id");



CREATE INDEX "member_sched_prefs_level_idx" ON "public"."member_schedule_preferences" USING "btree" ("preferred_level");



CREATE INDEX "member_sched_prefs_user_idx" ON "public"."member_schedule_preferences" USING "btree" ("user_id");



CREATE INDEX "messages_inbox_idx" ON "public"."messages" USING "btree" ("receiver_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "messages_sent_idx" ON "public"."messages" USING "btree" ("sender_id", "created_at" DESC) WHERE ("sender_deleted_at" IS NULL);



CREATE INDEX "name_idx" ON "public"."clubs" USING "btree" ("name");



CREATE INDEX "plan_entries_club_idx" ON "public"."season_plan_entries" USING "btree" ("club_id");



CREATE INDEX "plan_entries_court_idx" ON "public"."season_plan_entries" USING "btree" ("court_id");



CREATE INDEX "plan_entries_day_time_idx" ON "public"."season_plan_entries" USING "btree" ("day_of_week", "start_time");



CREATE INDEX "plan_entries_group_idx" ON "public"."season_plan_entries" USING "btree" ("group_id");



CREATE INDEX "plan_entries_season_idx" ON "public"."season_plan_entries" USING "btree" ("season_id");



CREATE INDEX "plan_entries_status_idx" ON "public"."season_plan_entries" USING "btree" ("status");



CREATE INDEX "plan_entries_trainer_idx" ON "public"."season_plan_entries" USING "btree" ("trainer_id");



CREATE INDEX "planning_config_club_idx" ON "public"."season_planning_configs" USING "btree" ("club_id");



CREATE INDEX "planning_config_club_season_unique" ON "public"."season_planning_configs" USING "btree" ("club_id", "season_id");



CREATE INDEX "planning_config_season_idx" ON "public"."season_planning_configs" USING "btree" ("season_id");



CREATE INDEX "planning_history_action_idx" ON "public"."season_planning_history" USING "btree" ("action_type");



CREATE INDEX "planning_history_actor_idx" ON "public"."season_planning_history" USING "btree" ("actor_id");



CREATE INDEX "planning_history_club_idx" ON "public"."season_planning_history" USING "btree" ("club_id");



CREATE INDEX "planning_history_created_idx" ON "public"."season_planning_history" USING "btree" ("created_at");



CREATE INDEX "planning_history_season_idx" ON "public"."season_planning_history" USING "btree" ("season_id");



CREATE INDEX "players_elo_idx" ON "public"."players" USING "btree" ("elo_rating" DESC);



CREATE INDEX "pricing_rules_club_season_idx" ON "public"."pricing_rules" USING "btree" ("club_id", "season_id");



CREATE INDEX "pricing_rules_name_idx" ON "public"."pricing_rules" USING "btree" ("name");



CREATE INDEX "pricing_rules_season_id_idx" ON "public"."pricing_rules" USING "btree" ("season_id");



CREATE INDEX "pricing_rules_validity_idx" ON "public"."pricing_rules" USING "btree" ("valid_from", "valid_until");



CREATE INDEX "rsvp_club_idx" ON "public"."session_rsvps" USING "btree" ("club_id");



CREATE INDEX "rsvp_member_idx" ON "public"."session_rsvps" USING "btree" ("member_id");



CREATE INDEX "rsvp_session_member_idx" ON "public"."session_rsvps" USING "btree" ("session_id", "member_id");



CREATE INDEX "rsvp_session_status_idx" ON "public"."session_rsvps" USING "btree" ("session_id", "status");



CREATE INDEX "rsvp_status_idx" ON "public"."session_rsvps" USING "btree" ("status");



CREATE INDEX "schedules_club_active_idx" ON "public"."schedules" USING "btree" ("club_id", "is_active");



CREATE INDEX "schedules_club_id_idx" ON "public"."schedules" USING "btree" ("club_id");



CREATE INDEX "schedules_is_active_idx" ON "public"."schedules" USING "btree" ("is_active");



CREATE INDEX "season_plan_entries_created_at_idx" ON "public"."season_plan_entries" USING "btree" ("created_at");



CREATE INDEX "season_plan_versions_season_idx" ON "public"."season_plan_versions" USING "btree" ("season_id", "created_at" DESC);



CREATE INDEX "seasons_club_active_idx" ON "public"."seasons" USING "btree" ("club_id", "is_active");



CREATE INDEX "seasons_club_dates_idx" ON "public"."seasons" USING "btree" ("club_id", "start_date", "end_date");



CREATE INDEX "seasons_planning_status_idx" ON "public"."seasons" USING "btree" ("planning_status");



CREATE INDEX "sessions_court_idx" ON "public"."sessions" USING "btree" ("court_id");



CREATE INDEX "sessions_plan_entry_idx" ON "public"."sessions" USING "btree" ("plan_entry_id");



CREATE INDEX "sessions_schedule_idx" ON "public"."sessions" USING "btree" ("schedule_id");



CREATE INDEX "sessions_trainer_idx" ON "public"."sessions" USING "btree" ("trainer_id");



CREATE INDEX "sessions_week_idx" ON "public"."sessions" USING "btree" ("week_number");



CREATE INDEX "special_event_registrations_event_id_idx" ON "public"."special_event_registrations" USING "btree" ("event_id");



CREATE INDEX "special_event_registrations_event_idx" ON "public"."special_event_registrations" USING "btree" ("event_id");



CREATE INDEX "special_event_registrations_user_id_idx" ON "public"."special_event_registrations" USING "btree" ("user_id");



CREATE INDEX "special_event_registrations_user_idx" ON "public"."special_event_registrations" USING "btree" ("user_id");



CREATE INDEX "special_events_club_id_start_date_idx" ON "public"."special_events" USING "btree" ("club_id", "start_date");



CREATE INDEX "special_events_club_start_idx" ON "public"."special_events" USING "btree" ("club_id", "start_date");



CREATE INDEX "stats_club_idx" ON "public"."season_statistics" USING "btree" ("club_id");



CREATE INDEX "stats_season_unique" ON "public"."season_statistics" USING "btree" ("season_id");



CREATE INDEX "trainer_availabilities_date_idx" ON "public"."trainer_availabilities" USING "btree" ("date");



CREATE INDEX "trainer_availabilities_status_idx" ON "public"."trainer_availabilities" USING "btree" ("status");



CREATE INDEX "trainer_availabilities_trainer_date_idx" ON "public"."trainer_availabilities" USING "btree" ("trainer_id", "date");



CREATE INDEX "trainer_availabilities_trainer_idx" ON "public"."trainer_availabilities" USING "btree" ("trainer_id");



CREATE UNIQUE INDEX "trainer_billings_invoice_number_unique" ON "public"."trainer_billings" USING "btree" ("invoice_number") WHERE ("invoice_number" IS NOT NULL);



CREATE INDEX "trainer_billings_period_idx" ON "public"."trainer_billings" USING "btree" ("billing_period_id");



CREATE INDEX "trainer_billings_status_idx" ON "public"."trainer_billings" USING "btree" ("status");



CREATE INDEX "trainer_billings_trainer_idx" ON "public"."trainer_billings" USING "btree" ("trainer_id");



CREATE INDEX "trainer_club_club_idx" ON "public"."trainer_club" USING "btree" ("club_id");



CREATE INDEX "trainer_club_trainer_idx" ON "public"."trainer_club" USING "btree" ("trainer_id");



CREATE INDEX "trainer_slot_waitlist_slot_idx" ON "public"."trainer_slot_waitlist" USING "btree" ("slot_id");



CREATE INDEX "trainer_slot_waitlist_user_idx" ON "public"."trainer_slot_waitlist" USING "btree" ("user_id");



CREATE INDEX "trainers_is_active_idx" ON "public"."trainers" USING "btree" ("is_active");



CREATE INDEX "trainers_name_idx" ON "public"."trainers" USING "btree" ("name");



CREATE INDEX "training_groups_club_active_idx" ON "public"."training_groups" USING "btree" ("club_id", "is_active");



CREATE INDEX "training_groups_club_idx" ON "public"."training_groups" USING "btree" ("club_id");



CREATE INDEX "training_groups_is_active_idx" ON "public"."training_groups" USING "btree" ("is_active");



CREATE INDEX "training_groups_schedule_id_idx" ON "public"."training_groups" USING "btree" ("schedule_id");



CREATE INDEX "trial_trainings_created_at_idx" ON "public"."trial_trainings" USING "btree" ("created_at");



CREATE INDEX "user_club_memberships_created_at_idx" ON "public"."user_club_memberships" USING "btree" ("created_at");



CREATE INDEX "user_club_memberships_is_active_idx" ON "public"."user_club_memberships" USING "btree" ("is_active");



CREATE INDEX "user_club_memberships_reactivation_idx" ON "public"."user_club_memberships" USING "btree" ("club_id", "is_active") WHERE ("last_reactivation_sent_at" IS NULL);



CREATE INDEX "user_club_memberships_tenant_idx" ON "public"."user_club_memberships" USING "btree" ("tenant_id");



CREATE INDEX "user_prefs_club_idx" ON "public"."user_training_preferences" USING "btree" ("club_id");



CREATE INDEX "user_prefs_season_idx" ON "public"."user_training_preferences" USING "btree" ("season_id");



CREATE INDEX "user_prefs_submitted_idx" ON "public"."user_training_preferences" USING "btree" ("season_id", "is_submitted");



CREATE INDEX "user_prefs_user_idx" ON "public"."user_training_preferences" USING "btree" ("user_id");



CREATE INDEX "user_training_preferences_created_at_idx" ON "public"."user_training_preferences" USING "btree" ("created_at");



CREATE INDEX "users_created_at_idx" ON "public"."users" USING "btree" ("created_at");



CREATE INDEX "users_dtb_id_idx" ON "public"."users" USING "btree" ("dtb_id");



CREATE INDEX "users_email_lower_idx" ON "public"."users" USING "btree" ("lower"(("email")::"text"));



CREATE INDEX "users_lk_rating_idx" ON "public"."users" USING "btree" ("lk_rating") WHERE ("lk_rating" IS NOT NULL);



CREATE INDEX "waitlists_club_idx" ON "public"."season_waitlists" USING "btree" ("club_id");



CREATE INDEX "waitlists_group_idx" ON "public"."season_waitlists" USING "btree" ("group_id");



CREATE INDEX "waitlists_group_position_idx" ON "public"."season_waitlists" USING "btree" ("group_id", "position");



CREATE INDEX "waitlists_member_idx" ON "public"."season_waitlists" USING "btree" ("member_id");



CREATE INDEX "waitlists_season_idx" ON "public"."season_waitlists" USING "btree" ("season_id");



CREATE INDEX "waitlists_status_idx" ON "public"."season_waitlists" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "audit_invoices" AFTER INSERT OR DELETE OR UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."audit_finance_change"();



CREATE OR REPLACE TRIGGER "audit_payments" AFTER INSERT OR DELETE OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."audit_finance_change"();



CREATE OR REPLACE TRIGGER "audit_sepa_mandates" AFTER INSERT OR DELETE OR UPDATE ON "public"."sepa_mandates" FOR EACH ROW EXECUTE FUNCTION "public"."audit_finance_change"();



CREATE OR REPLACE TRIGGER "ensure_single_default_payment_setting_trigger" BEFORE INSERT OR UPDATE OF "is_default" ON "public"."payment_settings" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_default_payment_setting"();



CREATE OR REPLACE TRIGGER "fee_configurations_updated_at" BEFORE UPDATE ON "public"."fee_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."update_fee_configurations_updated_at"();



CREATE OR REPLACE TRIGGER "gobd_invoice_immutability" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_invoice_content_update"();



CREATE OR REPLACE TRIGGER "log_season_actions" AFTER INSERT OR UPDATE ON "public"."seasons" FOR EACH ROW EXECUTE FUNCTION "public"."log_season_planning_action"();



CREATE OR REPLACE TRIGGER "payment_settings_updated_at" BEFORE UPDATE ON "public"."payment_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_payment_settings_updated_at"();



CREATE OR REPLACE TRIGGER "prevent_required_setting_deletion_trigger" BEFORE DELETE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_required_setting_deletion"();



CREATE OR REPLACE TRIGGER "season_plan_entries_updated_at" BEFORE UPDATE ON "public"."season_plan_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_season_plan_entries_updated_at"();



CREATE OR REPLACE TRIGGER "season_plan_entry_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."season_plan_entries" FOR EACH ROW EXECUTE FUNCTION "public"."log_season_plan_entry_changes"();



CREATE OR REPLACE TRIGGER "set_feedback_updated_at" BEFORE UPDATE ON "public"."trainer_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_hourly_rate_tiers_updated_at" BEFORE UPDATE ON "public"."hourly_rate_tiers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_trainer_hourly_rates_updated_at" BEFORE UPDATE ON "public"."trainer_hourly_rates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_trainer_profiles_updated_at" BEFORE UPDATE ON "public"."trainer_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."background_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."booking_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."court_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."courts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."dunning_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."gamification_points" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."invoice_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."member_balances" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."member_schedule_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."news_posts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."season_planning_configs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."season_waitlists" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."session_rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."trainers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_user_prefs_last_modified" BEFORE UPDATE ON "public"."user_training_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_preference_last_modified"();



CREATE OR REPLACE TRIGGER "system_settings_updated_at" BEFORE UPDATE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_system_settings_updated_at"();



CREATE OR REPLACE TRIGGER "trainer_absences_updated_at" BEFORE UPDATE ON "public"."trainer_absences" FOR EACH ROW EXECUTE FUNCTION "public"."update_trainer_absences_updated_at"();



CREATE OR REPLACE TRIGGER "trg_check_booking_overlap" BEFORE INSERT OR UPDATE OF "status", "session_start_time", "court_id", "session_id" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."check_booking_overlap"();



CREATE OR REPLACE TRIGGER "trg_decision_changes_validate_actor" BEFORE INSERT ON "public"."decision_changes" FOR EACH ROW EXECUTE FUNCTION "public"."decision_changes_validate_actor"();



CREATE OR REPLACE TRIGGER "trg_mark_invoice_items_for_recalc" AFTER UPDATE OF "duration_minutes", "group_id", "trainer_id", "court_id", "max_participants", "expected_participants" ON "public"."season_plan_entries" FOR EACH ROW EXECUTE FUNCTION "public"."mark_invoice_items_for_recalc_on_plan_change"();



COMMENT ON TRIGGER "trg_mark_invoice_items_for_recalc" ON "public"."season_plan_entries" IS 'Audit-grade recalc flag. Set invoice_items.recalc_required_at = NOW() when an underlying plan entry changes pricing-relevant fields (group, trainer rate, court, duration, participants).';



CREATE OR REPLACE TRIGGER "trg_match_results_touch_updated_at" BEFORE UPDATE ON "public"."match_results" FOR EACH ROW EXECUTE FUNCTION "public"."match_results_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_match_results_update_elo" AFTER INSERT ON "public"."match_results" FOR EACH ROW EXECUTE FUNCTION "public"."update_elo_after_match"();



CREATE OR REPLACE TRIGGER "trg_match_results_validate_outcome" BEFORE INSERT OR UPDATE ON "public"."match_results" FOR EACH ROW EXECUTE FUNCTION "public"."match_results_validate_outcome"();



CREATE OR REPLACE TRIGGER "trg_season_group_weeks_updated_at" BEFORE UPDATE ON "public"."season_group_weeks" FOR EACH ROW EXECUTE FUNCTION "public"."season_group_weeks_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_dunning_member_id" BEFORE INSERT ON "public"."dunning_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_dunning_member_id"();



CREATE OR REPLACE TRIGGER "trg_trainer_absences_set_user_id" BEFORE INSERT OR UPDATE OF "trainer_id" ON "public"."trainer_absences" FOR EACH ROW EXECUTE FUNCTION "public"."set_trainer_absence_user_id"();



CREATE OR REPLACE TRIGGER "trial_trainings_updated_at" BEFORE UPDATE ON "public"."trial_trainings" FOR EACH ROW EXECUTE FUNCTION "public"."update_trial_trainings_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_dashboard_preferences_updated_at" BEFORE UPDATE ON "public"."user_dashboard_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_dashboard_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_open_matches_updated_at" BEFORE UPDATE ON "public"."open_matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_open_matches_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_push_subscriptions_updated_at" BEFORE UPDATE ON "public"."push_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_push_subscriptions_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_season_billing_configs_updated_at" BEFORE UPDATE ON "public"."season_billing_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_season_billing_configs_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_trainer_rating_summary" AFTER INSERT OR DELETE OR UPDATE ON "public"."trainer_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_trainer_rating_summary"();



CREATE OR REPLACE TRIGGER "update_attendance_records_updated_at" BEFORE UPDATE ON "public"."attendance_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_billing_periods_updated_at" BEFORE UPDATE ON "public"."billing_periods" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_booking_restrictions_updated_at" BEFORE UPDATE ON "public"."booking_restrictions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_conflicts_updated_at" BEFORE UPDATE ON "public"."planning_conflicts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hours_logs_updated_at" BEFORE UPDATE ON "public"."hours_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_invoice_status_after_payment" AFTER INSERT OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_invoice_status"();



CREATE OR REPLACE TRIGGER "update_member_booking_prefs_updated_at" BEFORE UPDATE ON "public"."member_booking_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_news_comments_updated_at" BEFORE UPDATE ON "public"."news_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_news_posts_updated_at" BEFORE UPDATE ON "public"."news_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_seasons_updated_at" BEFORE UPDATE ON "public"."seasons" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trainer_absences_updated_at" BEFORE UPDATE ON "public"."trainer_absences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trainer_assignments_updated_at" BEFORE UPDATE ON "public"."trainer_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trainer_availabilities_updated_at" BEFORE UPDATE ON "public"."trainer_availabilities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trainer_billings_updated_at" BEFORE UPDATE ON "public"."trainer_billings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_prefs_updated_at" BEFORE UPDATE ON "public"."user_training_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_dispute_resolved_by_fkey" FOREIGN KEY ("dispute_resolved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id");



ALTER TABLE ONLY "public"."background_jobs"
    ADD CONSTRAINT "background_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."billing_line_items"
    ADD CONSTRAINT "billing_line_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_line_items"
    ADD CONSTRAINT "billing_line_items_trainer_billing_id_fkey" FOREIGN KEY ("trainer_billing_id") REFERENCES "public"."trainer_billings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_periods"
    ADD CONSTRAINT "billing_periods_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_decisions"
    ADD CONSTRAINT "board_decisions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."board_decisions"
    ADD CONSTRAINT "board_decisions_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_decisions"
    ADD CONSTRAINT "board_decisions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."booking_restrictions"
    ADD CONSTRAINT "booking_restrictions_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_restrictions"
    ADD CONSTRAINT "booking_restrictions_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_restrictions"
    ADD CONSTRAINT "booking_restrictions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_rules"
    ADD CONSTRAINT "booking_rules_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id");



ALTER TABLE ONLY "public"."club_documents"
    ADD CONSTRAINT "club_documents_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_documents"
    ADD CONSTRAINT "club_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."court_availability"
    ADD CONSTRAINT "court_availability_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."court_closures"
    ADD CONSTRAINT "court_closures_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."court_closures"
    ADD CONSTRAINT "court_closures_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."court_closures"
    ADD CONSTRAINT "court_closures_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."court_closures"
    ADD CONSTRAINT "court_closures_match_day_id_fkey" FOREIGN KEY ("match_day_id") REFERENCES "public"."match_days"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."court_maintenance"
    ADD CONSTRAINT "court_maintenance_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."court_maintenance"
    ADD CONSTRAINT "court_maintenance_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."court_maintenance"
    ADD CONSTRAINT "court_maintenance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."court_types"
    ADD CONSTRAINT "court_types_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courts"
    ADD CONSTRAINT "courts_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courts"
    ADD CONSTRAINT "courts_court_type_id_fkey" FOREIGN KEY ("court_type_id") REFERENCES "public"."court_types"("id");



ALTER TABLE ONLY "public"."decision_changes"
    ADD CONSTRAINT "decision_changes_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."decision_changes"
    ADD CONSTRAINT "decision_changes_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "public"."board_decisions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."decision_votes"
    ADD CONSTRAINT "decision_votes_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "public"."board_decisions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."decision_votes"
    ADD CONSTRAINT "decision_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."dunning_records"
    ADD CONSTRAINT "dunning_records_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dunning_records"
    ADD CONSTRAINT "dunning_records_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dunning_records"
    ADD CONSTRAINT "dunning_records_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_campaigns"
    ADD CONSTRAINT "email_campaigns_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_campaigns"
    ADD CONSTRAINT "email_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_accounts"
    ADD CONSTRAINT "family_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_invites"
    ADD CONSTRAINT "family_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."family_invites"
    ADD CONSTRAINT "family_invites_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."fee_configurations"
    ADD CONSTRAINT "fee_configurations_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gamification_badges"
    ADD CONSTRAINT "gamification_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gamification_points"
    ADD CONSTRAINT "gamification_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hourly_rate_tiers"
    ADD CONSTRAINT "hourly_rate_tiers_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hours_logs"
    ADD CONSTRAINT "hours_logs_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id");



ALTER TABLE ONLY "public"."hours_logs"
    ADD CONSTRAINT "hours_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hours_logs"
    ADD CONSTRAINT "hours_logs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoice_installments"
    ADD CONSTRAINT "invoice_installments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_installments"
    ADD CONSTRAINT "invoice_installments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."job_execution_log"
    ADD CONSTRAINT "job_execution_log_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."background_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_players"
    ADD CONSTRAINT "league_players_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_players"
    ADD CONSTRAINT "league_players_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_players"
    ADD CONSTRAINT "league_players_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_caterings"
    ADD CONSTRAINT "match_caterings_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_caterings"
    ADD CONSTRAINT "match_caterings_match_day_id_fkey" FOREIGN KEY ("match_day_id") REFERENCES "public"."match_days"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_days"
    ADD CONSTRAINT "match_days_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_match_day_id_fkey" FOREIGN KEY ("match_day_id") REFERENCES "public"."match_days"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matchday_reminder_logs"
    ADD CONSTRAINT "matchday_reminder_logs_matchday_id_fkey" FOREIGN KEY ("matchday_id") REFERENCES "public"."match_days"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matchday_reminder_logs"
    ADD CONSTRAINT "matchday_reminder_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_invitations"
    ADD CONSTRAINT "meeting_invitations_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "public"."board_decisions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_invitations"
    ADD CONSTRAINT "meeting_invitations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_balance_entries"
    ADD CONSTRAINT "member_balance_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_balance_entries"
    ADD CONSTRAINT "member_balance_entries_member_balance_id_fkey" FOREIGN KEY ("member_balance_id") REFERENCES "public"."member_balances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_balances"
    ADD CONSTRAINT "member_balances_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_balances"
    ADD CONSTRAINT "member_balances_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_booking_preferences"
    ADD CONSTRAINT "member_booking_preferences_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_booking_preferences"
    ADD CONSTRAINT "member_booking_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_meetings"
    ADD CONSTRAINT "member_meetings_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_meetings"
    ADD CONSTRAINT "member_meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."member_schedule_preferences"
    ADD CONSTRAINT "member_schedule_preferences_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_schedule_preferences"
    ADD CONSTRAINT "member_schedule_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_replied_to_id_fkey" FOREIGN KEY ("replied_to_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."news_comments"
    ADD CONSTRAINT "news_comments_news_post_id_fkey" FOREIGN KEY ("news_post_id") REFERENCES "public"."news_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."news_comments"
    ADD CONSTRAINT "news_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."news_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."news_comments"
    ADD CONSTRAINT "news_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."news_posts"
    ADD CONSTRAINT "news_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."news_posts"
    ADD CONSTRAINT "news_posts_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."newsletter_campaigns"
    ADD CONSTRAINT "newsletter_campaigns_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."newsletter_campaigns"
    ADD CONSTRAINT "newsletter_campaigns_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."newsletter_send_logs"
    ADD CONSTRAINT "newsletter_send_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."newsletter_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_consents"
    ADD CONSTRAINT "notification_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nuliga_sync_log"
    ADD CONSTRAINT "nuliga_sync_log_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nuliga_sync_log"
    ADD CONSTRAINT "nuliga_sync_log_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."open_match_participants"
    ADD CONSTRAINT "open_match_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."open_matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."open_match_participants"
    ADD CONSTRAINT "open_match_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."open_matches"
    ADD CONSTRAINT "open_matches_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."open_matches"
    ADD CONSTRAINT "open_matches_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."open_matches"
    ADD CONSTRAINT "open_matches_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_settings"
    ADD CONSTRAINT "payment_settings_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_conflicts"
    ADD CONSTRAINT "planning_conflicts_affected_court_id_fkey" FOREIGN KEY ("affected_court_id") REFERENCES "public"."courts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_conflicts"
    ADD CONSTRAINT "planning_conflicts_affected_trainer_id_fkey" FOREIGN KEY ("affected_trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_conflicts"
    ADD CONSTRAINT "planning_conflicts_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_conflicts"
    ADD CONSTRAINT "planning_conflicts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_conflicts"
    ADD CONSTRAINT "planning_conflicts_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qr_checkins"
    ADD CONSTRAINT "qr_checkins_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."qr_checkins"
    ADD CONSTRAINT "qr_checkins_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qr_checkins"
    ADD CONSTRAINT "qr_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."rate_history"
    ADD CONSTRAINT "rate_history_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_history"
    ADD CONSTRAINT "rate_history_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_requests"
    ADD CONSTRAINT "registration_requests_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_requests"
    ADD CONSTRAINT "registration_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_billing_configs"
    ADD CONSTRAINT "season_billing_configs_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_billing_configs"
    ADD CONSTRAINT "season_billing_configs_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_group_weeks"
    ADD CONSTRAINT "season_group_weeks_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_group_weeks"
    ADD CONSTRAINT "season_group_weeks_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_group_weeks"
    ADD CONSTRAINT "season_group_weeks_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_plan_entries"
    ADD CONSTRAINT "season_plan_entries_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_plan_entries"
    ADD CONSTRAINT "season_plan_entries_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."season_plan_entries"
    ADD CONSTRAINT "season_plan_entries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_plan_entries"
    ADD CONSTRAINT "season_plan_entries_published_session_id_fkey" FOREIGN KEY ("published_session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."season_plan_entries"
    ADD CONSTRAINT "season_plan_entries_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_plan_entries"
    ADD CONSTRAINT "season_plan_entries_substitute_trainer_id_fkey" FOREIGN KEY ("substitute_trainer_id") REFERENCES "public"."trainers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."season_plan_entries"
    ADD CONSTRAINT "season_plan_entries_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."season_plan_versions"
    ADD CONSTRAINT "season_plan_versions_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_plan_versions"
    ADD CONSTRAINT "season_plan_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."season_plan_versions"
    ADD CONSTRAINT "season_plan_versions_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_planning_configs"
    ADD CONSTRAINT "season_planning_configs_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_planning_configs"
    ADD CONSTRAINT "season_planning_configs_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_planning_history"
    ADD CONSTRAINT "season_planning_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."season_planning_history"
    ADD CONSTRAINT "season_planning_history_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_planning_history"
    ADD CONSTRAINT "season_planning_history_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_statistics"
    ADD CONSTRAINT "season_statistics_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_statistics"
    ADD CONSTRAINT "season_statistics_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_waitlists"
    ADD CONSTRAINT "season_waitlists_alternative_group_id_fkey" FOREIGN KEY ("alternative_group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."season_waitlists"
    ADD CONSTRAINT "season_waitlists_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_waitlists"
    ADD CONSTRAINT "season_waitlists_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_waitlists"
    ADD CONSTRAINT "season_waitlists_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_waitlists"
    ADD CONSTRAINT "season_waitlists_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."sepa_mandates"
    ADD CONSTRAINT "sepa_mandates_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_rsvps"
    ADD CONSTRAINT "session_rsvps_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_rsvps"
    ADD CONSTRAINT "session_rsvps_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_rsvps"
    ADD CONSTRAINT "session_rsvps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_waitlist"
    ADD CONSTRAINT "session_waitlist_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_plan_entry_id_fkey" FOREIGN KEY ("plan_entry_id") REFERENCES "public"."season_plan_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id");



ALTER TABLE ONLY "public"."shop_orders"
    ADD CONSTRAINT "shop_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."shop_products"
    ADD CONSTRAINT "shop_products_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."special_event_registrations"
    ADD CONSTRAINT "special_event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."special_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."special_event_registrations"
    ADD CONSTRAINT "special_event_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."special_events"
    ADD CONSTRAINT "special_events_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."special_events"
    ADD CONSTRAINT "special_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."special_events"
    ADD CONSTRAINT "special_events_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tournament_registrations"
    ADD CONSTRAINT "tournament_registrations_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tournament_registrations"
    ADD CONSTRAINT "tournament_registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_registrations"
    ADD CONSTRAINT "tournament_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."trainer_absences"
    ADD CONSTRAINT "trainer_absences_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."trainer_absences"
    ADD CONSTRAINT "trainer_absences_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_absences"
    ADD CONSTRAINT "trainer_absences_substitute_trainer_id_fkey" FOREIGN KEY ("substitute_trainer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trainer_absences"
    ADD CONSTRAINT "trainer_absences_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_absences"
    ADD CONSTRAINT "trainer_absences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_assignments"
    ADD CONSTRAINT "trainer_assignments_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_assignments"
    ADD CONSTRAINT "trainer_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_availabilities"
    ADD CONSTRAINT "trainer_availabilities_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_billings"
    ADD CONSTRAINT "trainer_billings_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_billings"
    ADD CONSTRAINT "trainer_billings_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."trainer_club"
    ADD CONSTRAINT "trainer_club_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_club"
    ADD CONSTRAINT "trainer_club_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_feedback"
    ADD CONSTRAINT "trainer_feedback_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_feedback"
    ADD CONSTRAINT "trainer_feedback_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trainer_feedback"
    ADD CONSTRAINT "trainer_feedback_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_feedback"
    ADD CONSTRAINT "trainer_feedback_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."trainer_feedback"
    ADD CONSTRAINT "trainer_feedback_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_feedback"
    ADD CONSTRAINT "trainer_feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trainer_feedback"
    ADD CONSTRAINT "trainer_feedback_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_hourly_rates"
    ADD CONSTRAINT "trainer_hourly_rates_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_hourly_rates"
    ADD CONSTRAINT "trainer_hourly_rates_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_member_notes"
    ADD CONSTRAINT "trainer_member_notes_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_member_notes"
    ADD CONSTRAINT "trainer_member_notes_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_profiles"
    ADD CONSTRAINT "trainer_profiles_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_profiles"
    ADD CONSTRAINT "trainer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_rating_summary"
    ADD CONSTRAINT "trainer_rating_summary_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_rating_summary"
    ADD CONSTRAINT "trainer_rating_summary_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_slot_waitlist"
    ADD CONSTRAINT "trainer_slot_waitlist_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "public"."trainer_availabilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_slot_waitlist"
    ADD CONSTRAINT "trainer_slot_waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainers"
    ADD CONSTRAINT "trainers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."training_group_memberships"
    ADD CONSTRAINT "training_group_memberships_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_group_memberships"
    ADD CONSTRAINT "training_group_memberships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."training_group_memberships"
    ADD CONSTRAINT "training_group_memberships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_group_memberships"
    ADD CONSTRAINT "training_group_memberships_training_group_id_fkey" FOREIGN KEY ("training_group_id") REFERENCES "public"."training_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_groups"
    ADD CONSTRAINT "training_groups_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_groups"
    ADD CONSTRAINT "training_groups_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trial_trainings"
    ADD CONSTRAINT "trial_trainings_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trial_trainings"
    ADD CONSTRAINT "trial_trainings_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."trial_trainings"
    ADD CONSTRAINT "trial_trainings_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_club_memberships"
    ADD CONSTRAINT "user_club_memberships_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_club_memberships"
    ADD CONSTRAINT "user_club_memberships_deactivated_by_fkey" FOREIGN KEY ("deactivated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_club_memberships"
    ADD CONSTRAINT "user_club_memberships_fee_configuration_id_fkey" FOREIGN KEY ("fee_configuration_id") REFERENCES "public"."fee_configurations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_club_memberships"
    ADD CONSTRAINT "user_club_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_dashboard_preferences"
    ADD CONSTRAINT "user_dashboard_preferences_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_training_preferences"
    ADD CONSTRAINT "user_training_preferences_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_training_preferences"
    ADD CONSTRAINT "user_training_preferences_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_training_preferences"
    ADD CONSTRAINT "user_training_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_duties"
    ADD CONSTRAINT "work_duties_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_duty_assignments"
    ADD CONSTRAINT "work_duty_assignments_duty_id_fkey" FOREIGN KEY ("duty_id") REFERENCES "public"."work_duties"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can update registration" ON "public"."registration_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admin can view registration requests" ON "public"."registration_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can create coupons" ON "public"."coupons" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can create email campaigns" ON "public"."email_campaigns" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can delete check-ins" ON "public"."qr_checkins" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can delete coupons" ON "public"."coupons" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can delete email campaigns" ON "public"."email_campaigns" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can delete planning history" ON "public"."season_planning_history" FOR DELETE USING (("club_id" IN ( SELECT "user_club_memberships"."club_id"
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Admins can delete preferences in club" ON "public"."user_training_preferences" FOR DELETE USING (("club_id" IN ( SELECT "user_club_memberships"."club_id"
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Admins can delete shop products" ON "public"."shop_products" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can insert badges" ON "public"."gamification_badges" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can insert gamification points" ON "public"."gamification_points" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can insert into email queue" ON "public"."email_queue" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can insert planning history" ON "public"."season_planning_history" FOR INSERT WITH CHECK (("club_id" IN ( SELECT "user_club_memberships"."club_id"
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Admins can insert shop products" ON "public"."shop_products" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can manage all RSVPs in their club" ON "public"."session_rsvps" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "session_rsvps"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can manage check-ins" ON "public"."qr_checkins" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can manage conflicts of their club" ON "public"."planning_conflicts" USING (("club_id" IN ( SELECT "user_club_memberships"."club_id"
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Admins can manage family accounts" ON "public"."family_accounts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can manage plan entries of their club" ON "public"."season_plan_entries" USING (("club_id" IN ( SELECT "user_club_memberships"."club_id"
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Admins can manage season_waitlists" ON "public"."season_waitlists" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."club_id" = "season_waitlists"."club_id") AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Admins can moderate feedback" ON "public"."trainer_feedback" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "trainer_feedback"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('super_admin'::character varying)::"text"]))))));



CREATE POLICY "Admins can update all schedule preferences" ON "public"."member_schedule_preferences" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."club_id" = "member_schedule_preferences"."club_id") AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Admins can update coupons" ON "public"."coupons" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can update email campaigns" ON "public"."email_campaigns" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can update email queue" ON "public"."email_queue" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can update family accounts" ON "public"."family_accounts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can update gamification points" ON "public"."gamification_points" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can update invites" ON "public"."family_invites" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can update orders" ON "public"."shop_orders" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can update shop products" ON "public"."shop_products" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can view all preferences in club" ON "public"."user_training_preferences" FOR SELECT USING (("club_id" IN ( SELECT "user_club_memberships"."club_id"
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Admins can view all schedule preferences" ON "public"."member_schedule_preferences" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."club_id" = "member_schedule_preferences"."club_id") AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Admins can view email campaigns" ON "public"."email_campaigns" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Admins can view email queue" ON "public"."email_queue" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Anyone can insert registration" ON "public"."registration_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can validate coupons" ON "public"."coupons" FOR SELECT USING ((("is_active" = true) OR (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])))))));



CREATE POLICY "Club admins can create absences in their clubs" ON "public"."trainer_absences" FOR INSERT WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can create fee configurations in their clubs" ON "public"."fee_configurations" FOR INSERT WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can create payment settings in their clubs" ON "public"."payment_settings" FOR INSERT WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can create settings in their clubs" ON "public"."system_settings" FOR INSERT WITH CHECK ((("club_id" IS NOT NULL) AND "public"."is_club_admin"("club_id")));



CREATE POLICY "Club admins can create trial trainings in their clubs" ON "public"."trial_trainings" FOR INSERT WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can delete absences in their clubs" ON "public"."trainer_absences" FOR DELETE USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can delete fee configurations in their clubs" ON "public"."fee_configurations" FOR DELETE USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can delete non-required settings in their clubs" ON "public"."system_settings" FOR DELETE USING ((("club_id" IS NOT NULL) AND ("is_required" = false) AND "public"."is_club_admin"("club_id")));



CREATE POLICY "Club admins can delete payment settings in their clubs" ON "public"."payment_settings" FOR DELETE USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can delete trial trainings in their clubs" ON "public"."trial_trainings" FOR DELETE USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can manage billing configs" ON "public"."season_billing_configs" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."club_id" = "season_billing_configs"."club_id") AND ("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Club admins can update absences in their clubs" ON "public"."trainer_absences" FOR UPDATE USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can update fee configurations in their clubs" ON "public"."fee_configurations" FOR UPDATE USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can update payment settings in their clubs" ON "public"."payment_settings" FOR UPDATE USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can update settings in their clubs" ON "public"."system_settings" FOR UPDATE USING ((("club_id" IS NOT NULL) AND "public"."is_club_admin"("club_id")));



CREATE POLICY "Club admins can update trial trainings in their clubs" ON "public"."trial_trainings" FOR UPDATE USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can view absences in their clubs" ON "public"."trainer_absences" FOR SELECT USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can view fee configurations in their clubs" ON "public"."fee_configurations" FOR SELECT USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can view payment settings in their clubs" ON "public"."payment_settings" FOR SELECT USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can view settings in their clubs" ON "public"."system_settings" FOR SELECT USING ((("club_id" IS NOT NULL) AND "public"."is_club_admin"("club_id")));



CREATE POLICY "Club admins can view trial trainings in their clubs" ON "public"."trial_trainings" FOR SELECT USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club members can view rating summaries" ON "public"."trainer_rating_summary" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "trainer_rating_summary"."club_id")))));



CREATE POLICY "Club members can view sessions" ON "public"."sessions" FOR SELECT USING (("schedule_id" IN ( SELECT "schedules"."id"
   FROM "public"."schedules"
  WHERE ("schedules"."club_id" IN ( SELECT "user_club_memberships"."club_id"
           FROM "public"."user_club_memberships"
          WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."is_active" = true)))))));



CREATE POLICY "Everyone can view active shop products" ON "public"."shop_products" FOR SELECT USING ((("is_active" = true) OR (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])))))));



CREATE POLICY "Everyone can view badges" ON "public"."gamification_badges" FOR SELECT USING (true);



CREATE POLICY "Members can RSVP to their own sessions" ON "public"."session_rsvps" FOR INSERT TO "authenticated" WITH CHECK (("member_id" = "auth"."uid"()));



CREATE POLICY "Members can create bookings" ON "public"."bookings" FOR INSERT WITH CHECK ((("member_id" = "auth"."uid"()) AND ("club_id" IN ( SELECT "user_club_memberships"."club_id"
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."is_active" = true))))));



CREATE POLICY "Members can create own feedback" ON "public"."trainer_feedback" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "trainer_feedback"."club_id") AND (("ucm"."role")::"text" = 'member'::"text")))) AND ("member_id" = "auth"."uid"())));



CREATE POLICY "Members can update own recent feedback" ON "public"."trainer_feedback" FOR UPDATE USING ((("member_id" = "auth"."uid"()) AND ("created_at" > ("now"() - '24:00:00'::interval))));



CREATE POLICY "Members can update their bookings" ON "public"."bookings" FOR UPDATE USING ((("member_id" = "auth"."uid"()) AND (("status")::"text" = 'pending'::"text")));



CREATE POLICY "Members can update their own RSVPs" ON "public"."session_rsvps" FOR UPDATE TO "authenticated" USING (("member_id" = "auth"."uid"()));



CREATE POLICY "Members can view active fee configurations" ON "public"."fee_configurations" FOR SELECT USING ((("is_active" = true) AND (("valid_from" IS NULL) OR ("valid_from" <= CURRENT_DATE)) AND (("valid_until" IS NULL) OR ("valid_until" >= CURRENT_DATE)) AND "public"."is_club_member"("club_id")));



CREATE POLICY "Members can view club members" ON "public"."users" FOR SELECT USING ((("id" = "auth"."uid"()) OR "public"."shares_active_club_with"("id")));



CREATE POLICY "Members can view own waitlist entries" ON "public"."season_waitlists" FOR SELECT USING (("member_id" = "auth"."uid"()));



CREATE POLICY "Members can view their own RSVPs" ON "public"."session_rsvps" FOR SELECT TO "authenticated" USING (("member_id" = "auth"."uid"()));



CREATE POLICY "Members can view visible feedback" ON "public"."trainer_feedback" FOR SELECT USING ((("is_visible" = true) AND (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "trainer_feedback"."club_id"))))));



CREATE POLICY "Service role can manage stripe_events" ON "public"."stripe_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Trainers can insert attendance" ON "public"."attendance_records" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('trainer'::character varying)::"text", ('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "Trainers can update their assigned trial trainings" ON "public"."trial_trainings" FOR UPDATE USING (("public"."is_club_trainer"("club_id") AND ("trainer_id" IN ( SELECT "t"."id"
   FROM ("public"."trainers" "t"
     JOIN "public"."users" "u" ON ((("u"."email")::"text" = ("t"."email")::"text")))
  WHERE ("u"."id" = "auth"."uid"())))));



CREATE POLICY "Trainers can view fee configurations in their clubs" ON "public"."fee_configurations" FOR SELECT USING ("public"."is_club_trainer"("club_id"));



CREATE POLICY "Trainers can view own feedback" ON "public"."trainer_feedback" FOR SELECT USING ((("trainer_id" = "auth"."uid"()) AND ("is_visible" = true)));



CREATE POLICY "Trainers can view their assigned trial trainings" ON "public"."trial_trainings" FOR SELECT USING (("public"."is_club_trainer"("club_id") AND ("trainer_id" IN ( SELECT "t"."id"
   FROM ("public"."trainers" "t"
     JOIN "public"."users" "u" ON ((("u"."email")::"text" = ("t"."email")::"text")))
  WHERE ("u"."id" = "auth"."uid"())))));



CREATE POLICY "Users can check in" ON "public"."qr_checkins" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create invites" ON "public"."family_invites" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can create orders" ON "public"."shop_orders" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own dashboard preferences" ON "public"."user_dashboard_preferences" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own preferences" ON "public"."user_training_preferences" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own dashboard preferences" ON "public"."user_dashboard_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own preferences while open" ON "public"."user_training_preferences" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."seasons"
  WHERE (("seasons"."id" = "user_training_preferences"."season_id") AND ("seasons"."preferences_open" = true))))));



CREATE POLICY "Users can update own dashboard preferences" ON "public"."user_dashboard_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own preferences while open" ON "public"."user_training_preferences" FOR UPDATE USING ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."seasons"
  WHERE (("seasons"."id" = "user_training_preferences"."season_id") AND ("seasons"."preferences_open" = true))))));



CREATE POLICY "Users can view conflicts of their club" ON "public"."planning_conflicts" FOR SELECT USING (("club_id" IN ( SELECT "user_club_memberships"."club_id"
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Users can view own check-ins" ON "public"."qr_checkins" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('trainer'::character varying)::"text", ('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])))))));



CREATE POLICY "Users can view own dashboard preferences" ON "public"."user_dashboard_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own family group" ON "public"."family_accounts" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))) OR ("family_group_id" IN ( SELECT "fa"."family_group_id"
   FROM "public"."family_accounts" "fa"
  WHERE ("fa"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own invites" ON "public"."family_invites" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])))))));



CREATE POLICY "Users can view own orders" ON "public"."shop_orders" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])))))));



CREATE POLICY "Users can view own preferences" ON "public"."user_training_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view planning history of their club" ON "public"."season_planning_history" FOR SELECT USING (("club_id" IN ( SELECT "user_club_memberships"."club_id"
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Users can view public settings" ON "public"."system_settings" FOR SELECT USING ((("is_public" = true) AND (("club_id" IS NULL) OR "public"."is_club_member"("club_id"))));



CREATE POLICY "Users can view seasons of their club" ON "public"."seasons" FOR SELECT USING (("club_id" IN ( SELECT "user_club_memberships"."club_id"
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "Users can view their own bookings" ON "public"."bookings" FOR SELECT USING ((("member_id" = "auth"."uid"()) OR ("club_id" IN ( SELECT "user_club_memberships"."club_id"
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."is_active" = true))))));



CREATE POLICY "admin manage match_caterings" ON "public"."match_caterings" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."club_id" = "match_caterings"."club_id") AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text", ('owner'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "admin manage newsletter_campaigns" ON "public"."newsletter_campaigns" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."club_id" = "newsletter_campaigns"."club_id") AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text", ('owner'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "admin read newsletter_send_logs" ON "public"."newsletter_send_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."newsletter_campaigns" "nc"
     JOIN "public"."user_club_memberships" "m" ON (("m"."club_id" = "nc"."club_id")))
  WHERE (("nc"."id" = "newsletter_send_logs"."campaign_id") AND ("m"."user_id" = "auth"."uid"()) AND (("m"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text", ('owner'::character varying)::"text"])) AND ("m"."is_active" = true)))));



CREATE POLICY "admin_see_registrations" ON "public"."special_event_registrations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."special_events" "se"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "se"."club_id")))
  WHERE (("se"."id" = "special_event_registrations"."event_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text", ('owner'::character varying)::"text"]))))));



CREATE POLICY "admins can manage documents" ON "public"."club_documents" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."club_id" = "club_documents"."club_id") AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text", ('owner'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "admins can manage maintenance" ON "public"."court_maintenance" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."club_id" = "court_maintenance"."club_id") AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text", ('owner'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "admins can manage meetings" ON "public"."member_meetings" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."club_id" = "member_meetings"."club_id") AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text", ('owner'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "admins_can_manage_dunning" ON "public"."dunning_records" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "dunning_records"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "admins_can_manage_news" ON "public"."news_posts" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "news_posts"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "admins_can_manage_restrictions" ON "public"."booking_restrictions" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "booking_restrictions"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "admins_can_manage_trainer_absences" ON "public"."trainer_absences" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "trainer_absences"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "admins_can_manage_trainer_assignments" ON "public"."trainer_assignments" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "trainer_assignments"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "admins_manage_booking_rules" ON "public"."booking_rules" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "admins_manage_court_availability" ON "public"."court_availability" USING ("public"."is_club_admin"(( SELECT "courts"."club_id"
   FROM "public"."courts"
  WHERE ("courts"."id" = "court_availability"."court_id"))));



CREATE POLICY "admins_manage_court_types" ON "public"."court_types" USING ((("club_id" IS NULL) OR "public"."is_club_admin"("club_id")));



CREATE POLICY "admins_manage_groups" ON "public"."groups" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "admins_manage_invoice_items" ON "public"."invoice_items" USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_items"."invoice_id") AND "public"."is_club_admin"("i"."club_id")))));



CREATE POLICY "admins_manage_news" ON "public"."news_posts" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "admins_manage_payments" ON "public"."payments" USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "payments"."invoice_id") AND "public"."is_club_admin"("i"."club_id")))));



CREATE POLICY "admins_manage_pricing" ON "public"."pricing_rules" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "admins_see_dunning" ON "public"."dunning_records" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "dunning_records"."invoice_id") AND "public"."is_club_admin"("i"."club_id")))));



CREATE POLICY "all_see_court_availability" ON "public"."court_availability" FOR SELECT USING (true);



ALTER TABLE "public"."attendance_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance_records_delete" ON "public"."attendance_records" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."trainers"
  WHERE (("trainers"."id" = "attendance_records"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."sessions" "s"
     JOIN "public"."schedules" "sc" ON (("sc"."id" = "s"."schedule_id")))
  WHERE (("s"."id" = "attendance_records"."session_id") AND "public"."is_superadmin_of"("sc"."club_id"))))));



CREATE POLICY "attendance_records_insert" ON "public"."attendance_records" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."trainers"
  WHERE (("trainers"."id" = "attendance_records"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."sessions" "s"
     JOIN "public"."schedules" "sc" ON (("sc"."id" = "s"."schedule_id")))
  WHERE (("s"."id" = "attendance_records"."session_id") AND "public"."is_superadmin_of"("sc"."club_id"))))));



CREATE POLICY "attendance_records_member_select" ON "public"."attendance_records" FOR SELECT USING ((("trainer_id" = "auth"."uid"()) OR ("participant_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."sessions" "s"
     JOIN "public"."schedules" "sc" ON (("sc"."id" = "s"."schedule_id")))
  WHERE (("s"."id" = "attendance_records"."session_id") AND "public"."is_superadmin_of"("sc"."club_id"))))));



CREATE POLICY "attendance_records_member_update" ON "public"."attendance_records" FOR UPDATE USING ((("trainer_id" = "auth"."uid"()) OR (("participant_id" = "auth"."uid"()) AND (("member_status")::"text" = 'pending'::"text")) OR (EXISTS ( SELECT 1
   FROM ("public"."sessions" "s"
     JOIN "public"."schedules" "sc" ON (("sc"."id" = "s"."schedule_id")))
  WHERE (("s"."id" = "attendance_records"."session_id") AND "public"."is_superadmin_of"("sc"."club_id"))))));



CREATE POLICY "attendance_records_select" ON "public"."attendance_records" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."trainers"
  WHERE (("trainers"."id" = "attendance_records"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."sessions" "s"
     JOIN "public"."schedules" "sc" ON (("sc"."id" = "s"."schedule_id")))
  WHERE (("s"."id" = "attendance_records"."session_id") AND "public"."is_superadmin_of"("sc"."club_id"))))));



CREATE POLICY "attendance_records_update" ON "public"."attendance_records" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."trainers"
  WHERE (("trainers"."id" = "attendance_records"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."sessions" "s"
     JOIN "public"."schedules" "sc" ON (("sc"."id" = "s"."schedule_id")))
  WHERE (("s"."id" = "attendance_records"."session_id") AND "public"."is_superadmin_of"("sc"."club_id"))))));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_admin_select" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_club_admin"("club_id"));



ALTER TABLE "public"."background_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "background_jobs_admin_select" ON "public"."background_jobs" FOR SELECT USING (("public"."is_superadmin"() OR ((("payload" ->> 'club_id'::"text"))::"uuid" = ANY ("public"."get_user_club_ids"()))));



CREATE POLICY "background_jobs_service_role" ON "public"."background_jobs" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "background_jobs_superadmin_all" ON "public"."background_jobs" USING ("public"."is_superadmin"());



ALTER TABLE "public"."base_interest_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "base_interest_rates_owner_all" ON "public"."base_interest_rates" USING ("public"."is_superadmin"());



ALTER TABLE "public"."billing_line_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_line_items_delete" ON "public"."billing_line_items" FOR DELETE TO "authenticated" USING ("public"."is_superadmin_of"(( SELECT "bp"."club_id"
   FROM ("public"."trainer_billings" "tb"
     JOIN "public"."billing_periods" "bp" ON (("bp"."id" = "tb"."billing_period_id")))
  WHERE ("tb"."id" = "billing_line_items"."trainer_billing_id"))));



CREATE POLICY "billing_line_items_insert" ON "public"."billing_line_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_superadmin_of"(( SELECT "bp"."club_id"
   FROM ("public"."trainer_billings" "tb"
     JOIN "public"."billing_periods" "bp" ON (("bp"."id" = "tb"."billing_period_id")))
  WHERE ("tb"."id" = "billing_line_items"."trainer_billing_id"))));



CREATE POLICY "billing_line_items_select" ON "public"."billing_line_items" FOR SELECT TO "authenticated" USING (("public"."is_superadmin_of"(( SELECT "bp"."club_id"
   FROM ("public"."trainer_billings" "tb"
     JOIN "public"."billing_periods" "bp" ON (("bp"."id" = "tb"."billing_period_id")))
  WHERE ("tb"."id" = "billing_line_items"."trainer_billing_id"))) OR (EXISTS ( SELECT 1
   FROM ("public"."trainer_billings" "tb"
     JOIN "public"."trainers" "t" ON (("t"."id" = "tb"."trainer_id")))
  WHERE (("tb"."id" = "billing_line_items"."trainer_billing_id") AND ("t"."user_id" = "auth"."uid"()))))));



CREATE POLICY "billing_line_items_update" ON "public"."billing_line_items" FOR UPDATE TO "authenticated" USING ("public"."is_superadmin_of"(( SELECT "bp"."club_id"
   FROM ("public"."trainer_billings" "tb"
     JOIN "public"."billing_periods" "bp" ON (("bp"."id" = "tb"."billing_period_id")))
  WHERE ("tb"."id" = "billing_line_items"."trainer_billing_id"))));



ALTER TABLE "public"."billing_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_periods_delete" ON "public"."billing_periods" FOR DELETE TO "authenticated" USING ("public"."is_superadmin_of"("club_id"));



CREATE POLICY "billing_periods_insert" ON "public"."billing_periods" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_superadmin_of"("club_id"));



CREATE POLICY "billing_periods_select" ON "public"."billing_periods" FOR SELECT TO "authenticated" USING ("public"."is_superadmin_of"("club_id"));



CREATE POLICY "billing_periods_update" ON "public"."billing_periods" FOR UPDATE TO "authenticated" USING ("public"."is_superadmin_of"("club_id"));



ALTER TABLE "public"."board_decisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "board_decisions_admin_manage" ON "public"."board_decisions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."club_id" = "board_decisions"."club_id") AND ("m"."is_active" = true) AND (("m"."role")::"text" = ANY (ARRAY[('owner'::character varying)::"text", ('superadmin'::character varying)::"text", ('admin'::character varying)::"text"]))))));



CREATE POLICY "board_decisions_member_read_completed" ON "public"."board_decisions" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."club_id" = "board_decisions"."club_id") AND ("m"."is_active" = true)))) AND ("status" = 'completed'::"public"."decision_status") AND ("decision_type" = 'mitgliederversammlung'::"public"."decision_type")));



CREATE POLICY "booking_access" ON "public"."bookings" USING ((("member_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."club_id" = "bookings"."club_id") AND ("user_club_memberships"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."booking_restrictions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_delete" ON "public"."bookings" FOR DELETE USING (("public"."is_owner"() OR "public"."is_club_admin"("club_id")));



CREATE POLICY "bookings_insert" ON "public"."bookings" FOR INSERT WITH CHECK (("public"."is_owner"() OR "public"."is_club_trainer"("club_id") OR (("member_id" = "auth"."uid"()) AND "public"."is_club_member"("club_id"))));



CREATE POLICY "bookings_select" ON "public"."bookings" FOR SELECT USING (("public"."is_owner"() OR ("member_id" = "auth"."uid"()) OR "public"."is_club_trainer"("club_id")));



CREATE POLICY "bookings_update" ON "public"."bookings" FOR UPDATE USING (("public"."is_owner"() OR ("member_id" = "auth"."uid"()) OR "public"."is_club_trainer"("club_id")));



CREATE POLICY "club members can read documents" ON "public"."club_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."club_id" = "club_documents"."club_id") AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "club members can read maintenance" ON "public"."court_maintenance" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."club_id" = "court_maintenance"."club_id") AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "club members can read meetings" ON "public"."member_meetings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."club_id" = "member_meetings"."club_id") AND ("user_club_memberships"."is_active" = true)))));



ALTER TABLE "public"."club_access_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_access_requests_owner_read" ON "public"."club_access_requests" FOR SELECT TO "authenticated" USING (("public"."is_owner"() OR "public"."is_superadmin"()));



ALTER TABLE "public"."club_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_members_can_view_restrictions" ON "public"."booking_restrictions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "booking_restrictions"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true)))));



CREATE POLICY "club_members_read_events" ON "public"."special_events" FOR SELECT USING ((("status" <> 'draft'::"public"."special_event_status") AND (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."club_id" = "special_events"."club_id") AND ("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."is_active" = true))))));



CREATE POLICY "club_members_see_booking_rules" ON "public"."booking_rules" FOR SELECT USING ("public"."is_club_member"("club_id"));



CREATE POLICY "club_members_see_court_types" ON "public"."court_types" FOR SELECT USING ((("club_id" IS NULL) OR "public"."is_club_member"("club_id")));



CREATE POLICY "club_members_see_groups" ON "public"."groups" FOR SELECT USING ("public"."is_club_member"("club_id"));



CREATE POLICY "club_members_see_pricing" ON "public"."pricing_rules" FOR SELECT USING ("public"."is_club_member"("club_id"));



CREATE POLICY "club_members_see_published_news" ON "public"."news_posts" FOR SELECT USING (((("is_published" = true) AND "public"."is_club_member"("club_id")) OR "public"."is_club_admin"("club_id")));



CREATE POLICY "club_staff_manage_events" ON "public"."special_events" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."club_id" = "special_events"."club_id") AND ("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text", ('owner'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "club_staff_manage_plan_versions" ON "public"."season_plan_versions" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."club_id" = "season_plan_versions"."club_id") AND ("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'owner'::character varying])::"text"[])) AND ("user_club_memberships"."is_active" = true)))));



ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clubs_access" ON "public"."clubs" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."club_id" = "clubs"."id") AND ("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "clubs_delete" ON "public"."clubs" FOR DELETE USING ("public"."is_superadmin_of"("id"));



CREATE POLICY "clubs_insert" ON "public"."clubs" FOR INSERT WITH CHECK (("public"."is_superadmin"() OR "public"."is_owner"()));



CREATE POLICY "clubs_owner_select" ON "public"."clubs" FOR SELECT USING (("public"."is_owner"() OR ("public"."is_club_member"("id") AND (("status")::"text" <> 'deleted'::"text")) OR ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."club_id" = "clubs"."id") AND ("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."is_active" = true)))) AND (("status")::"text" <> 'deleted'::"text"))));



CREATE POLICY "clubs_select" ON "public"."clubs" FOR SELECT USING (("id" = ANY ("public"."get_user_club_ids"())));



CREATE POLICY "clubs_update" ON "public"."clubs" FOR UPDATE TO "authenticated" USING (("public"."is_club_admin"("id") OR "public"."is_owner"())) WITH CHECK (("public"."is_club_admin"("id") OR "public"."is_owner"()));



CREATE POLICY "conflicts_admin_only" ON "public"."planning_conflicts" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "planning_conflicts"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



ALTER TABLE "public"."contact_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contact_requests_owner_read" ON "public"."contact_requests" FOR SELECT TO "authenticated" USING (("public"."is_owner"() OR "public"."is_superadmin"()));



ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "court_access" ON "public"."courts" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."club_id" = "courts"."club_id") AND ("user_club_memberships"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."court_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."court_closures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "court_closures_delete" ON "public"."court_closures" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "court_closures"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "court_closures_insert" ON "public"."court_closures" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "court_closures"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "court_closures_select" ON "public"."court_closures" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "court_closures"."club_id") AND ("ucm"."is_active" = true)))));



CREATE POLICY "court_closures_update" ON "public"."court_closures" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "court_closures"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



ALTER TABLE "public"."court_maintenance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."court_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "courts_delete" ON "public"."courts" FOR DELETE USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "courts_insert" ON "public"."courts" FOR INSERT WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "courts_modify_admin" ON "public"."courts" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "courts_select" ON "public"."courts" FOR SELECT USING (("club_id" = ANY ("public"."get_user_club_ids"())));



CREATE POLICY "courts_update" ON "public"."courts" FOR UPDATE USING ("public"."is_club_admin"("club_id"));



ALTER TABLE "public"."decision_changes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "decision_changes_admin_insert" ON "public"."decision_changes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."board_decisions" "d"
     JOIN "public"."user_club_memberships" "m" ON ((("m"."user_id" = "auth"."uid"()) AND ("m"."club_id" = "d"."club_id") AND ("m"."is_active" = true) AND (("m"."role")::"text" = ANY (ARRAY[('owner'::character varying)::"text", ('superadmin'::character varying)::"text", ('admin'::character varying)::"text"])))))
  WHERE ("d"."id" = "decision_changes"."decision_id"))));



CREATE POLICY "decision_changes_club_read" ON "public"."decision_changes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."board_decisions" "d"
     JOIN "public"."user_club_memberships" "m" ON ((("m"."user_id" = "auth"."uid"()) AND ("m"."club_id" = "d"."club_id") AND ("m"."is_active" = true) AND (("m"."role")::"text" = ANY (ARRAY[('owner'::character varying)::"text", ('superadmin'::character varying)::"text", ('admin'::character varying)::"text"])))))
  WHERE ("d"."id" = "decision_changes"."decision_id"))));



ALTER TABLE "public"."decision_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "decision_votes_admin_read_all" ON "public"."decision_votes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."board_decisions" "d"
     JOIN "public"."user_club_memberships" "m" ON ((("m"."user_id" = "auth"."uid"()) AND ("m"."club_id" = "d"."club_id") AND ("m"."is_active" = true) AND (("m"."role")::"text" = ANY (ARRAY[('owner'::character varying)::"text", ('superadmin'::character varying)::"text", ('admin'::character varying)::"text"])))))
  WHERE ("d"."id" = "decision_votes"."decision_id"))));



CREATE POLICY "decision_votes_voter_insert_own" ON "public"."decision_votes" FOR INSERT TO "authenticated" WITH CHECK (("voter_id" = "auth"."uid"()));



CREATE POLICY "decision_votes_voter_read_own" ON "public"."decision_votes" FOR SELECT TO "authenticated" USING (("voter_id" = "auth"."uid"()));



CREATE POLICY "decision_votes_voter_update_own" ON "public"."decision_votes" FOR UPDATE TO "authenticated" USING (("voter_id" = "auth"."uid"()));



ALTER TABLE "public"."dunning_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fee_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gamification_badges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gamification_badges_insert_authenticated" ON "public"."gamification_badges" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."gamification_points" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gamification_points_select_authenticated" ON "public"."gamification_points" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hourly_rate_tiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hourly_rate_tiers_admin_manage" ON "public"."hourly_rate_tiers" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "hourly_rate_tiers_member_view_active" ON "public"."hourly_rate_tiers" FOR SELECT USING (("public"."is_club_member"("club_id") AND ("is_active" = true)));



CREATE POLICY "hourly_rate_tiers_trainer_view" ON "public"."hourly_rate_tiers" FOR SELECT USING ("public"."is_club_trainer"("club_id"));



ALTER TABLE "public"."hours_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hours_logs_delete" ON "public"."hours_logs" FOR DELETE USING ((((("status")::"text" = 'pending'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."trainers"
  WHERE (("trainers"."id" = "hours_logs"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."trainer_club" "tc"
  WHERE (("tc"."trainer_id" = "hours_logs"."trainer_id") AND "public"."is_superadmin_of"("tc"."club_id"))))));



CREATE POLICY "hours_logs_insert" ON "public"."hours_logs" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."trainers"
  WHERE (("trainers"."id" = "hours_logs"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trainer_club" "tc"
  WHERE (("tc"."trainer_id" = "hours_logs"."trainer_id") AND "public"."is_superadmin_of"("tc"."club_id"))))));



CREATE POLICY "hours_logs_own_trainer" ON "public"."hours_logs" USING (("trainer_id" = "auth"."uid"()));



CREATE POLICY "hours_logs_select" ON "public"."hours_logs" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."trainers"
  WHERE (("trainers"."id" = "hours_logs"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trainer_club" "tc"
  WHERE (("tc"."trainer_id" = "hours_logs"."trainer_id") AND "public"."is_superadmin_of"("tc"."club_id"))))));



CREATE POLICY "hours_logs_update" ON "public"."hours_logs" FOR UPDATE USING ((((("status")::"text" = 'pending'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."trainers"
  WHERE (("trainers"."id" = "hours_logs"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."trainer_club" "tc"
  WHERE (("tc"."trainer_id" = "hours_logs"."trainer_id") AND "public"."is_superadmin_of"("tc"."club_id"))))));



CREATE POLICY "installments_admin_all" ON "public"."invoice_installments" USING ((EXISTS ( SELECT 1
   FROM ("public"."invoices" "i"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "i"."club_id")))
  WHERE (("i"."id" = "invoice_installments"."invoice_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "installments_member_view_own" ON "public"."invoice_installments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_installments"."invoice_id") AND ("i"."member_id" = "auth"."uid"())))));



ALTER TABLE "public"."invoice_installments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_manage_admin" ON "public"."invoices" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "invoices_select" ON "public"."invoices" FOR SELECT USING ((("member_id" = "auth"."uid"()) OR ("trainer_id" = "auth"."uid"()) OR "public"."is_club_admin"("club_id")));



ALTER TABLE "public"."job_execution_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_execution_log_superadmin_all" ON "public"."job_execution_log" USING (("public"."is_superadmin"() OR (EXISTS ( SELECT 1
   FROM "public"."background_jobs"
  WHERE ("background_jobs"."id" = "job_execution_log"."job_id")))));



ALTER TABLE "public"."league_players" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "league_players_delete" ON "public"."league_players" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "league_players"."club_id") AND (("ucm"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "league_players_insert" ON "public"."league_players" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "league_players"."club_id") AND (("ucm"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "league_players_select" ON "public"."league_players" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "league_players"."club_id") AND ("ucm"."is_active" = true)))));



CREATE POLICY "league_players_update" ON "public"."league_players" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "league_players"."club_id") AND (("ucm"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[])) AND ("ucm"."is_active" = true)))));



ALTER TABLE "public"."leagues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leagues_delete" ON "public"."leagues" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "leagues"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "leagues_insert" ON "public"."leagues" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "leagues"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "leagues_select" ON "public"."leagues" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "leagues"."club_id") AND ("ucm"."is_active" = true)))));



CREATE POLICY "leagues_update" ON "public"."leagues" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "leagues"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



ALTER TABLE "public"."match_caterings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_days" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_days_delete" ON "public"."match_days" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."leagues" "l"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "l"."club_id")))
  WHERE (("l"."id" = "match_days"."league_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "match_days_insert" ON "public"."match_days" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."leagues" "l"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "l"."club_id")))
  WHERE (("l"."id" = "match_days"."league_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "match_days_select" ON "public"."match_days" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."leagues" "l"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "l"."club_id")))
  WHERE (("l"."id" = "match_days"."league_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true)))));



CREATE POLICY "match_days_update" ON "public"."match_days" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."leagues" "l"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "l"."club_id")))
  WHERE (("l"."id" = "match_days"."league_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



ALTER TABLE "public"."match_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_results_admin_manage" ON "public"."match_results" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."club_id" = "match_results"."club_id") AND ("m"."is_active" = true) AND (("m"."role")::"text" = ANY (ARRAY[('owner'::character varying)::"text", ('superadmin'::character varying)::"text", ('admin'::character varying)::"text", ('trainer'::character varying)::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."club_id" = "match_results"."club_id") AND ("m"."is_active" = true) AND (("m"."role")::"text" = ANY (ARRAY[('owner'::character varying)::"text", ('superadmin'::character varying)::"text", ('admin'::character varying)::"text", ('trainer'::character varying)::"text"]))))));



CREATE POLICY "match_results_club_read" ON "public"."match_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."club_id" = "match_results"."club_id") AND ("m"."is_active" = true)))));



ALTER TABLE "public"."matchday_reminder_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matchday_reminder_logs_select_own" ON "public"."matchday_reminder_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "matches_manage" ON "public"."tournament_matches" USING (("public"."is_club_admin"(( SELECT "tournaments"."club_id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "tournament_matches"."tournament_id"))) OR "public"."is_superadmin"()));



CREATE POLICY "matches_select" ON "public"."tournament_matches" FOR SELECT USING (("public"."is_superadmin"() OR "public"."is_club_member"(( SELECT "tournaments"."club_id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "tournament_matches"."tournament_id")))));



CREATE POLICY "mb_admin_all" ON "public"."member_balances" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "member_balances"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "mb_member_view_own" ON "public"."member_balances" FOR SELECT USING (("member_id" = "auth"."uid"()));



CREATE POLICY "mbe_admin_all" ON "public"."member_balance_entries" USING ((EXISTS ( SELECT 1
   FROM ("public"."member_balances" "mb"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "mb"."club_id")))
  WHERE (("mb"."id" = "member_balance_entries"."member_balance_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "mbe_member_view_own" ON "public"."member_balance_entries" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."member_balances" "mb"
  WHERE (("mb"."id" = "member_balance_entries"."member_balance_id") AND ("mb"."member_id" = "auth"."uid"())))));



ALTER TABLE "public"."meeting_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "meeting_invitations_admin_manage" ON "public"."meeting_invitations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."board_decisions" "d"
     JOIN "public"."user_club_memberships" "m" ON ((("m"."user_id" = "auth"."uid"()) AND ("m"."club_id" = "d"."club_id") AND ("m"."is_active" = true) AND (("m"."role")::"text" = ANY (ARRAY[('owner'::character varying)::"text", ('superadmin'::character varying)::"text", ('admin'::character varying)::"text"])))))
  WHERE ("d"."id" = "meeting_invitations"."decision_id"))));



CREATE POLICY "meeting_invitations_member_read_own" ON "public"."meeting_invitations" FOR SELECT TO "authenticated" USING (("member_id" = "auth"."uid"()));



CREATE POLICY "meeting_invitations_member_update_own" ON "public"."meeting_invitations" FOR UPDATE TO "authenticated" USING (("member_id" = "auth"."uid"())) WITH CHECK (("member_id" = "auth"."uid"()));



CREATE POLICY "member read match_caterings" ON "public"."match_caterings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."club_id" = "match_caterings"."club_id") AND ("user_club_memberships"."is_active" = true)))));



ALTER TABLE "public"."member_balance_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_booking_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_meetings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_read_own_waitlist" ON "public"."trainer_slot_waitlist" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."member_schedule_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_schedule_prefs_delete_own" ON "public"."member_schedule_preferences" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "member_schedule_prefs_insert_own" ON "public"."member_schedule_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "member_schedule_prefs_select_own" ON "public"."member_schedule_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "member_schedule_prefs_update_own" ON "public"."member_schedule_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "members_can_create_comments" ON "public"."news_comments" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."news_posts" "np"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "np"."club_id")))
  WHERE (("np"."id" = "news_comments"."news_post_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("np"."status")::"text" = 'published'::"text"))))));



CREATE POLICY "members_can_view_comments" ON "public"."news_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."news_posts" "np"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "np"."club_id")))
  WHERE (("np"."id" = "news_comments"."news_post_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("np"."status")::"text" = 'published'::"text")))));



CREATE POLICY "members_can_view_own_dunning" ON "public"."dunning_records" FOR SELECT USING ((("member_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "dunning_records"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])))))));



CREATE POLICY "members_can_view_own_dunning_via_invoice" ON "public"."dunning_records" FOR SELECT USING ((("member_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "dunning_records"."invoice_id") AND ("i"."member_id" = "auth"."uid"()))))));



CREATE POLICY "members_can_view_published_news" ON "public"."news_posts" FOR SELECT USING (((("status")::"text" = 'published'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "news_posts"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true))))));



CREATE POLICY "members_can_view_trainer_assignments" ON "public"."trainer_assignments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "trainer_assignments"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true)))));



CREATE POLICY "members_manage_own_comments" ON "public"."news_comments" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "members_see_comments" ON "public"."news_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."news_posts" "p"
  WHERE (("p"."id" = "news_comments"."post_id") AND "public"."is_club_member"("p"."club_id")))));



CREATE POLICY "memberships_manage_admin" ON "public"."user_club_memberships" USING ((("club_id" IS NOT NULL) AND "public"."is_club_admin"("club_id")));



CREATE POLICY "memberships_owner_insert" ON "public"."user_club_memberships" FOR INSERT WITH CHECK (("public"."is_owner"() OR "public"."is_club_admin"("club_id")));



CREATE POLICY "memberships_owner_select" ON "public"."user_club_memberships" FOR SELECT USING (("public"."is_owner"() OR "public"."is_club_admin"("club_id") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "memberships_owner_update" ON "public"."user_club_memberships" FOR UPDATE USING (("public"."is_owner"() OR "public"."is_club_admin"("club_id")));



CREATE POLICY "memberships_select" ON "public"."user_club_memberships" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("club_id" IS NOT NULL) AND "public"."is_club_admin"("club_id"))));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_delete_sender" ON "public"."messages" FOR DELETE USING (("auth"."uid"() = "sender_id"));



CREATE POLICY "messages_insert" ON "public"."messages" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "messages_select_receiver" ON "public"."messages" FOR SELECT USING (("auth"."uid"() = "receiver_id"));



CREATE POLICY "messages_select_sender" ON "public"."messages" FOR SELECT USING (("auth"."uid"() = "sender_id"));



CREATE POLICY "messages_update_receiver" ON "public"."messages" FOR UPDATE USING (("auth"."uid"() = "receiver_id"));



ALTER TABLE "public"."news_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."news_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_send_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete_owner" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_insert" ON "public"."notifications" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "notifications_select_owner" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_update_owner" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."nuliga_sync_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."open_match_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "open_match_participants_insert" ON "public"."open_match_participants" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "open_match_participants_select" ON "public"."open_match_participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."open_matches"
  WHERE (("open_matches"."id" = "open_match_participants"."match_id") AND (EXISTS ( SELECT 1
           FROM "public"."user_club_memberships"
          WHERE (("user_club_memberships"."club_id" = "open_matches"."club_id") AND ("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."is_active" = true))))))));



CREATE POLICY "open_match_participants_update" ON "public"."open_match_participants" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."open_matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "open_matches_delete" ON "public"."open_matches" FOR DELETE USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "open_matches_insert" ON "public"."open_matches" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."club_id" = "open_matches"."club_id") AND ("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."is_active" = true)))));



CREATE POLICY "open_matches_select" ON "public"."open_matches" FOR SELECT USING ((("is_public" = true) AND (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."club_id" = "open_matches"."club_id") AND ("user_club_memberships"."user_id" = "auth"."uid"()) AND ("user_club_memberships"."is_active" = true))))));



CREATE POLICY "open_matches_update" ON "public"."open_matches" FOR UPDATE USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "own_registrations" ON "public"."special_event_registrations" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."payment_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planning_conflicts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "planning_history_admin_view" ON "public"."season_planning_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "season_planning_history"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "players_admin_manage" ON "public"."players" TO "authenticated" USING (("public"."is_superadmin"() OR "public"."is_owner"()));



ALTER TABLE "public"."pricing_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subs_delete_own" ON "public"."push_subscriptions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "push_subs_insert_own" ON "public"."push_subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "push_subs_select_own" ON "public"."push_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "push_subs_service_all" ON "public"."push_subscriptions" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "push_subs_update_own" ON "public"."push_subscriptions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."qr_checkins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rate_history_admin_view" ON "public"."rate_history" FOR SELECT USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "reg_insert" ON "public"."tournament_registrations" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "reg_manage" ON "public"."tournament_registrations" USING (("public"."is_club_admin"(( SELECT "tournaments"."club_id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "tournament_registrations"."tournament_id"))) OR "public"."is_superadmin"()));



CREATE POLICY "reg_select" ON "public"."tournament_registrations" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_superadmin"() OR "public"."is_club_admin"(( SELECT "tournaments"."club_id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "tournament_registrations"."tournament_id")))));



ALTER TABLE "public"."registration_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedule_access_via_club" ON "public"."schedules" USING ((EXISTS ( SELECT 1
   FROM ("public"."clubs" "c"
     JOIN "public"."user_club_memberships" "m" ON (("m"."club_id" = "c"."id")))
  WHERE (("c"."id" = "schedules"."club_id") AND ("m"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedules_access" ON "public"."schedules" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "schedules"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true)))));



CREATE POLICY "schedules_delete" ON "public"."schedules" FOR DELETE USING (("public"."is_owner"() OR "public"."is_superadmin"() OR "public"."is_club_admin"("club_id")));



CREATE POLICY "schedules_insert" ON "public"."schedules" FOR INSERT WITH CHECK (("public"."is_owner"() OR "public"."is_superadmin"() OR "public"."is_club_admin"("club_id")));



CREATE POLICY "schedules_select" ON "public"."schedules" FOR SELECT USING (("public"."is_owner"() OR "public"."is_superadmin"() OR "public"."is_club_member"("club_id")));



CREATE POLICY "schedules_update" ON "public"."schedules" FOR UPDATE USING (("public"."is_owner"() OR "public"."is_superadmin"() OR "public"."is_club_admin"("club_id")));



ALTER TABLE "public"."school_holidays" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "school_holidays_admin_manage" ON "public"."school_holidays" USING ("public"."is_superadmin"());



CREATE POLICY "school_holidays_select_all" ON "public"."school_holidays" FOR SELECT USING (true);



ALTER TABLE "public"."season_billing_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."season_group_weeks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "season_group_weeks_admin_all" ON "public"."season_group_weeks" USING ("public"."is_club_admin"("club_id")) WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "season_group_weeks_member_read" ON "public"."season_group_weeks" FOR SELECT USING ("public"."is_club_member"("club_id"));



ALTER TABLE "public"."season_plan_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "season_plan_entries_member_view_published" ON "public"."season_plan_entries" FOR SELECT TO "authenticated" USING (((("status")::"text" = 'published'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "season_plan_entries"."club_id") AND ("ucm"."is_active" = true))))));



CREATE POLICY "season_plan_entries_trainer_view" ON "public"."season_plan_entries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."trainers" "t"
  WHERE (("t"."id" = "season_plan_entries"."trainer_id") AND ("t"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."season_plan_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."season_planning_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "season_planning_configs_admin_delete" ON "public"."season_planning_configs" FOR DELETE TO "authenticated" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "season_planning_configs_admin_insert" ON "public"."season_planning_configs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "season_planning_configs_admin_select" ON "public"."season_planning_configs" FOR SELECT TO "authenticated" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "season_planning_configs_admin_update" ON "public"."season_planning_configs" FOR UPDATE TO "authenticated" USING ("public"."is_club_admin"("club_id"));



ALTER TABLE "public"."season_planning_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."season_statistics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "season_statistics_admin_select" ON "public"."season_statistics" FOR SELECT TO "authenticated" USING ("public"."is_club_admin"("club_id"));



ALTER TABLE "public"."season_waitlists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seasons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seasons_manage_admin" ON "public"."seasons" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "seasons_select" ON "public"."seasons" FOR SELECT USING (("public"."is_superadmin"() OR "public"."is_club_member"("club_id")));



CREATE POLICY "see_own_invoice_items" ON "public"."invoice_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_items"."invoice_id") AND (("i"."member_id" = "auth"."uid"()) OR ("i"."trainer_id" = "auth"."uid"()) OR "public"."is_club_admin"("i"."club_id"))))));



CREATE POLICY "see_own_payments" ON "public"."payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "payments"."invoice_id") AND (("i"."member_id" = "auth"."uid"()) OR ("i"."trainer_id" = "auth"."uid"()) OR "public"."is_club_admin"("i"."club_id"))))));



ALTER TABLE "public"."sepa_mandates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sepa_mandates_admin_manage" ON "public"."sepa_mandates" USING ((("club_id" IS NOT NULL) AND "public"."is_club_admin"("club_id")));



CREATE POLICY "sepa_mandates_member_create_own" ON "public"."sepa_mandates" FOR INSERT WITH CHECK (("member_id" = "auth"."uid"()));



CREATE POLICY "sepa_mandates_member_view_own" ON "public"."sepa_mandates" FOR SELECT USING (("member_id" = "auth"."uid"()));



CREATE POLICY "session_access_via_schedule" ON "public"."sessions" USING ((EXISTS ( SELECT 1
   FROM (("public"."schedules" "s"
     JOIN "public"."clubs" "c" ON (("s"."club_id" = "c"."id")))
     JOIN "public"."user_club_memberships" "m" ON (("m"."club_id" = "c"."id")))
  WHERE (("s"."id" = "sessions"."schedule_id") AND ("m"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."session_rsvps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_waitlist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_waitlist_delete" ON "public"."session_waitlist" FOR DELETE USING ((("member_id" = "auth"."uid"()) OR "public"."is_club_trainer"("club_id")));



CREATE POLICY "session_waitlist_insert" ON "public"."session_waitlist" FOR INSERT WITH CHECK ((("member_id" = "auth"."uid"()) OR "public"."is_club_trainer"("club_id")));



CREATE POLICY "session_waitlist_select" ON "public"."session_waitlist" FOR SELECT USING ((("member_id" = "auth"."uid"()) OR "public"."is_club_trainer"("club_id")));



CREATE POLICY "session_waitlist_update" ON "public"."session_waitlist" FOR UPDATE USING ("public"."is_club_trainer"("club_id"));



ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions_access" ON "public"."sessions" USING ((EXISTS ( SELECT 1
   FROM ("public"."schedules" "s"
     JOIN "public"."user_club_memberships" "ucm" ON (("s"."club_id" = "ucm"."club_id")))
  WHERE (("s"."id" = "sessions"."schedule_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true)))));



CREATE POLICY "sessions_delete" ON "public"."sessions" FOR DELETE USING (("public"."is_owner"() OR (EXISTS ( SELECT 1
   FROM "public"."schedules" "s"
  WHERE (("s"."id" = "sessions"."schedule_id") AND "public"."is_club_admin"("s"."club_id"))))));



CREATE POLICY "sessions_insert" ON "public"."sessions" FOR INSERT WITH CHECK (("public"."is_owner"() OR (EXISTS ( SELECT 1
   FROM "public"."schedules" "s"
  WHERE (("s"."id" = "sessions"."schedule_id") AND "public"."is_club_trainer"("s"."club_id"))))));



CREATE POLICY "sessions_update" ON "public"."sessions" FOR UPDATE USING (("public"."is_owner"() OR (EXISTS ( SELECT 1
   FROM "public"."schedules" "s"
  WHERE (("s"."id" = "sessions"."schedule_id") AND "public"."is_club_trainer"("s"."club_id"))))));



ALTER TABLE "public"."shop_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."special_event_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."special_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sync_log_select_admin" ON "public"."nuliga_sync_log" FOR SELECT USING (("club_id" IN ( SELECT "user_club_memberships"."club_id"
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("user_club_memberships"."is_active" = true)))));



ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members_delete" ON "public"."team_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."teams" "t"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "t"."club_id")))
  WHERE (("t"."id" = "team_members"."team_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "team_members_insert" ON "public"."team_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."teams" "t"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "t"."club_id")))
  WHERE (("t"."id" = "team_members"."team_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "team_members_select" ON "public"."team_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."teams" "t"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "t"."club_id")))
  WHERE (("t"."id" = "team_members"."team_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true)))));



ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams_delete" ON "public"."teams" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "teams"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "teams_insert" ON "public"."teams" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "teams"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "teams_select" ON "public"."teams" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "teams"."club_id") AND ("ucm"."is_active" = true)))));



CREATE POLICY "teams_update" ON "public"."teams" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "teams"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "tgm_admin_manage" ON "public"."training_group_memberships" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "training_group_memberships"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



CREATE POLICY "tgm_member_view_own" ON "public"."training_group_memberships" FOR SELECT USING (("member_id" = "auth"."uid"()));



ALTER TABLE "public"."tournament_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournaments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournaments_manage" ON "public"."tournaments" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "tournaments_select" ON "public"."tournaments" FOR SELECT USING ("public"."is_club_member"("club_id"));



ALTER TABLE "public"."trainer_absences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_availabilities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainer_availabilities_delete" ON "public"."trainer_availabilities" FOR DELETE USING ((((("status")::"text" <> 'booked'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."trainers"
  WHERE (("trainers"."id" = "trainer_availabilities"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."trainer_club" "tc"
  WHERE (("tc"."trainer_id" = "trainer_availabilities"."trainer_id") AND "public"."is_superadmin_of"("tc"."club_id"))))));



CREATE POLICY "trainer_availabilities_insert" ON "public"."trainer_availabilities" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."trainers"
  WHERE (("trainers"."id" = "trainer_availabilities"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trainer_club" "tc"
  WHERE (("tc"."trainer_id" = "trainer_availabilities"."trainer_id") AND "public"."is_superadmin_of"("tc"."club_id"))))));



CREATE POLICY "trainer_availabilities_select" ON "public"."trainer_availabilities" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."trainers"
  WHERE (("trainers"."id" = "trainer_availabilities"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trainer_club" "tc"
  WHERE (("tc"."trainer_id" = "trainer_availabilities"."trainer_id") AND "public"."is_superadmin_of"("tc"."club_id"))))));



CREATE POLICY "trainer_availabilities_update" ON "public"."trainer_availabilities" FOR UPDATE USING ((((("status")::"text" <> 'booked'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."trainers"
  WHERE (("trainers"."id" = "trainer_availabilities"."trainer_id") AND ("trainers"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."trainer_club" "tc"
  WHERE (("tc"."trainer_id" = "trainer_availabilities"."trainer_id") AND "public"."is_superadmin_of"("tc"."club_id"))))));



ALTER TABLE "public"."trainer_billings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainer_billings_delete" ON "public"."trainer_billings" FOR DELETE TO "authenticated" USING ("public"."is_superadmin_of"(( SELECT "bp"."club_id"
   FROM "public"."billing_periods" "bp"
  WHERE ("bp"."id" = "trainer_billings"."billing_period_id"))));



CREATE POLICY "trainer_billings_insert" ON "public"."trainer_billings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_superadmin_of"(( SELECT "bp"."club_id"
   FROM "public"."billing_periods" "bp"
  WHERE ("bp"."id" = "trainer_billings"."billing_period_id"))));



CREATE POLICY "trainer_billings_select" ON "public"."trainer_billings" FOR SELECT TO "authenticated" USING (("public"."is_superadmin_of"(( SELECT "bp"."club_id"
   FROM "public"."billing_periods" "bp"
  WHERE ("bp"."id" = "trainer_billings"."billing_period_id"))) OR (EXISTS ( SELECT 1
   FROM "public"."trainers" "t"
  WHERE (("t"."id" = "trainer_billings"."trainer_id") AND ("t"."user_id" = "auth"."uid"()))))));



CREATE POLICY "trainer_billings_update" ON "public"."trainer_billings" FOR UPDATE TO "authenticated" USING ("public"."is_superadmin_of"(( SELECT "bp"."club_id"
   FROM "public"."billing_periods" "bp"
  WHERE ("bp"."id" = "trainer_billings"."billing_period_id"))));



ALTER TABLE "public"."trainer_club" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainer_club_access" ON "public"."trainer_club" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "trainer_club"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true)))));



CREATE POLICY "trainer_club_access_policy" ON "public"."trainer_club" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships"
  WHERE (("user_club_memberships"."club_id" = "trainer_club"."club_id") AND ("user_club_memberships"."user_id" = "auth"."uid"()) AND (("user_club_memberships"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"]))))));



ALTER TABLE "public"."trainer_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainer_feedback_admin_select" ON "public"."trainer_feedback" FOR SELECT TO "authenticated" USING ("public"."is_club_admin"("club_id"));



ALTER TABLE "public"."trainer_hourly_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainer_hourly_rates_admin_manage" ON "public"."trainer_hourly_rates" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "trainer_hourly_rates_trainer_view_own" ON "public"."trainer_hourly_rates" FOR SELECT USING ((("trainer_id" = "auth"."uid"()) OR "public"."is_club_trainer"("club_id")));



ALTER TABLE "public"."trainer_member_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainer_notes_delete" ON "public"."trainer_member_notes" FOR DELETE USING (("public"."is_club_admin"("club_id") OR (EXISTS ( SELECT 1
   FROM "public"."trainers" "t"
  WHERE (("t"."id" = "trainer_member_notes"."trainer_id") AND ("t"."user_id" = "auth"."uid"()))))));



CREATE POLICY "trainer_notes_insert" ON "public"."trainer_member_notes" FOR INSERT WITH CHECK ("public"."is_club_trainer"("club_id"));



CREATE POLICY "trainer_notes_select" ON "public"."trainer_member_notes" FOR SELECT USING (("public"."is_club_admin"("club_id") OR (EXISTS ( SELECT 1
   FROM "public"."trainers" "t"
  WHERE (("t"."id" = "trainer_member_notes"."trainer_id") AND ("t"."user_id" = "auth"."uid"()))))));



CREATE POLICY "trainer_notes_update" ON "public"."trainer_member_notes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."trainers" "t"
  WHERE (("t"."id" = "trainer_member_notes"."trainer_id") AND ("t"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."trainer_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainer_profiles_admin_manage" ON "public"."trainer_profiles" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "trainer_profiles_member_view_active" ON "public"."trainer_profiles" FOR SELECT USING (("public"."is_club_member"("club_id") AND (("status")::"text" = 'active'::"text")));



CREATE POLICY "trainer_profiles_trainer_update_own" ON "public"."trainer_profiles" FOR UPDATE USING ((("user_id" = "auth"."uid"()) AND "public"."is_club_trainer"("club_id")));



CREATE POLICY "trainer_profiles_trainer_view" ON "public"."trainer_profiles" FOR SELECT USING ("public"."is_club_trainer"("club_id"));



ALTER TABLE "public"."trainer_rating_summary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_slot_waitlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainers_admin_delete" ON "public"."trainers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."trainer_club" "tc"
  WHERE (("tc"."trainer_id" = "trainers"."id") AND "public"."is_club_admin"("tc"."club_id")))));



CREATE POLICY "trainers_admin_select" ON "public"."trainers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."trainer_club" "tc"
  WHERE (("tc"."trainer_id" = "trainers"."id") AND "public"."is_club_admin"("tc"."club_id")))));



CREATE POLICY "trainers_admin_update" ON "public"."trainers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."trainer_club" "tc"
  WHERE (("tc"."trainer_id" = "trainers"."id") AND "public"."is_club_admin"("tc"."club_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."trainer_club" "tc"
  WHERE (("tc"."trainer_id" = "trainers"."id") AND "public"."is_club_admin"("tc"."club_id")))));



CREATE POLICY "trainers_can_create_own_absences" ON "public"."trainer_absences" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_club_trainer"("club_id")));



CREATE POLICY "trainers_can_delete_own_pending_absences" ON "public"."trainer_absences" FOR DELETE USING ((("user_id" = "auth"."uid"()) AND (("status")::"text" = 'pending'::"text")));



CREATE POLICY "trainers_can_update_own_pending_absences" ON "public"."trainer_absences" FOR UPDATE USING ((("user_id" = "auth"."uid"()) AND (("status")::"text" = 'pending'::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND (("status")::"text" = 'pending'::"text")));



CREATE POLICY "trainers_can_view_own_absences" ON "public"."trainer_absences" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "trainer_absences"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])))))));



CREATE POLICY "trainers_can_view_own_assignments" ON "public"."trainer_assignments" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "trainers_own" ON "public"."trainers" FOR SELECT USING (("public"."is_superadmin"() OR ("id" = "auth"."uid"()) OR ("user_id" = "auth"."uid"()) OR ("id" = "public"."get_my_trainer_id"())));



ALTER TABLE "public"."training_group_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_groups_access" ON "public"."training_groups" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "training_groups"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true)))));



CREATE POLICY "training_groups_manage_admin" ON "public"."training_groups" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "training_groups"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "training_groups_select_admin" ON "public"."training_groups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."club_id" = "training_groups"."club_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[])) AND ("ucm"."is_active" = true)))));



ALTER TABLE "public"."trial_trainings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_club_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_club_memberships_access_own" ON "public"."user_club_memberships" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_dashboard_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_training_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_can_delete_own_comments" ON "public"."news_comments" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."news_posts" "np"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "np"."club_id")))
  WHERE (("np"."id" = "news_comments"."news_post_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])))))));



CREATE POLICY "users_can_manage_own_booking_preferences" ON "public"."member_booking_preferences" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_can_update_own_comments" ON "public"."news_comments" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_can_view_own_booking_preferences" ON "public"."member_booking_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_delete_own_waitlist" ON "public"."waitlist_entries" FOR DELETE USING ((("auth"."uid"() = "user_id") OR "public"."is_club_admin"("club_id")));



CREATE POLICY "users_insert_own" ON "public"."users" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "users_insert_own_consents" ON "public"."notification_consents" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_waitlist" ON "public"."waitlist_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_own" ON "public"."users" USING (("id" = "auth"."uid"()));



CREATE POLICY "users_see_own_notifications" ON "public"."notifications" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_see_own_waitlist" ON "public"."waitlist_entries" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_club_admin"("club_id")));



CREATE POLICY "users_update_admin_club" ON "public"."users" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "users"."id") AND "public"."is_club_admin"("ucm"."club_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "users"."id") AND "public"."is_club_admin"("ucm"."club_id")))));



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "users_update_own_consents" ON "public"."notification_consents" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_view_own_consents" ON "public"."notification_consents" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."waitlist_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_duties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_duties_delete" ON "public"."work_duties" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "work_duties"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "work_duties_insert" ON "public"."work_duties" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "work_duties"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "work_duties_select" ON "public"."work_duties" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "work_duties"."club_id") AND ("ucm"."is_active" = true)))));



CREATE POLICY "work_duties_update" ON "public"."work_duties" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_club_memberships" "ucm"
  WHERE (("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."club_id" = "work_duties"."club_id") AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



ALTER TABLE "public"."work_duty_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_duty_assignments_delete" ON "public"."work_duty_assignments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."work_duties" "wd"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "wd"."club_id")))
  WHERE (("wd"."id" = "work_duty_assignments"."duty_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "work_duty_assignments_insert" ON "public"."work_duty_assignments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."work_duties" "wd"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "wd"."club_id")))
  WHERE (("wd"."id" = "work_duty_assignments"."duty_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));



CREATE POLICY "work_duty_assignments_select" ON "public"."work_duty_assignments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."work_duties" "wd"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "wd"."club_id")))
  WHERE (("wd"."id" = "work_duty_assignments"."duty_id") AND ("ucm"."user_id" = "auth"."uid"()) AND ("ucm"."is_active" = true)))));



CREATE POLICY "work_duty_assignments_update" ON "public"."work_duty_assignments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."work_duties" "wd"
     JOIN "public"."user_club_memberships" "ucm" ON (("ucm"."club_id" = "wd"."club_id")))
  WHERE (("wd"."id" = "work_duty_assignments"."duty_id") AND ("ucm"."user_id" = "auth"."uid"()) AND (("ucm"."role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('superadmin'::character varying)::"text"])) AND ("ucm"."is_active" = true)))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."add_balance_entry_atomic"("p_balance_id" "uuid", "p_amount" numeric, "p_reason" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_balance_entry_atomic"("p_balance_id" "uuid", "p_amount" numeric, "p_reason" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_balance_entry_atomic"("p_balance_id" "uuid", "p_amount" numeric, "p_reason" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_finance_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_finance_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_finance_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_dunning_level"("p_invoice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_dunning_level"("p_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_dunning_level"("p_invoice_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."fee_configurations" TO "anon";
GRANT ALL ON TABLE "public"."fee_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_configurations" TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_member_fees"("p_club_id" "uuid", "p_member_age" integer, "p_member_type" character varying, "p_training_group" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_member_fees"("p_club_id" "uuid", "p_member_age" integer, "p_member_type" character varying, "p_training_group" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_member_fees"("p_club_id" "uuid", "p_member_age" integer, "p_member_type" character varying, "p_training_group" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_payment_fee"("p_payment_settings_id" "uuid", "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_payment_fee"("p_payment_settings_id" "uuid", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_payment_fee"("p_payment_settings_id" "uuid", "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_season_weeks"("season_start" "date", "season_end" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_season_weeks"("season_start" "date", "season_end" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_season_weeks"("season_start" "date", "season_end" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_record_stripe_event"("p_event_id" "text", "p_event_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_record_stripe_event"("p_event_id" "text", "p_event_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_record_stripe_event"("p_event_id" "text", "p_event_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_availability_overlap"("p_trainer_id" "uuid", "p_date" timestamp with time zone, "p_start_time" character varying, "p_end_time" character varying, "p_exclude_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_availability_overlap"("p_trainer_id" "uuid", "p_date" timestamp with time zone, "p_start_time" character varying, "p_end_time" character varying, "p_exclude_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_availability_overlap"("p_trainer_id" "uuid", "p_date" timestamp with time zone, "p_start_time" character varying, "p_end_time" character varying, "p_exclude_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_booking_overlap"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_booking_overlap"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_booking_overlap"() TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_background_job"("p_job_name" "text", "p_job_type" "text", "p_payload" "jsonb", "p_stale_after" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_background_job"("p_job_name" "text", "p_job_type" "text", "p_payload" "jsonb", "p_stale_after" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_background_job"("p_job_name" "text", "p_job_type" "text", "p_payload" "jsonb", "p_stale_after" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_job"("p_job_id" "uuid", "p_result" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_job"("p_job_id" "uuid", "p_result" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_job"("p_job_id" "uuid", "p_result" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_safe"("p_member_id" "uuid", "p_session_id" "uuid", "p_club_id" "uuid", "p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_safe"("p_member_id" "uuid", "p_session_id" "uuid", "p_club_id" "uuid", "p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_safe"("p_member_id" "uuid", "p_session_id" "uuid", "p_club_id" "uuid", "p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_invoice_with_items"("p_invoice" "jsonb", "p_items" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_invoice_with_items"("p_invoice" "jsonb", "p_items" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invoice_with_items"("p_invoice" "jsonb", "p_items" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."decision_changes_validate_actor"() TO "anon";
GRANT ALL ON FUNCTION "public"."decision_changes_validate_actor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decision_changes_validate_actor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_job"("p_job_name" "text", "p_job_type" "text", "p_payload" "jsonb", "p_schedule_expression" "text", "p_scheduled_at" timestamp with time zone, "p_priority" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_job"("p_job_name" "text", "p_job_type" "text", "p_payload" "jsonb", "p_schedule_expression" "text", "p_scheduled_at" timestamp with time zone, "p_priority" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_job"("p_job_name" "text", "p_job_type" "text", "p_payload" "jsonb", "p_schedule_expression" "text", "p_scheduled_at" timestamp with time zone, "p_priority" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_payment_setting"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_payment_setting"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_payment_setting"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fail_job"("p_job_id" "uuid", "p_error_message" "text", "p_stack_trace" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fail_job"("p_job_id" "uuid", "p_error_message" "text", "p_stack_trace" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fail_job"("p_job_id" "uuid", "p_error_message" "text", "p_stack_trace" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invoice_number"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_season_invoices_atomic"("p_season_id" "uuid", "p_club_id" "uuid", "p_invoices" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_season_invoices_atomic"("p_season_id" "uuid", "p_club_id" "uuid", "p_invoices" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_season_invoices_atomic"("p_season_id" "uuid", "p_club_id" "uuid", "p_invoices" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_slug"("p_title" "text", "p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_slug"("p_title" "text", "p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_slug"("p_title" "text", "p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_weekly_club_reports"("week_ago" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_weekly_club_reports"("week_ago" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_weekly_club_reports"("week_ago" timestamp with time zone) TO "service_role";



GRANT ALL ON TABLE "public"."hourly_rate_tiers" TO "anon";
GRANT ALL ON TABLE "public"."hourly_rate_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."hourly_rate_tiers" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_rate_tiers"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_rate_tiers"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_rate_tiers"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."sepa_mandates" TO "anon";
GRANT ALL ON TABLE "public"."sepa_mandates" TO "authenticated";
GRANT ALL ON TABLE "public"."sepa_mandates" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_sepa_mandate"("p_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_sepa_mandate"("p_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_sepa_mandate"("p_member_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."trainer_profiles" TO "anon";
GRANT ALL ON TABLE "public"."trainer_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_trainers"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_trainers"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_trainers"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_trainers"("p_club_id" "uuid", "p_datetime" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_trainers"("p_club_id" "uuid", "p_datetime" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_trainers"("p_club_id" "uuid", "p_datetime" timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cron_failures"("hours_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_cron_failures"("hours_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cron_failures"("hours_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_trainer_rate"("p_trainer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_trainer_rate"("p_trainer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_trainer_rate"("p_trainer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_trainer_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_trainer_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_trainer_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_jobs"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_jobs"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_jobs"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_session_end_time"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_session_end_time"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_session_end_time"("p_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_setting_value"("p_key" character varying, "p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_setting_value"("p_key" character varying, "p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_setting_value"("p_key" character varying, "p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_settings_as_object"("p_category" character varying, "p_club_id" "uuid", "p_public_only" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_settings_as_object"("p_category" character varying, "p_club_id" "uuid", "p_public_only" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_settings_as_object"("p_category" character varying, "p_club_id" "uuid", "p_public_only" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trainer_full_name"("p_trainer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_trainer_full_name"("p_trainer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trainer_full_name"("p_trainer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trial_training_stats"("p_club_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_trial_training_stats"("p_club_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trial_training_stats"("p_club_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON TABLE "public"."trial_trainings" TO "anon";
GRANT ALL ON TABLE "public"."trial_trainings" TO "authenticated";
GRANT ALL ON TABLE "public"."trial_trainings" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_upcoming_trial_trainings"("p_club_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_upcoming_trial_trainings"("p_club_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_upcoming_trial_trainings"("p_club_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_club_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_club_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_club_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_valid_fee_configurations"("p_club_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_valid_fee_configurations"("p_club_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_valid_fee_configurations"("p_club_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_active_sepa_mandate"("p_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_active_sepa_mandate"("p_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_active_sepa_mandate"("p_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_member_balance"("p_balance_id" "uuid", "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_member_balance"("p_balance_id" "uuid", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_member_balance"("p_balance_id" "uuid", "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_news_view_count"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_news_view_count"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_news_view_count"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_admin"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_admin"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_admin"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_member"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_member"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_member"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_trainer"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_trainer"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_trainer"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superadmin_of"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_superadmin_of"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superadmin_of"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_trainer_available"("p_user_id" "uuid", "p_club_id" "uuid", "p_datetime" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."is_trainer_available"("p_user_id" "uuid", "p_club_id" "uuid", "p_datetime" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_trainer_available"("p_user_id" "uuid", "p_club_id" "uuid", "p_datetime" timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_season_plan_entry_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_season_plan_entry_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_season_plan_entry_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_season_planning_action"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_season_planning_action"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_season_planning_action"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_invoice_items_for_recalc_on_plan_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_invoice_items_for_recalc_on_plan_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_invoice_items_for_recalc_on_plan_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_overdue_invoices"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_overdue_invoices"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_overdue_invoices"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_results_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."match_results_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_results_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_results_validate_outcome"() TO "anon";
GRANT ALL ON FUNCTION "public"."match_results_validate_outcome"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_results_validate_outcome"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_invoice_content_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_invoice_content_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_invoice_content_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_required_setting_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_required_setting_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_required_setting_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prune_audit_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."prune_audit_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_audit_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."season_group_weeks_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."season_group_weeks_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."season_group_weeks_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_dunning_member_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_dunning_member_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_dunning_member_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_preference_last_modified"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_preference_last_modified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_preference_last_modified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_trainer_absence_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_trainer_absence_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_trainer_absence_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."shares_active_club_with"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."shares_active_club_with"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."shares_active_club_with"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."start_job"("p_job_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."start_job"("p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_job"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."timeslots_overlap"("day1" integer, "start1" time without time zone, "end1" time without time zone, "day2" integer, "start2" time without time zone, "end2" time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."timeslots_overlap"("day1" integer, "start1" time without time zone, "end1" time without time zone, "day2" integer, "start2" time without time zone, "end2" time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."timeslots_overlap"("day1" integer, "start1" time without time zone, "end1" time without time zone, "day2" integer, "start2" time without time zone, "end2" time without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_dashboard_preferences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_dashboard_preferences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_dashboard_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_elo_after_match"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_elo_after_match"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_elo_after_match"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_fee_configurations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_fee_configurations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_fee_configurations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_invoice_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_invoice_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_invoice_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_open_matches_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_open_matches_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_open_matches_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_push_subscriptions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_push_subscriptions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_push_subscriptions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_season_billing_configs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_season_billing_configs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_season_billing_configs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_season_plan_entries_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_season_plan_entries_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_season_plan_entries_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_system_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_system_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_system_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_trainer_absences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_trainer_absences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_trainer_absences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_trainer_rating_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_trainer_rating_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_trainer_rating_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_trial_trainings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_trial_trainings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_trial_trainings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_available_at"("p_user_id" "uuid", "p_season_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_specific_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."user_available_at"("p_user_id" "uuid", "p_season_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_specific_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_available_at"("p_user_id" "uuid", "p_season_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_specific_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_booking_rules"("p_user_id" "uuid", "p_club_id" "uuid", "p_court_id" "uuid", "p_start_time" timestamp without time zone, "p_end_time" timestamp without time zone, "p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_booking_rules"("p_user_id" "uuid", "p_club_id" "uuid", "p_court_id" "uuid", "p_start_time" timestamp without time zone, "p_end_time" timestamp without time zone, "p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_booking_rules"("p_user_id" "uuid", "p_club_id" "uuid", "p_court_id" "uuid", "p_start_time" timestamp without time zone, "p_end_time" timestamp without time zone, "p_booking_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."attendance_records" TO "anon";
GRANT ALL ON TABLE "public"."attendance_records" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_records" TO "service_role";



GRANT ALL ON TABLE "public"."trainers" TO "anon";
GRANT ALL ON TABLE "public"."trainers" TO "authenticated";
GRANT ALL ON TABLE "public"."trainers" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_hours_summary" TO "anon";
GRANT ALL ON TABLE "public"."attendance_hours_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_hours_summary" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."background_jobs" TO "anon";
GRANT ALL ON TABLE "public"."background_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."background_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."base_interest_rates" TO "anon";
GRANT ALL ON TABLE "public"."base_interest_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."base_interest_rates" TO "service_role";



GRANT ALL ON TABLE "public"."billing_line_items" TO "anon";
GRANT ALL ON TABLE "public"."billing_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."billing_periods" TO "anon";
GRANT ALL ON TABLE "public"."billing_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_periods" TO "service_role";



GRANT ALL ON TABLE "public"."board_decisions" TO "anon";
GRANT ALL ON TABLE "public"."board_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."board_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."booking_restrictions" TO "anon";
GRANT ALL ON TABLE "public"."booking_restrictions" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_restrictions" TO "service_role";



GRANT ALL ON TABLE "public"."booking_rules" TO "anon";
GRANT ALL ON TABLE "public"."booking_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_rules" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."club_access_requests" TO "anon";
GRANT ALL ON TABLE "public"."club_access_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."club_access_requests" TO "service_role";



GRANT ALL ON TABLE "public"."club_documents" TO "anon";
GRANT ALL ON TABLE "public"."club_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."club_documents" TO "service_role";



GRANT ALL ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT ALL ON TABLE "public"."contact_requests" TO "anon";
GRANT ALL ON TABLE "public"."contact_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_requests" TO "service_role";



GRANT ALL ON TABLE "public"."coupons" TO "anon";
GRANT ALL ON TABLE "public"."coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."coupons" TO "service_role";



GRANT ALL ON TABLE "public"."court_availability" TO "anon";
GRANT ALL ON TABLE "public"."court_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."court_availability" TO "service_role";



GRANT ALL ON TABLE "public"."court_closures" TO "anon";
GRANT ALL ON TABLE "public"."court_closures" TO "authenticated";
GRANT ALL ON TABLE "public"."court_closures" TO "service_role";



GRANT ALL ON TABLE "public"."court_maintenance" TO "anon";
GRANT ALL ON TABLE "public"."court_maintenance" TO "authenticated";
GRANT ALL ON TABLE "public"."court_maintenance" TO "service_role";



GRANT ALL ON TABLE "public"."court_types" TO "anon";
GRANT ALL ON TABLE "public"."court_types" TO "authenticated";
GRANT ALL ON TABLE "public"."court_types" TO "service_role";



GRANT ALL ON TABLE "public"."courts" TO "anon";
GRANT ALL ON TABLE "public"."courts" TO "authenticated";
GRANT ALL ON TABLE "public"."courts" TO "service_role";



GRANT ALL ON TABLE "public"."decision_changes" TO "anon";
GRANT ALL ON TABLE "public"."decision_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."decision_changes" TO "service_role";



GRANT ALL ON TABLE "public"."decision_votes" TO "anon";
GRANT ALL ON TABLE "public"."decision_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."decision_votes" TO "service_role";



GRANT ALL ON TABLE "public"."dunning_records" TO "anon";
GRANT ALL ON TABLE "public"."dunning_records" TO "authenticated";
GRANT ALL ON TABLE "public"."dunning_records" TO "service_role";



GRANT ALL ON TABLE "public"."email_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."email_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."email_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."email_queue" TO "anon";
GRANT ALL ON TABLE "public"."email_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."email_queue" TO "service_role";



GRANT ALL ON TABLE "public"."family_accounts" TO "anon";
GRANT ALL ON TABLE "public"."family_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."family_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."family_invites" TO "anon";
GRANT ALL ON TABLE "public"."family_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."family_invites" TO "service_role";



GRANT ALL ON TABLE "public"."gamification_badges" TO "anon";
GRANT ALL ON TABLE "public"."gamification_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."gamification_badges" TO "service_role";



GRANT ALL ON TABLE "public"."gamification_points" TO "anon";
GRANT ALL ON TABLE "public"."gamification_points" TO "authenticated";
GRANT ALL ON TABLE "public"."gamification_points" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."hours_logs" TO "anon";
GRANT ALL ON TABLE "public"."hours_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."hours_logs" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_installments" TO "anon";
GRANT ALL ON TABLE "public"."invoice_installments" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_installments" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."job_execution_log" TO "anon";
GRANT ALL ON TABLE "public"."job_execution_log" TO "authenticated";
GRANT ALL ON TABLE "public"."job_execution_log" TO "service_role";



GRANT ALL ON TABLE "public"."league_players" TO "anon";
GRANT ALL ON TABLE "public"."league_players" TO "authenticated";
GRANT ALL ON TABLE "public"."league_players" TO "service_role";



GRANT ALL ON TABLE "public"."leagues" TO "anon";
GRANT ALL ON TABLE "public"."leagues" TO "authenticated";
GRANT ALL ON TABLE "public"."leagues" TO "service_role";



GRANT ALL ON TABLE "public"."match_caterings" TO "anon";
GRANT ALL ON TABLE "public"."match_caterings" TO "authenticated";
GRANT ALL ON TABLE "public"."match_caterings" TO "service_role";



GRANT ALL ON TABLE "public"."match_days" TO "anon";
GRANT ALL ON TABLE "public"."match_days" TO "authenticated";
GRANT ALL ON TABLE "public"."match_days" TO "service_role";



GRANT ALL ON TABLE "public"."match_results" TO "anon";
GRANT ALL ON TABLE "public"."match_results" TO "authenticated";
GRANT ALL ON TABLE "public"."match_results" TO "service_role";



GRANT ALL ON TABLE "public"."matchday_reminder_logs" TO "anon";
GRANT ALL ON TABLE "public"."matchday_reminder_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."matchday_reminder_logs" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_invitations" TO "anon";
GRANT ALL ON TABLE "public"."meeting_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."member_balance_entries" TO "anon";
GRANT ALL ON TABLE "public"."member_balance_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."member_balance_entries" TO "service_role";



GRANT ALL ON TABLE "public"."member_balances" TO "anon";
GRANT ALL ON TABLE "public"."member_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."member_balances" TO "service_role";



GRANT ALL ON TABLE "public"."member_booking_preferences" TO "anon";
GRANT ALL ON TABLE "public"."member_booking_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."member_booking_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."member_meetings" TO "anon";
GRANT ALL ON TABLE "public"."member_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."member_meetings" TO "service_role";



GRANT ALL ON TABLE "public"."member_schedule_preferences" TO "anon";
GRANT ALL ON TABLE "public"."member_schedule_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."member_schedule_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."news_comments" TO "anon";
GRANT ALL ON TABLE "public"."news_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."news_comments" TO "service_role";



GRANT ALL ON TABLE "public"."news_posts" TO "anon";
GRANT ALL ON TABLE "public"."news_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."news_posts" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_send_logs" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_send_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_send_logs" TO "service_role";



GRANT ALL ON TABLE "public"."notification_consents" TO "anon";
GRANT ALL ON TABLE "public"."notification_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_consents" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."nuliga_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."nuliga_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."nuliga_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."open_match_participants" TO "anon";
GRANT ALL ON TABLE "public"."open_match_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."open_match_participants" TO "service_role";



GRANT ALL ON TABLE "public"."open_matches" TO "anon";
GRANT ALL ON TABLE "public"."open_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."open_matches" TO "service_role";



GRANT ALL ON TABLE "public"."payment_settings" TO "anon";
GRANT ALL ON TABLE "public"."payment_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_settings" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."planning_conflicts" TO "anon";
GRANT ALL ON TABLE "public"."planning_conflicts" TO "authenticated";
GRANT ALL ON TABLE "public"."planning_conflicts" TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_rules" TO "anon";
GRANT ALL ON TABLE "public"."pricing_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_rules" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."qr_checkins" TO "anon";
GRANT ALL ON TABLE "public"."qr_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."qr_checkins" TO "service_role";



GRANT ALL ON TABLE "public"."rate_history" TO "anon";
GRANT ALL ON TABLE "public"."rate_history" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_history" TO "service_role";



GRANT ALL ON TABLE "public"."registration_requests" TO "anon";
GRANT ALL ON TABLE "public"."registration_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."registration_requests" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."schema_migrations" TO "anon";
GRANT ALL ON TABLE "public"."schema_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."schema_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."school_holidays" TO "anon";
GRANT ALL ON TABLE "public"."school_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."school_holidays" TO "service_role";



GRANT ALL ON TABLE "public"."season_billing_configs" TO "anon";
GRANT ALL ON TABLE "public"."season_billing_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."season_billing_configs" TO "service_role";



GRANT ALL ON TABLE "public"."season_group_weeks" TO "anon";
GRANT ALL ON TABLE "public"."season_group_weeks" TO "authenticated";
GRANT ALL ON TABLE "public"."season_group_weeks" TO "service_role";



GRANT ALL ON TABLE "public"."season_plan_entries" TO "anon";
GRANT ALL ON TABLE "public"."season_plan_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."season_plan_entries" TO "service_role";



GRANT ALL ON TABLE "public"."season_plan_versions" TO "anon";
GRANT ALL ON TABLE "public"."season_plan_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."season_plan_versions" TO "service_role";



GRANT ALL ON TABLE "public"."season_planning_configs" TO "anon";
GRANT ALL ON TABLE "public"."season_planning_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."season_planning_configs" TO "service_role";



GRANT ALL ON TABLE "public"."season_planning_history" TO "anon";
GRANT ALL ON TABLE "public"."season_planning_history" TO "authenticated";
GRANT ALL ON TABLE "public"."season_planning_history" TO "service_role";



GRANT ALL ON TABLE "public"."season_statistics" TO "anon";
GRANT ALL ON TABLE "public"."season_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."season_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."season_waitlists" TO "anon";
GRANT ALL ON TABLE "public"."season_waitlists" TO "authenticated";
GRANT ALL ON TABLE "public"."season_waitlists" TO "service_role";



GRANT ALL ON TABLE "public"."seasons" TO "anon";
GRANT ALL ON TABLE "public"."seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."seasons" TO "service_role";



GRANT ALL ON TABLE "public"."session_rsvps" TO "anon";
GRANT ALL ON TABLE "public"."session_rsvps" TO "authenticated";
GRANT ALL ON TABLE "public"."session_rsvps" TO "service_role";



GRANT ALL ON TABLE "public"."session_waitlist" TO "anon";
GRANT ALL ON TABLE "public"."session_waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."session_waitlist" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."shop_orders" TO "anon";
GRANT ALL ON TABLE "public"."shop_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_orders" TO "service_role";



GRANT ALL ON TABLE "public"."shop_products" TO "anon";
GRANT ALL ON TABLE "public"."shop_products" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_products" TO "service_role";



GRANT ALL ON TABLE "public"."special_event_registrations" TO "anon";
GRANT ALL ON TABLE "public"."special_event_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."special_event_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."special_events" TO "anon";
GRANT ALL ON TABLE "public"."special_events" TO "authenticated";
GRANT ALL ON TABLE "public"."special_events" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_events" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_matches" TO "anon";
GRANT ALL ON TABLE "public"."tournament_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_matches" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_registrations" TO "anon";
GRANT ALL ON TABLE "public"."tournament_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."tournaments" TO "anon";
GRANT ALL ON TABLE "public"."tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_absences" TO "anon";
GRANT ALL ON TABLE "public"."trainer_absences" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_absences" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_assignments" TO "anon";
GRANT ALL ON TABLE "public"."trainer_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_availabilities" TO "anon";
GRANT ALL ON TABLE "public"."trainer_availabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_availabilities" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_billings" TO "anon";
GRANT ALL ON TABLE "public"."trainer_billings" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_billings" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_club" TO "anon";
GRANT ALL ON TABLE "public"."trainer_club" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_club" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_feedback" TO "anon";
GRANT ALL ON TABLE "public"."trainer_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_hourly_rates" TO "anon";
GRANT ALL ON TABLE "public"."trainer_hourly_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_hourly_rates" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_member_notes" TO "anon";
GRANT ALL ON TABLE "public"."trainer_member_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_member_notes" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_rating_summary" TO "anon";
GRANT ALL ON TABLE "public"."trainer_rating_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_rating_summary" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_slot_waitlist" TO "anon";
GRANT ALL ON TABLE "public"."trainer_slot_waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_slot_waitlist" TO "service_role";



GRANT ALL ON TABLE "public"."training_group_memberships" TO "anon";
GRANT ALL ON TABLE "public"."training_group_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."training_group_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."training_groups" TO "anon";
GRANT ALL ON TABLE "public"."training_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."training_groups" TO "service_role";



GRANT ALL ON TABLE "public"."user_club_memberships" TO "anon";
GRANT ALL ON TABLE "public"."user_club_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."user_club_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."user_dashboard_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_dashboard_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_dashboard_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_training_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_training_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_training_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist_entries" TO "anon";
GRANT ALL ON TABLE "public"."waitlist_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist_entries" TO "service_role";



GRANT ALL ON TABLE "public"."work_duties" TO "anon";
GRANT ALL ON TABLE "public"."work_duties" TO "authenticated";
GRANT ALL ON TABLE "public"."work_duties" TO "service_role";



GRANT ALL ON TABLE "public"."work_duty_assignments" TO "anon";
GRANT ALL ON TABLE "public"."work_duty_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."work_duty_assignments" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































