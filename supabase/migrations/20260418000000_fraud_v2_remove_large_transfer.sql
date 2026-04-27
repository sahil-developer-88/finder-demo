-- Fraud V2: Remove large_transfer signal (legitimate purchases flagged incorrectly)
-- Keep only: repeated_pair_trading + rapid_sending

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
  -- Same two users traded ≥ 5 times in 30 days (wash trading)
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
    WHERE user_id = rec.uid;

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
      'signal',     'repeated_pair_trading',
      'user_id',    rec.uid,
      'partner_id', rec.to_user_id,
      'tx_count',   rec.pair_count
    );
  END LOOP;

  -- ── 2. Rapid sending — ≥ 10 transactions within any 24-hour window ──────────
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

  -- ── 3. Clear stale soft flags ───────────────────────────────────────────────
  UPDATE public.merchant_credit_profiles
  SET
    flag_status  = 'none',
    flag_reasons = '{}',
    flagged_at   = NULL
  WHERE flag_status = 'soft'
    AND user_id NOT IN (
      SELECT DISTINCT from_user_id FROM public.transactions
      WHERE created_at >= v_window_start AND from_user_id IS NOT NULL AND to_user_id IS NOT NULL
      GROUP BY from_user_id, to_user_id HAVING COUNT(*) >= 5
      UNION
      SELECT DISTINCT to_user_id FROM public.transactions
      WHERE created_at >= v_window_start AND to_user_id IS NOT NULL AND from_user_id IS NOT NULL
      GROUP BY from_user_id, to_user_id HAVING COUNT(*) >= 5
      UNION
      SELECT from_user_id FROM public.transactions
      WHERE created_at >= v_window_start AND from_user_id IS NOT NULL
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
