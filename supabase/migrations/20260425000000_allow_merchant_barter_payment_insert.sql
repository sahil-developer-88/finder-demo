-- Allow merchants to record barter payment transactions on behalf of customers.
-- The existing policy only allows inserting when auth.uid() = from_user_id,
-- which blocks merchants (to_user_id) from recording payments they received.
CREATE POLICY "Merchants can record received barter payments"
ON public.transactions FOR INSERT
WITH CHECK (
  auth.uid() = to_user_id
  AND transaction_type = 'barter_payment'
);
