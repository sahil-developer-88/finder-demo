-- ─── Admin Batch Issue Credits ────────────────────────────────────────────────
-- Issues credits to multiple users in a single call.
-- p_entries: JSONB array of {user_id, amount} objects
-- p_reason:  reason code applied to every entry
-- Returns a summary of how many succeeded / failed.

CREATE OR REPLACE FUNCTION admin_batch_issue_credits(
  p_entries JSONB,
  p_reason  TEXT,
  p_notes   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id   UUID    := auth.uid();
  v_entry      JSONB;
  v_user_id    UUID;
  v_amount     NUMERIC;
  v_old_bal    NUMERIC := 0;
  v_new_bal    NUMERIC;
  v_old_earned NUMERIC := 0;
  v_success    INT     := 0;
  v_failed     INT     := 0;
  v_errors     JSONB   := '[]'::JSONB;
BEGIN
  -- Admin check
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    BEGIN
      v_user_id := (v_entry->>'user_id')::UUID;
      v_amount  := (v_entry->>'amount')::NUMERIC;

      IF v_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
      END IF;

      -- Get current balance
      SELECT available_credits, COALESCE(earned_credits, 0)
        INTO v_old_bal, v_old_earned
      FROM public.user_credits
      WHERE user_id = v_user_id;

      v_new_bal := COALESCE(v_old_bal, 0) + v_amount;

      -- Upsert credits
      INSERT INTO public.user_credits (user_id, available_credits, earned_credits, spent_credits)
      VALUES (v_user_id, v_new_bal, COALESCE(v_old_earned, 0) + v_amount, 0)
      ON CONFLICT (user_id) DO UPDATE
        SET available_credits = v_new_bal,
            earned_credits    = COALESCE(user_credits.earned_credits, 0) + v_amount,
            updated_at        = NOW();

      -- Ledger entry
      INSERT INTO public.ledger_entries
        (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description,
         balance_before, balance_after)
      VALUES
        (v_user_id, 'credit', 0, v_amount, 'admin', v_admin_id::text,
         'Batch credit: ' || p_reason
           || CASE WHEN p_notes IS NOT NULL AND p_notes <> '' THEN ' — ' || p_notes ELSE '' END
           || ' (admin: ' || v_admin_id::text || ')',
         COALESCE(v_old_bal, 0), v_new_bal);

      -- Audit log
      INSERT INTO public.audit_logs
        (user_id, admin_id, action, table_name, record_id, old_data, new_data, reason, section)
      VALUES (
        v_admin_id, v_admin_id,
        'credit_adjustment', 'user_credits', v_user_id,
        jsonb_build_object('available_credits', COALESCE(v_old_bal, 0)),
        jsonb_build_object('available_credits', v_new_bal, 'batch', true, 'notes', p_notes),
        p_reason,
        'Exchange Ledger > Adjustments > Batch'
      );

      v_success := v_success + 1;

    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'user_id', v_entry->>'user_id',
        'error',   SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', v_success,
    'failed',  v_failed,
    'errors',  v_errors
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_batch_issue_credits(JSONB, TEXT, TEXT) TO authenticated;
