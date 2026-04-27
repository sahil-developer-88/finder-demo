-- ─── #1: Add balance_before / balance_after to ledger_entries ────────────────
-- Every ledger entry now records the user's barter balance immediately before
-- and after the movement, giving a complete point-in-time audit trail.
-- Columns are nullable so all existing rows remain valid (show as NULL / —).

ALTER TABLE public.ledger_entries
  ADD COLUMN IF NOT EXISTS balance_before numeric(12,2),
  ADD COLUMN IF NOT EXISTS balance_after  numeric(12,2);

-- ─── Update admin_adjust_credits ─────────────────────────────────────────────
-- v_old_balance / v_new_balance are already in scope — just pass them through.
CREATE OR REPLACE FUNCTION admin_adjust_credits(
  p_target_user_id  UUID,
  p_delta           DECIMAL,
  p_reason          TEXT,
  p_notes           TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id      UUID := auth.uid();
  v_old_balance   DECIMAL := 0;
  v_old_earned    DECIMAL := 0;
  v_new_balance   DECIMAL;
  v_new_earned    DECIMAL;
  v_entry_type    TEXT;
  v_description   TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT available_credits, earned_credits
    INTO v_old_balance, v_old_earned
    FROM public.user_credits
   WHERE user_id = p_target_user_id;

  v_new_balance := COALESCE(v_old_balance, 0) + p_delta;
  v_new_earned  := CASE WHEN p_delta > 0
                        THEN COALESCE(v_old_earned, 0) + p_delta
                        ELSE COALESCE(v_old_earned, 0)
                   END;

  INSERT INTO public.user_credits (user_id, available_credits, earned_credits, spent_credits)
  VALUES (p_target_user_id, v_new_balance, v_new_earned, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_credits = v_new_balance,
        earned_credits    = v_new_earned,
        updated_at        = now();

  v_entry_type  := CASE WHEN p_delta >= 0 THEN 'credit' ELSE 'debit' END;
  v_description := 'Admin adjustment: ' || p_reason
                   || ' (admin: ' || v_admin_id::text || ')'
                   || CASE WHEN p_notes IS NOT NULL AND p_notes <> ''
                            THEN ' — ' || p_notes ELSE '' END;

  INSERT INTO public.ledger_entries
    (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description,
     balance_before, balance_after)
  VALUES
    (p_target_user_id, v_entry_type, 0, ABS(p_delta), 'admin', v_admin_id::text, v_description,
     COALESCE(v_old_balance, 0), v_new_balance);

  INSERT INTO public.audit_logs
    (user_id, admin_id, action, table_name, record_id, old_data, new_data, reason, section)
  VALUES (
    v_admin_id, v_admin_id,
    'credit_adjustment', 'user_credits', p_target_user_id,
    jsonb_build_object('available_credits', v_old_balance),
    jsonb_build_object('available_credits', v_new_balance, 'notes', p_notes),
    p_reason,
    'Exchange Ledger > Adjustments'
  );

  RETURN jsonb_build_object(
    'old_balance', v_old_balance,
    'new_balance', v_new_balance,
    'delta',       p_delta
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Update admin_write_off_credits ──────────────────────────────────────────
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
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT available_credits
    INTO v_old_balance
    FROM public.user_credits
   WHERE user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No credit record found for user';
  END IF;

  IF v_old_balance >= 0 THEN
    RAISE EXCEPTION 'Balance is not negative (current: %). Nothing to write off.', v_old_balance;
  END IF;

  INSERT INTO public.ledger_entries
    (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description,
     balance_before, balance_after)
  VALUES
    (p_target_user_id,
     'credit',
     0,
     ABS(v_old_balance),
     'admin',
     v_admin_id::text,
     'Write-off: ' || p_reason || ' (admin: ' || v_admin_id::text || ')',
     v_old_balance,   -- negative balance before
     0);              -- zeroed after write-off

  UPDATE public.user_credits
  SET available_credits = 0,
      updated_at        = now()
  WHERE user_id = p_target_user_id;

  INSERT INTO public.audit_logs
    (user_id, admin_id, action, table_name, record_id, old_data, new_data, reason, section)
  VALUES (
    v_admin_id, v_admin_id,
    'credit_adjustment', 'user_credits', p_target_user_id,
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

-- ─── Update trigger: transactions → ledger_entries ───────────────────────────
CREATE OR REPLACE FUNCTION public.fn_ledger_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barter_amt      numeric(12,2);
  v_source          text;
  v_from_balance    numeric(12,2) := 0;
  v_to_balance      numeric(12,2) := 0;
BEGIN
  IF NEW.status != 'completed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;

  v_barter_amt := COALESCE(NEW.points_amount, 0);

  v_source := CASE NEW.transaction_type
    WHEN 'payment_request' THEN 'payment_request'
    WHEN 'pos_scan'        THEN 'qr_scan'
    ELSE                        'trade'
  END;

  -- Look up current balances (these are the balances after the transaction)
  SELECT COALESCE(available_credits, 0) INTO v_from_balance
    FROM public.user_credits WHERE user_id = NEW.from_user_id;
  SELECT COALESCE(available_credits, 0) INTO v_to_balance
    FROM public.user_credits WHERE user_id = NEW.to_user_id;

  -- DEBIT for payer: balance_after = current, balance_before = current + amount
  INSERT INTO public.ledger_entries
    (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description,
     balance_before, balance_after)
  VALUES
    (NEW.from_user_id, 'debit', 0, v_barter_amt, v_source, NEW.id::text,
     COALESCE(NEW.service_description, 'Barter transaction'),
     v_from_balance + v_barter_amt,   -- before (add back what was debited)
     v_from_balance);                 -- after

  -- CREDIT for receiver: balance_after = current, balance_before = current - amount
  INSERT INTO public.ledger_entries
    (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description,
     balance_before, balance_after)
  VALUES
    (NEW.to_user_id, 'credit', 0, v_barter_amt, v_source, NEW.id::text,
     COALESCE(NEW.service_description, 'Barter transaction'),
     v_to_balance - v_barter_amt,   -- before (subtract what was credited)
     v_to_balance);                 -- after

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_on_transaction ON public.transactions;
CREATE TRIGGER trg_ledger_on_transaction
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_on_transaction();

-- ─── Update trigger: pos_transactions → ledger_entries ───────────────────────
CREATE OR REPLACE FUNCTION public.fn_ledger_on_pos_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barter_amt    numeric(12,2);
  v_merch_balance numeric(12,2) := 0;
BEGIN
  IF NEW.status != 'completed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;

  v_barter_amt := COALESCE(NEW.barter_amount, 0);

  SELECT COALESCE(available_credits, 0) INTO v_merch_balance
    FROM public.user_credits WHERE user_id = NEW.merchant_id;

  INSERT INTO public.ledger_entries
    (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description,
     balance_before, balance_after)
  VALUES
    (NEW.merchant_id, 'credit',
     COALESCE(NEW.cash_amount, 0),
     v_barter_amt,
     'pos',
     NEW.id::text,
     'POS Sale - ' || COALESCE(NEW.pos_provider, 'POS'),
     v_merch_balance - v_barter_amt,   -- before credit
     v_merch_balance);                 -- after credit

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_on_pos_transaction ON public.pos_transactions;
CREATE TRIGGER trg_ledger_on_pos_transaction
  AFTER INSERT OR UPDATE ON public.pos_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_on_pos_transaction();

-- ─── Update trigger: orders → ledger_entries ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_ledger_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barter_amt    numeric(12,2);
  v_buyer_balance numeric(12,2) := 0;
BEGIN
  IF NEW.status NOT IN ('confirmed', 'completed', 'fulfilled') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('confirmed', 'completed', 'fulfilled') THEN RETURN NEW; END IF;

  v_barter_amt := COALESCE(NEW.barter_amount, 0);

  IF NEW.user_id IS NOT NULL THEN
    SELECT COALESCE(available_credits, 0) INTO v_buyer_balance
      FROM public.user_credits WHERE user_id = NEW.user_id;

    INSERT INTO public.ledger_entries
      (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description,
       balance_before, balance_after)
    VALUES
      (NEW.user_id, 'debit',
       COALESCE(NEW.cash_amount, 0),
       v_barter_amt,
       'checkout',
       NEW.id::text,
       'Order #' || COALESCE(NEW.order_number::text, NEW.id::text),
       v_buyer_balance + v_barter_amt,   -- before debit
       v_buyer_balance);                 -- after debit
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_on_order ON public.orders;
CREATE TRIGGER trg_ledger_on_order
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_on_order();
