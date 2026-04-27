-- ─── #4 Audit Trail — add admin_id, reason, section columns ─────────────────
-- Previously audit_logs had no dedicated column for who performed the action,
-- what the reason was (buried in new_data JSON), or where in the admin panel.
-- These columns are nullable so all existing rows remain valid.

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS admin_id  UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reason    TEXT,
  ADD COLUMN IF NOT EXISTS section   TEXT;

-- Index for fast lookups by admin and section
CREATE INDEX IF NOT EXISTS audit_logs_admin_id_idx ON public.audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS audit_logs_section_idx  ON public.audit_logs (section);
CREATE INDEX IF NOT EXISTS audit_logs_reason_idx   ON public.audit_logs (reason);

-- ── Backfill: copy existing user_id into admin_id where action looks admin-driven
-- (credit_adjustment, account_suspended, account_reinstated, listing_* actions)
UPDATE public.audit_logs
SET admin_id = user_id
WHERE action IN (
  'credit_adjustment', 'account_suspended', 'account_reinstated',
  'listing_edited', 'listing_approve', 'listing_reject', 'listing_suspend',
  'listing_remove', 'dispute_resolved', 'dispute_updated'
)
AND admin_id IS NULL;

-- ── Update admin_adjust_credits to populate all 3 new columns ────────────────
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

  -- Ledger entry
  v_entry_type  := CASE WHEN p_delta >= 0 THEN 'credit' ELSE 'debit' END;
  v_description := 'Admin adjustment: ' || p_reason
                   || ' (admin: ' || v_admin_id::text || ')'
                   || CASE WHEN p_notes IS NOT NULL AND p_notes <> ''
                            THEN ' — ' || p_notes ELSE '' END;

  INSERT INTO public.ledger_entries
    (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description)
  VALUES
    (p_target_user_id, v_entry_type, 0, ABS(p_delta), 'admin', v_admin_id::text, v_description);

  -- Audit log — now with admin_id, reason, section
  INSERT INTO public.audit_logs
    (user_id, admin_id, action, table_name, record_id, old_data, new_data, reason, section)
  VALUES (
    v_admin_id,
    v_admin_id,
    'credit_adjustment',
    'user_credits',
    p_target_user_id,
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
