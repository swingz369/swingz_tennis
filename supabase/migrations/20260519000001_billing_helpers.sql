-- Atomic balance entry + increment in a single function
CREATE OR REPLACE FUNCTION add_balance_entry_atomic(
  p_balance_id uuid,
  p_amount numeric,
  p_reason text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  member_balance_id uuid,
  amount numeric,
  reason text,
  reference_type text,
  reference_id uuid,
  created_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Keep the simple increment helper for direct use
CREATE OR REPLACE FUNCTION increment_member_balance(p_balance_id uuid, p_amount numeric)
RETURNS void AS $$
  UPDATE member_balances
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = p_balance_id;
$$ LANGUAGE sql SECURITY DEFINER;
