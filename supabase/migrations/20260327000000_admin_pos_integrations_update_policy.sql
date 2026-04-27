-- Allow admins to update pos_integrations (e.g. approve/reject disconnect requests)
CREATE POLICY "Admins can update all pos integrations"
ON pos_integrations FOR UPDATE
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
