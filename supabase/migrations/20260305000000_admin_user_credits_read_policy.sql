-- Allow admins to read all user_credits rows for the admin panel
CREATE POLICY "Admins can read all user credits"
ON user_credits FOR SELECT
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
