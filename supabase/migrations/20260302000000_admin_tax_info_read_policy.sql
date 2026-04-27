-- Allow admins to read all tax_info rows for the admin panel W-9 completion stat
CREATE POLICY "Admins can view all tax info"
  ON public.tax_info FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
