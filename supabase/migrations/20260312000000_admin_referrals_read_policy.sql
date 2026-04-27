-- Allow admins to read all referrals
CREATE POLICY "Admins can read all referrals"
ON referrals FOR SELECT
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
