-- Allow admins to read all transactions for activity feed and disputes
CREATE POLICY "Admins can read all transactions"
ON transactions FOR SELECT
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
