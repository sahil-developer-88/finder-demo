-- Allow admins to delete pos_integrations (disconnect on behalf of merchant)
CREATE POLICY "Admins can delete pos integrations"
ON pos_integrations FOR DELETE
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
