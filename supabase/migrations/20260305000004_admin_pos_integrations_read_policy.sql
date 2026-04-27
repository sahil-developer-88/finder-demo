-- Allow admins to read all pos_integrations for system alerts / monitoring
CREATE POLICY "Admins can read all pos integrations"
ON pos_integrations FOR SELECT
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
