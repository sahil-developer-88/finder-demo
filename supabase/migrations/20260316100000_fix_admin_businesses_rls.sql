-- Fix admin access to businesses table.
-- The app sets admin role in user app_metadata (JWT), but the existing RLS
-- policy only checks the user_roles table. This migration adds app_metadata
-- check so admins can read/update all businesses.

-- ── SELECT ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all businesses" ON public.businesses;

CREATE POLICY "Admins can view all businesses"
ON public.businesses FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
);

-- ── UPDATE ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can update any business" ON public.businesses;

CREATE POLICY "Admins can update any business"
ON public.businesses FOR UPDATE
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
);
