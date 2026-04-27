-- ─── Fix #3: No Credit Creation Without Authorization ────────────────────────
--
-- PROBLEM: The existing INSERT policy allows any authenticated user to insert
-- ledger entries for themselves directly from the client. This means a user
-- could fabricate credit entries without going through a real transaction.
--
-- FIX: Drop the permissive INSERT policy. All legitimate inserts come from
-- SECURITY DEFINER triggers (fn_ledger_on_transaction, etc.) which bypass
-- RLS automatically. Regular users and the Supabase client are now blocked.
--
-- Admin adjustments are the only other authorized source — the RPC is already
-- SECURITY DEFINER, so it bypasses RLS too. We also add a ledger entry there
-- so every admin credit change is permanently recorded.

-- ── 1. Drop the broken INSERT policy ─────────────────────────────────────────
DROP POLICY IF EXISTS "Service role can insert ledger entries" ON public.ledger_entries;

-- No replacement needed — SECURITY DEFINER functions bypass RLS and can still
-- insert. Authenticated users can no longer insert directly.

-- ── 2. Add ledger entry to admin_adjust_credits RPC ──────────────────────────
-- Admin adjustments are an authorized source of credit creation (#3).
-- Without this, admin-issued credits are invisible in the ledger.
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
BEGIN
  -- Only allow admin users
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Get current balance
  SELECT available_credits, earned_credits
    INTO v_old_balance, v_old_earned
    FROM public.user_credits
   WHERE user_id = p_target_user_id;

  v_new_balance := COALESCE(v_old_balance, 0) + p_delta;
  v_new_earned  := CASE WHEN p_delta > 0
                        THEN COALESCE(v_old_earned, 0) + p_delta
                        ELSE COALESCE(v_old_earned, 0)
                   END;

  -- Upsert credits row
  INSERT INTO public.user_credits (user_id, available_credits, earned_credits, spent_credits)
  VALUES (p_target_user_id, v_new_balance, v_new_earned, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_credits = v_new_balance,
        earned_credits    = v_new_earned,
        updated_at        = now();

  -- Ledger entry — authorized credit creation via admin adjustment
  INSERT INTO public.ledger_entries (
    user_id, entry_type, barter_amount, cash_amount, source, description
  ) VALUES (
    p_target_user_id,
    CASE WHEN p_delta >= 0 THEN 'credit' ELSE 'debit' END,
    ABS(p_delta),
    0,
    'admin',
    COALESCE(p_reason, 'Admin adjustment') ||
      CASE WHEN p_notes IS NOT NULL THEN ' — ' || p_notes ELSE '' END
  );

  -- Audit log
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, old_data, new_data
  ) VALUES (
    v_admin_id,
    'credit_adjustment',
    'user_credits',
    p_target_user_id,
    jsonb_build_object('available_credits', v_old_balance),
    jsonb_build_object('available_credits', v_new_balance, 'reason', p_reason, 'notes', p_notes)
  );

  RETURN jsonb_build_object(
    'old_balance', v_old_balance,
    'new_balance', v_new_balance,
    'delta',       p_delta
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
