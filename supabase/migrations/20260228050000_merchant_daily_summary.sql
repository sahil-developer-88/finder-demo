-- Migration: Merchant Daily Summary Function
-- Created: 2026-02-28
-- Purpose: Aggregate daily pos_transactions totals for merchant dashboard

CREATE OR REPLACE FUNCTION merchant_get_daily_summary(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  summary_date DATE,
  total_sales    NUMERIC,
  barter_amount  NUMERIC,
  cash_amount    NUMERIC,
  tx_count       BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(pt.transaction_date)              AS summary_date,
    SUM(pt.total_amount)                   AS total_sales,
    SUM(pt.barter_amount)                  AS barter_amount,
    SUM(pt.total_amount - pt.barter_amount) AS cash_amount,
    COUNT(*)                               AS tx_count
  FROM pos_transactions pt
  WHERE pt.merchant_id = auth.uid()
    AND pt.transaction_date >= NOW() - (p_days || ' days')::INTERVAL
    AND pt.status IN ('completed', 'pending')
  GROUP BY DATE(pt.transaction_date)
  ORDER BY summary_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION merchant_get_daily_summary(INTEGER) TO authenticated;

COMMENT ON FUNCTION merchant_get_daily_summary IS
  'Returns per-day aggregated totals of pos_transactions for the authenticated merchant over the past p_days days.';
