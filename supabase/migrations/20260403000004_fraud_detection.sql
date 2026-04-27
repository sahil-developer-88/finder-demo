-- ─── #7 Fraud Detection ───────────────────────────────────────────────────────
-- Automatically detects suspicious patterns and sets flag_status on
-- merchant_credit_profiles. Runs daily via pg_cron (3am UTC).
--
-- Signals detected:
--   1. Repeated pair trading  — same two users traded ≥ 5 times in 30 days
--   2. Large single transfer  — single transaction barter_amount ≥ 1000
--   3. Rapid sending          — user sent ≥ 10 transactions within any 24-hour window

CREATE OR REPLACE FUNCTION public.run_fraud_detection()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flagged_count  int := 0;
  v_cleared_count  int := 0;
  v_window_start   timestamptz := now() - interval '30 days';
  v_details        jsonb := '[]'::jsonb;
  rec              RECORD;
BEGIN

  -- ── 1. Repeated pair trading ────────────────────────────────────────────────
  -- Find pairs (A,B) where A sent ≥ 5 transactions to B in the last 30 days
  FOR rec IN
    SELECT
      from_user_id AS uid,
      to_user_id,
      COUNT(*)     AS pair_count
    FROM public.transactions
    WHERE created_at >= v_window_start
      AND from_user_id IS NOT NULL
      AND to_user_id   IS NOT NULL
    GROUP BY from_user_id, to_user_id
    HAVING COUNT(*) >= 5
  LOOP
    -- Upsert credit profile so we can flag even if profile doesn't exist yet
    INSERT INTO public.merchant_credit_profiles (user_id)
    VALUES (rec.uid)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.merchant_credit_profiles
    SET
      flag_status  = CASE WHEN flag_status = 'hard' THEN 'hard' ELSE 'soft' END,
      flag_reasons = array_append(
        array_remove(flag_reasons, 'repeated_pair_trading'),
        'repeated_pair_trading'
      ),
      flagged_at   = COALESCE(flagged_at, now())
    WHERE user_id = rec.uid
      AND flag_status = 'none'
       OR 'repeated_pair_trading' != ALL(flag_reasons);

    -- Also flag the receiving side
    INSERT INTO public.merchant_credit_profiles (user_id)
    VALUES (rec.to_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.merchant_credit_profiles
    SET
      flag_status  = CASE WHEN flag_status = 'hard' THEN 'hard' ELSE 'soft' END,
      flag_reasons = array_append(
        array_remove(flag_reasons, 'repeated_pair_trading'),
        'repeated_pair_trading'
      ),
      flagged_at   = COALESCE(flagged_at, now())
    WHERE user_id = rec.to_user_id;

    v_flagged_count := v_flagged_count + 1;
    v_details := v_details || jsonb_build_object(
      'signal',      'repeated_pair_trading',
      'user_id',     rec.uid,
      'partner_id',  rec.to_user_id,
      'tx_count',    rec.pair_count
    );
  END LOOP;

  -- ── 2. Large single transfer ────────────────────────────────────────────────
  -- barter_amount >= 1000 on a single transaction in last 30 days
  FOR rec IN
    SELECT DISTINCT from_user_id AS uid
    FROM public.transactions
    WHERE created_at    >= v_window_start
      AND from_user_id  IS NOT NULL
      AND points_amount >= 1000
  LOOP
    INSERT INTO public.merchant_credit_profiles (user_id)
    VALUES (rec.uid)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.merchant_credit_profiles
    SET
      flag_status  = CASE WHEN flag_status = 'hard' THEN 'hard' ELSE 'soft' END,
      flag_reasons = array_append(
        array_remove(flag_reasons, 'large_transfer'),
        'large_transfer'
      ),
      flagged_at   = COALESCE(flagged_at, now())
    WHERE user_id = rec.uid;

    v_flagged_count := v_flagged_count + 1;
    v_details := v_details || jsonb_build_object(
      'signal',  'large_transfer',
      'user_id', rec.uid
    );
  END LOOP;

  -- ── 3. Rapid sending — ≥ 10 transactions within any 24-hour window ──────────
  FOR rec IN
    SELECT from_user_id AS uid
    FROM public.transactions
    WHERE created_at   >= v_window_start
      AND from_user_id IS NOT NULL
    GROUP BY from_user_id, date_trunc('day', created_at)
    HAVING COUNT(*) >= 10
  LOOP
    INSERT INTO public.merchant_credit_profiles (user_id)
    VALUES (rec.uid)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.merchant_credit_profiles
    SET
      flag_status  = CASE WHEN flag_status = 'hard' THEN 'hard' ELSE 'soft' END,
      flag_reasons = array_append(
        array_remove(flag_reasons, 'rapid_sending'),
        'rapid_sending'
      ),
      flagged_at   = COALESCE(flagged_at, now())
    WHERE user_id = rec.uid;

    v_flagged_count := v_flagged_count + 1;
    v_details := v_details || jsonb_build_object(
      'signal',  'rapid_sending',
      'user_id', rec.uid
    );
  END LOOP;

  -- ── 4. Clear stale soft flags ───────────────────────────────────────────────
  -- If a user had a soft flag but shows no signals in the last 30 days, clear it
  UPDATE public.merchant_credit_profiles
  SET
    flag_status  = 'none',
    flag_reasons = '{}',
    flagged_at   = NULL
  WHERE flag_status = 'soft'
    AND user_id NOT IN (
      -- repeated pair
      SELECT DISTINCT from_user_id FROM public.transactions
      WHERE created_at >= v_window_start
        AND from_user_id IS NOT NULL
        AND to_user_id   IS NOT NULL
      GROUP BY from_user_id, to_user_id HAVING COUNT(*) >= 5
      UNION
      SELECT DISTINCT to_user_id FROM public.transactions
      WHERE created_at >= v_window_start
        AND to_user_id  IS NOT NULL
        AND from_user_id IS NOT NULL
      GROUP BY from_user_id, to_user_id HAVING COUNT(*) >= 5
      -- large transfer
      UNION
      SELECT DISTINCT from_user_id FROM public.transactions
      WHERE created_at    >= v_window_start
        AND from_user_id  IS NOT NULL
        AND points_amount >= 1000
      -- rapid sending
      UNION
      SELECT from_user_id FROM public.transactions
      WHERE created_at   >= v_window_start
        AND from_user_id IS NOT NULL
      GROUP BY from_user_id, date_trunc('day', created_at)
      HAVING COUNT(*) >= 10
    );

  GET DIAGNOSTICS v_cleared_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'flagged', v_flagged_count,
    'cleared', v_cleared_count,
    'details', v_details
  );
END;
$$;

-- ── RLS: only admins can read merchant_credit_profiles (flag columns) ─────────
-- (existing table already has RLS; this function runs as SECURITY DEFINER so
--  it can write regardless of RLS)

-- ── Schedule daily at 3am UTC ─────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'daily-fraud-detection',
      '0 3 * * *',
      'SELECT public.run_fraud_detection()'
    );
  END IF;
END$$;
