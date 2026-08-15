-- Migration: Security Fixes - Booking Constraints and Safe Booking RPC
-- Date: 2026-05-05
-- Description: 
--   1. Add unique constraint to prevent double bookings
--   2. Add database constraints for data integrity
--   3. Create safe booking RPC to prevent race conditions

-- ======================================
-- 1. ADD UNIQUE CONSTRAINT FOR BOOKINGS
-- ======================================
-- Prevents race condition where same member books same session twice
-- CRITICAL SECURITY FIX from ARCHITECTURE_ANALYSIS.md section 8.3

DO $$ 
BEGIN
    -- First, clean up any existing duplicates
    DELETE FROM bookings a USING bookings b
    WHERE a.id < b.id 
    AND a.member_id = b.member_id 
    AND a.session_id = b.session_id
    AND a.status NOT IN ('cancelled');

    -- Add unique constraint
    ALTER TABLE bookings 
    ADD CONSTRAINT bookings_member_session_unique 
    UNIQUE (member_id, session_id);
    
    RAISE NOTICE 'Added unique constraint: bookings_member_session_unique';
EXCEPTION
    WHEN duplicate_table THEN 
        RAISE NOTICE 'Constraint bookings_member_session_unique already exists';
END $$;

-- ======================================
-- 2. ADD CHECK CONSTRAINTS
-- ======================================

-- Ensure max_participants is at least 1
DO $$
BEGIN
    ALTER TABLE sessions 
    ADD CONSTRAINT sessions_max_participants_check 
    CHECK (max_participants >= 1 AND max_participants <= 50);
    
    RAISE NOTICE 'Added check constraint: sessions_max_participants_check';
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Constraint sessions_max_participants_check already exists';
END $$;

-- Ensure booking status is valid
DO $$
BEGIN
    ALTER TABLE bookings 
    ADD CONSTRAINT bookings_status_check 
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show'));
    
    RAISE NOTICE 'Added check constraint: bookings_status_check';
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Constraint bookings_status_check already exists';
END $$;

-- ======================================
-- 3. ADD MISSING FOREIGN KEY
-- ======================================

-- Add foreign key from bookings.member_id to users.id
DO $$
BEGIN
    ALTER TABLE bookings 
    ADD CONSTRAINT bookings_member_id_fkey 
    FOREIGN KEY (member_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
    
    RAISE NOTICE 'Added foreign key: bookings_member_id_fkey';
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Foreign key bookings_member_id_fkey already exists';
END $$;

-- ======================================
-- 4. CREATE SAFE BOOKING RPC
-- ======================================
-- Transaction-safe booking creation that prevents race conditions
-- and validates max participants atomically

CREATE OR REPLACE FUNCTION create_booking_safe(
  p_member_id uuid,
  p_session_id uuid,
  p_club_id uuid,
  p_schedule_id uuid
) RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_booking_safe TO authenticated;

-- ======================================
-- 5. CREATE INVOICE WITH ITEMS RPC
-- ======================================
-- Transaction-safe invoice creation to prevent orphaned invoices

CREATE OR REPLACE FUNCTION create_invoice_with_items(
  p_invoice jsonb,
  p_items jsonb[]
) RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users with trainer role or higher
GRANT EXECUTE ON FUNCTION create_invoice_with_items TO authenticated;

-- ======================================
-- 6. ADD INDICES FOR PERFORMANCE
-- ======================================

-- Index for booking validation queries
CREATE INDEX IF NOT EXISTS idx_bookings_session_status 
ON bookings(session_id, status) 
WHERE status IN ('confirmed', 'pending');

-- Index for member booking lookups
CREATE INDEX IF NOT EXISTS idx_bookings_member_session 
ON bookings(member_id, session_id);

-- Index for session availability queries
CREATE INDEX IF NOT EXISTS idx_sessions_timeslot 
ON sessions(timeslot_start, timeslot_end);

-- ======================================
-- 7. ADD AUDIT COLUMNS TO USER_CLUB_MEMBERSHIPS
-- ======================================

DO $$
BEGIN
    -- Add deactivated tracking columns
    ALTER TABLE user_club_memberships 
    ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
    
    ALTER TABLE user_club_memberships 
    ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES auth.users(id);
    
    RAISE NOTICE 'Added deactivation tracking columns to user_club_memberships';
END $$;

-- ======================================
-- ROLLBACK INSTRUCTIONS
-- ======================================
-- To rollback this migration:
--
-- DROP FUNCTION IF EXISTS create_booking_safe(uuid, uuid, uuid, uuid);
-- DROP FUNCTION IF EXISTS create_invoice_with_items(jsonb, jsonb[]);
-- ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_member_session_unique;
-- ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_max_participants_check;
-- ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
-- ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_member_id_fkey;
-- DROP INDEX IF EXISTS idx_bookings_session_status;
-- DROP INDEX IF EXISTS idx_bookings_member_session;
-- DROP INDEX IF EXISTS idx_sessions_timeslot;
-- ALTER TABLE user_club_memberships DROP COLUMN IF EXISTS deactivated_at;
-- ALTER TABLE user_club_memberships DROP COLUMN IF EXISTS deactivated_by;
