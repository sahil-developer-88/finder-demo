-- Allow admins to read all pos_transactions for annual totals / tax reporting
CREATE POLICY "Admins can read all pos transactions"
ON pos_transactions FOR SELECT
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
