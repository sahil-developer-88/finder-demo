-- ─── Fix #3: Write-offs now post to ledger_entries ───────────────────────────
-- Previously handleWriteOff directly set available_credits = 0 with no ledger
-- entry and no audit log. This creates a dedicated RPC that:
--   1. Creates an immutable ledger credit entry (zeroing the negative balance)
--   2. Writes an audit log row with reason = 'write_off' and correct section
--   3. Updates user_credits last (ledger is written first)

CREATE OR REPLACE FUNCTION public.admin_write_off_credits(
  p_target_user_id UUID,
  p_reason         TEXT DEFAULT 'Write-off approved by admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id    UUID    := auth.uid();
  v_old_balance DECIMAL := 0;
BEGIN
  -- Admin only
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Get current balance
  SELECT available_credits
    INTO v_old_balance
    FROM public.user_credits
   WHERE user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No credit record found for user';
  END IF;

  -- Only write off negative balances
  IF v_old_balance >= 0 THEN
    RAISE EXCEPTION 'Balance is not negative (current: %). Nothing to write off.', v_old_balance;
  END IF;

  -- 1. Immutable ledger entry — credit to bring balance to zero
  INSERT INTO public.ledger_entries
    (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description)
  VALUES
    (p_target_user_id,
     'credit',
     0,
     ABS(v_old_balance),   -- exact amount being forgiven
     'admin',
     v_admin_id::text,
     'Write-off: ' || p_reason || ' (admin: ' || v_admin_id::text || ')');

  -- 2. Update user_credits to zero
  UPDATE public.user_credits
  SET available_credits = 0,
      updated_at        = now()
  WHERE user_id = p_target_user_id;

  -- 3. Audit log with reason = 'write_off' (matches existing write-off filter)
  INSERT INTO public.audit_logs
    (user_id, admin_id, action, table_name, record_id, old_data, new_data, reason, section)
  VALUES (
    v_admin_id,
    v_admin_id,
    'credit_adjustment',
    'user_credits',
    p_target_user_id,
    jsonb_build_object('available_credits', v_old_balance),
    jsonb_build_object('available_credits', 0),
    'write_off',
    'Exchange Ledger > Write-offs'
  );

  RETURN jsonb_build_object(
    'old_balance',    v_old_balance,
    'new_balance',    0,
    'amount_written', ABS(v_old_balance)
  );
END;
$$;
