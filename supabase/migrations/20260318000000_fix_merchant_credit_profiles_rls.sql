-- Fix merchant_credit_profiles RLS policies.
-- The original policies checked user_metadata.role but the app stores admin
-- role in app_metadata (set server-side). This migration replaces them with
-- the correct check, matching the pattern used in other admin policies.

-- ── SELECT ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read all credit profiles" ON public.merchant_credit_profiles;

CREATE POLICY "Admins can read all credit profiles"
ON public.merchant_credit_profiles FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
);

-- ── INSERT ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert credit profiles" ON public.merchant_credit_profiles;

CREATE POLICY "Admins can insert credit profiles"
ON public.merchant_credit_profiles FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
);

-- ── UPDATE ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can update credit profiles" ON public.merchant_credit_profiles;

CREATE POLICY "Admins can update credit profiles"
ON public.merchant_credit_profiles FOR UPDATE
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
);
