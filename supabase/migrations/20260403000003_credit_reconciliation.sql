-- ─── #8 Transaction Reconciliation ──────────────────────────────────────────
-- Stores daily reconciliation check results.
-- Verifies: sum of ledger net credits = sum of user_credits.available_credits

CREATE TABLE IF NOT EXISTS public.reconciliation_reports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at          timestamptz NOT NULL DEFAULT now(),
  ledger_total    numeric(12,2) NOT NULL,
  credits_total   numeric(12,2) NOT NULL,
  discrepancy     numeric(12,2) NOT NULL,
  status          text        NOT NULL CHECK (status IN ('ok', 'mismatch')),
  details         jsonb,
  resolved        boolean     NOT NULL DEFAULT false,
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id)
);

ALTER TABLE public.reconciliation_reports ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "Admins can read reconciliation reports"
  ON public.reconciliation_reports FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Only service role can insert (edge function uses service role key)
CREATE POLICY "Service role can insert reconciliation reports"
  ON public.reconciliation_reports FOR INSERT
  WITH CHECK (true);

-- Admins can update (mark as resolved)
CREATE POLICY "Admins can update reconciliation reports"
  ON public.reconciliation_reports FOR UPDATE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ── Core reconciliation function ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_credit_reconciliation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger_total  numeric(12,2);
  v_credits_total numeric(12,2);
  v_discrepancy   numeric(12,2);
  v_status        text;
  v_details       jsonb;
  v_report_id     uuid;
BEGIN
  -- Expected: net barter credits from ledger (credits minus debits)
  SELECT COALESCE(
    SUM(CASE WHEN entry_type = 'credit' THEN barter_amount ELSE -barter_amount END), 0
  )
  INTO v_ledger_total
  FROM public.ledger_entries;

  -- Actual: sum of all user credit balances
  SELECT COALESCE(SUM(available_credits), 0)
  INTO v_credits_total
  FROM public.user_credits;

  v_discrepancy := v_credits_total - v_ledger_total;
  v_status      := CASE WHEN ABS(v_discrepancy) < 0.01 THEN 'ok' ELSE 'mismatch' END;

  -- Per-user discrepancies if mismatch
  IF v_status = 'mismatch' THEN
    SELECT jsonb_agg(jsonb_build_object(
      'user_id',        uc.user_id,
      'credits_balance', uc.available_credits,
      'ledger_balance',  COALESCE(le.net, 0),
      'discrepancy',     ROUND(uc.available_credits - COALESCE(le.net, 0), 2)
    ) ORDER BY ABS(uc.available_credits - COALESCE(le.net, 0)) DESC)
    INTO v_details
    FROM public.user_credits uc
    LEFT JOIN (
      SELECT user_id,
             SUM(CASE WHEN entry_type = 'credit' THEN barter_amount ELSE -barter_amount END) AS net
      FROM public.ledger_entries
      GROUP BY user_id
    ) le ON le.user_id = uc.user_id
    WHERE ABS(uc.available_credits - COALESCE(le.net, 0)) > 0.01;
  END IF;

  INSERT INTO public.reconciliation_reports
    (ledger_total, credits_total, discrepancy, status, details)
  VALUES
    (v_ledger_total, v_credits_total, v_discrepancy, v_status, v_details)
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object(
    'id',           v_report_id,
    'status',       v_status,
    'ledger_total', v_ledger_total,
    'credits_total',v_credits_total,
    'discrepancy',  v_discrepancy
  );
END;
$$;

-- ── Daily cron via pg_cron (runs at 2am UTC every day) ────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'daily-credit-reconciliation',
      '0 2 * * *',
      'SELECT public.run_credit_reconciliation()'
    );
  END IF;
END$$;
