-- ─── #6 Credit Balance Limits ────────────────────────────────────────────────
-- Updates debit_user_credits to enforce the credit_line from
-- merchant_credit_profiles instead of blocking at zero.
--
-- New merchant:         credit_line = 500  → balance can go down to –500
-- Established merchant: admin sets 2000   → balance can go down to –2000

-- ── 1. Update debit_user_credits to enforce credit limit ─────────────────────
CREATE OR REPLACE FUNCTION debit_user_credits(
  p_user_id UUID,
  p_amount  DECIMAL
)
RETURNS VOID AS $$
DECLARE
  v_current_balance DECIMAL;
  v_credit_line     DECIMAL;
BEGIN
  -- Get current balance with row lock
  SELECT available_credits INTO v_current_balance
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits not found for user_id: %', p_user_id;
  END IF;

  -- Get merchant credit limit (default 500 if no profile yet)
  SELECT COALESCE(credit_line, 500) INTO v_credit_line
  FROM public.merchant_credit_profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    v_credit_line := 500;
  END IF;

  -- Balance after debit must not go below –credit_line
  IF (v_current_balance - p_amount) < -v_credit_line THEN
    RAISE EXCEPTION
      'Credit limit exceeded. Current balance: %, Amount: %, Credit limit: –%',
      v_current_balance, p_amount, v_credit_line;
  END IF;

  -- Debit the amount
  UPDATE public.user_credits
  SET
    available_credits = available_credits - p_amount,
    spent_credits     = COALESCE(spent_credits, 0) + p_amount,
    updated_at        = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- ── 2. Auto-create credit profile when merchant is approved ──────────────────
CREATE OR REPLACE FUNCTION public.fn_create_credit_profile_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    INSERT INTO public.merchant_credit_profiles (user_id, credit_line, risk_score)
    VALUES (NEW.user_id, 500, 'low')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_credit_profile_on_approval ON public.businesses;
CREATE TRIGGER trg_create_credit_profile_on_approval
  AFTER UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.fn_create_credit_profile_on_approval();
