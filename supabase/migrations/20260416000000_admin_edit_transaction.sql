-- ─── Admin Edit Transaction ────────────────────────────────────────────────────
-- Edits a POS or barter transaction and adjusts the merchant's wallet balance.
-- Runs as SECURITY DEFINER to bypass RLS on user_credits.
--
-- p_tx_id   : transaction UUID
-- p_tx_type : 'pos' | 'barter'
-- p_fields  : JSONB with fields to update (only provided fields are applied)
--   POS fields:    status, total_amount, barter_amount, cash_amount, barter_percentage
--   Barter fields: status, points_amount, service_description

CREATE OR REPLACE FUNCTION admin_edit_transaction(
  p_tx_id   UUID,
  p_tx_type TEXT,
  p_fields  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id      UUID    := auth.uid();
  v_merchant_id   UUID;
  v_old_barter    NUMERIC := 0;
  v_new_barter    NUMERIC := 0;
  v_barter_diff   NUMERIC := 0;
  v_old_balance   NUMERIC := 0;
  v_new_balance   NUMERIC;
BEGIN
  -- Admin check
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF p_tx_type = 'pos' THEN
    -- Get current values
    SELECT merchant_id, COALESCE(barter_amount, 0)
      INTO v_merchant_id, v_old_barter
    FROM public.pos_transactions
    WHERE id = p_tx_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POS transaction not found: %', p_tx_id;
    END IF;

    v_new_barter := COALESCE((p_fields->>'barter_amount')::NUMERIC, v_old_barter);

    -- Update the transaction
    UPDATE public.pos_transactions SET
      status            = COALESCE(p_fields->>'status',            status),
      total_amount      = COALESCE((p_fields->>'total_amount')::NUMERIC,      total_amount),
      barter_amount     = COALESCE((p_fields->>'barter_amount')::NUMERIC,     barter_amount),
      cash_amount       = COALESCE((p_fields->>'cash_amount')::NUMERIC,       cash_amount),
      barter_percentage = COALESCE((p_fields->>'barter_percentage')::NUMERIC, barter_percentage)
    WHERE id = p_tx_id;

  ELSE
    -- Barter transaction: merchant_id = from_user_id (payer)
    SELECT from_user_id, COALESCE(points_amount, 0)
      INTO v_merchant_id, v_old_barter
    FROM public.transactions
    WHERE id = p_tx_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Barter transaction not found: %', p_tx_id;
    END IF;

    v_new_barter := COALESCE((p_fields->>'points_amount')::NUMERIC, v_old_barter);

    -- Update the transaction
    UPDATE public.transactions SET
      status              = COALESCE(p_fields->>'status',              status),
      points_amount       = COALESCE((p_fields->>'points_amount')::NUMERIC, points_amount),
      service_description = COALESCE(p_fields->>'service_description', service_description)
    WHERE id = p_tx_id;
  END IF;

  -- Adjust wallet balance if barter amount changed
  v_barter_diff := v_new_barter - v_old_barter;

  IF v_barter_diff <> 0 AND v_merchant_id IS NOT NULL THEN
    SELECT COALESCE(available_credits, 0)
      INTO v_old_balance
    FROM public.user_credits
    WHERE user_id = v_merchant_id;

    -- POS: merchant receives credits → diff adds to balance
    -- Barter: merchant_id is the payer → diff subtracts from balance
    IF p_tx_type = 'pos' THEN
      v_new_balance := COALESCE(v_old_balance, 0) + v_barter_diff;
    ELSE
      v_new_balance := COALESCE(v_old_balance, 0) - v_barter_diff;
    END IF;

    UPDATE public.user_credits
      SET available_credits = v_new_balance, updated_at = NOW()
    WHERE user_id = v_merchant_id;

    -- Ledger entry for the adjustment
    INSERT INTO public.ledger_entries
      (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description,
       balance_before, balance_after)
    VALUES
      (v_merchant_id,
       CASE WHEN v_barter_diff > 0 THEN 'credit' ELSE 'debit' END,
       0, ABS(v_barter_diff), 'admin', p_tx_id::text,
       'Admin transaction edit — balance adjusted (admin: ' || v_admin_id::text || ')',
       COALESCE(v_old_balance, 0), v_new_balance);
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs
    (user_id, admin_id, action, table_name, record_id, old_data, new_data, reason, section)
  VALUES (
    v_admin_id, v_admin_id,
    'transaction_edit',
    CASE WHEN p_tx_type = 'pos' THEN 'pos_transactions' ELSE 'transactions' END,
    p_tx_id,
    jsonb_build_object('barter_amount', v_old_barter, 'merchant_id', v_merchant_id),
    p_fields || jsonb_build_object('barter_diff', v_barter_diff),
    'admin_edit',
    'Exchange Ledger > All Transactions'
  );

  RETURN jsonb_build_object(
    'ok',           true,
    'merchant_id',  v_merchant_id,
    'old_balance',  v_old_balance,
    'new_balance',  v_new_balance,
    'barter_diff',  v_barter_diff
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_edit_transaction(UUID, TEXT, JSONB) TO authenticated;
