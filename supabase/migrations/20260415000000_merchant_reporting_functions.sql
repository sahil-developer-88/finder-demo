-- ─── Merchant Reporting Functions ────────────────────────────────────────────
-- Adds date-range summary and yearly barter earnings for reporting & CSV export.

-- ── 1. merchant_get_summary_range ────────────────────────────────────────────
-- Returns daily totals for a specific date range (used for monthly view).
CREATE OR REPLACE FUNCTION merchant_get_summary_range(
  p_start DATE,
  p_end   DATE
)
RETURNS TABLE (
  summary_date  DATE,
  total_sales   NUMERIC,
  barter_amount NUMERIC,
  cash_amount   NUMERIC,
  tx_count      BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(pt.transaction_date)               AS summary_date,
    SUM(pt.total_amount)                    AS total_sales,
    SUM(pt.barter_amount)                   AS barter_amount,
    SUM(pt.total_amount - pt.barter_amount) AS cash_amount,
    COUNT(*)                                AS tx_count
  FROM pos_transactions pt
  WHERE pt.merchant_id = auth.uid()
    AND DATE(pt.transaction_date) >= p_start
    AND DATE(pt.transaction_date) <= p_end
    AND pt.status IN ('completed', 'pending')
  GROUP BY DATE(pt.transaction_date)
  ORDER BY summary_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION merchant_get_summary_range(DATE, DATE) TO authenticated;

-- ── 2. merchant_get_yearly_barter_earnings ────────────────────────────────────
-- Returns monthly barter credits earned vs spent for a given year.
-- Used for Analytics monthly earnings breakdown and year-end report.
CREATE OR REPLACE FUNCTION merchant_get_yearly_barter_earnings(
  p_year INT DEFAULT NULL
)
RETURNS TABLE (
  month_label TEXT,
  month_num   INT,
  earned      NUMERIC,
  spent       NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT;
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM NOW())::INT);

  RETURN QUERY
  SELECT
    TO_CHAR(DATE_TRUNC('month', le.created_at), 'Mon YYYY')        AS month_label,
    EXTRACT(MONTH FROM le.created_at)::INT                         AS month_num,
    COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.barter_amount ELSE 0 END), 0) AS earned,
    COALESCE(SUM(CASE WHEN le.entry_type = 'debit'  THEN le.barter_amount ELSE 0 END), 0) AS spent
  FROM public.ledger_entries le
  WHERE le.user_id = auth.uid()
    AND EXTRACT(YEAR FROM le.created_at) = v_year
  GROUP BY DATE_TRUNC('month', le.created_at), EXTRACT(MONTH FROM le.created_at)
  ORDER BY month_num;
END;
$$;

GRANT EXECUTE ON FUNCTION merchant_get_yearly_barter_earnings(INT) TO authenticated;
