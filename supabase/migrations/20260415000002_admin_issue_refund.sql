-- ─── Admin Issue Refund ────────────────────────────────────────────────────────
-- Allows admins to reverse a completed transaction:
--   • Updates transaction status → 'refunded'
--   • Posts reverse ledger entries (debit receiver, credit payer)
--   • Updates user_credits balances accordingly
--   • Writes to audit_logs

CREATE OR REPLACE FUNCTION admin_issue_refund(
  p_tx_id   UUID,
  p_tx_type TEXT,          -- 'pos' | 'barter'
  p_reason  TEXT DEFAULT 'Admin refund'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id       UUID    := auth.uid();

  -- POS fields
  v_merch_id       UUID;
  v_cust_id        UUID;
  v_barter_amt     NUMERIC(12,2);
  v_cash_amt       NUMERIC(12,2);

  -- Barter fields
  v_from_user_id   UUID;
  v_to_user_id     UUID;
  v_points_amt     NUMERIC(12,2);

  -- Balance snapshots
  v_merch_bal      NUMERIC(12,2) := 0;
  v_cust_bal       NUMERIC(12,2) := 0;
  v_from_bal       NUMERIC(12,2) := 0;
  v_to_bal         NUMERIC(12,2) := 0;
BEGIN
  -- Admin check
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF p_tx_type = 'pos' THEN
    -- ── POS refund ──────────────────────────────────────────────────────────────
    SELECT merchant_id, customer_id,
           COALESCE(barter_amount, 0), COALESCE(cash_amount, 0)
      INTO v_merch_id, v_cust_id, v_barter_amt, v_cash_amt
    FROM public.pos_transactions
    WHERE id = p_tx_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POS transaction not found: %', p_tx_id;
    END IF;

    -- Mark as refunded
    UPDATE public.pos_transactions
    SET status = 'refunded', updated_at = NOW()
    WHERE id = p_tx_id AND status = 'completed';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transaction % is not in completed status', p_tx_id;
    END IF;

    -- Snapshot balances
    SELECT COALESCE(available_credits, 0) INTO v_merch_bal
      FROM public.user_credits WHERE user_id = v_merch_id;

    -- Debit ledger entry for merchant (reverses their original credit)
    INSERT INTO public.ledger_entries
      (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description,
       balance_before, balance_after)
    VALUES
      (v_merch_id, 'debit', v_cash_amt, v_barter_amt, 'refund', p_tx_id::text,
       'Refund reversal: ' || p_reason || ' (admin: ' || v_admin_id::text || ')',
       v_merch_bal, v_merch_bal - v_barter_amt);

    -- Update merchant balance
    UPDATE public.user_credits
    SET available_credits = available_credits - v_barter_amt, updated_at = NOW()
    WHERE user_id = v_merch_id;

    -- Credit ledger entry for customer (reverses their original debit)
    IF v_cust_id IS NOT NULL AND v_barter_amt > 0 THEN
      SELECT COALESCE(available_credits, 0) INTO v_cust_bal
        FROM public.user_credits WHERE user_id = v_cust_id;

      INSERT INTO public.ledger_entries
        (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description,
         balance_before, balance_after)
      VALUES
        (v_cust_id, 'credit', 0, v_barter_amt, 'refund', p_tx_id::text,
         'Refund credit: ' || p_reason || ' (admin: ' || v_admin_id::text || ')',
         v_cust_bal, v_cust_bal + v_barter_amt);

      UPDATE public.user_credits
      SET available_credits = available_credits + v_barter_amt, updated_at = NOW()
      WHERE user_id = v_cust_id;
    END IF;

  ELSIF p_tx_type = 'barter' THEN
    -- ── Barter refund ───────────────────────────────────────────────────────────
    SELECT from_user_id, to_user_id, COALESCE(points_amount, 0)
      INTO v_from_user_id, v_to_user_id, v_points_amt
    FROM public.transactions
    WHERE id = p_tx_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Barter transaction not found: %', p_tx_id;
    END IF;

    UPDATE public.transactions
    SET status = 'refunded', updated_at = NOW()
    WHERE id = p_tx_id AND status = 'completed';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transaction % is not in completed status', p_tx_id;
    END IF;

    -- Snapshot balances
    SELECT COALESCE(available_credits, 0) INTO v_from_bal
      FROM public.user_credits WHERE user_id = v_from_user_id;
    SELECT COALESCE(available_credits, 0) INTO v_to_bal
      FROM public.user_credits WHERE user_id = v_to_user_id;

    -- Credit from_user (reverses their original debit)
    INSERT INTO public.ledger_entries
      (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description,
       balance_before, balance_after)
    VALUES
      (v_from_user_id, 'credit', 0, v_points_amt, 'refund', p_tx_id::text,
       'Refund credit: ' || p_reason || ' (admin: ' || v_admin_id::text || ')',
       v_from_bal, v_from_bal + v_points_amt);

    UPDATE public.user_credits
    SET available_credits = available_credits + v_points_amt, updated_at = NOW()
    WHERE user_id = v_from_user_id;

    -- Debit to_user (reverses their original credit)
    INSERT INTO public.ledger_entries
      (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description,
       balance_before, balance_after)
    VALUES
      (v_to_user_id, 'debit', 0, v_points_amt, 'refund', p_tx_id::text,
       'Refund debit: ' || p_reason || ' (admin: ' || v_admin_id::text || ')',
       v_to_bal, v_to_bal - v_points_amt);

    UPDATE public.user_credits
    SET available_credits = available_credits - v_points_amt, updated_at = NOW()
    WHERE user_id = v_to_user_id;

  ELSE
    RAISE EXCEPTION 'Unknown transaction type: %', p_tx_type;
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs
    (user_id, admin_id, action, table_name, record_id, old_data, new_data, reason, section)
  VALUES (
    v_admin_id, v_admin_id,
    'refund_issued',
    CASE p_tx_type WHEN 'pos' THEN 'pos_transactions' ELSE 'transactions' END,
    p_tx_id,
    jsonb_build_object('status', 'completed'),
    jsonb_build_object('status', 'refunded', 'reason', p_reason),
    p_reason,
    'Transaction Monitor > Transactions'
  );

  RETURN jsonb_build_object('success', true, 'tx_id', p_tx_id, 'tx_type', p_tx_type);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_issue_refund(UUID, TEXT, TEXT) TO authenticated;
