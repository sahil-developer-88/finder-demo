-- RPC for admin to adjust any user's credits, bypassing RLS
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

  -- Get current balance (default 0 if no row yet)
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
