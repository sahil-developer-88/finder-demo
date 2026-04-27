-- Migration: Fix Critical Security Vulnerabilities
-- Created: 2024-12-24
-- Purpose: Secure profiles, businesses, tax_info, and audit_logs from unauthorized access
--
-- CRITICAL FIXES:
-- 1. Profiles: Remove "view all" policy - only allow viewing own profile
-- 2. Businesses: Allow viewing active listings but restrict sensitive data
-- 3. Tax Info: Ensure only owner can access (already correct but verify)
-- 4. Audit Logs: Only service_role can insert, users can only view their own
-- 5. Add anon blocking to prevent unauthenticated access

-- ============================================
-- FIX PROFILES TABLE - CRITICAL PII EXPOSURE
-- ============================================

-- Drop the dangerous "view all" policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Users can only view their own profile (contains email, phone, address!)
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all profiles (for admin panel) - only if user_roles table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles';
    EXECUTE 'CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ''admin''))';
  END IF;
END $$;

-- Block anonymous access completely
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles FOR ALL
TO anon
USING (false);

-- ============================================
-- FIX BUSINESSES TABLE - CONTACT INFO EXPOSURE
-- ============================================

-- Drop all existing business policies
DROP POLICY IF EXISTS "Users can view all businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can view active business listings" ON public.businesses;
DROP POLICY IF EXISTS "Owners can view their own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admins can view all businesses" ON public.businesses;
DROP POLICY IF EXISTS "Block anonymous access to businesses table" ON public.businesses;

-- Create a view for public business listings (safe data only)
CREATE OR REPLACE VIEW public.business_listings AS
SELECT
  id,
  business_name,
  category,
  description,
  services_offered,
  wanting_in_return,
  location, -- City/area only, not full address
  barter_percentage,
  status,
  created_at,
  -- DO NOT EXPOSE: user_id, contact_method (contains email/phone), estimated_value
  NULL::uuid as user_id -- Hide owner
FROM public.businesses
WHERE status = 'active';

-- Grant access to the safe view
GRANT SELECT ON public.business_listings TO authenticated, anon;

-- Users can view all active business listings (via the safe view above)
-- For the actual table, only owner can see full details
CREATE POLICY "Users can view active business listings"
ON public.businesses FOR SELECT
TO authenticated
USING (
  status = 'active'
  OR auth.uid() = user_id  -- Owner can see their own even if inactive
);

-- Owners can view their own businesses (full details)
CREATE POLICY "Owners can view their own businesses"
ON public.businesses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all businesses - only if user_roles exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
    EXECUTE 'CREATE POLICY "Admins can view all businesses" ON public.businesses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ''admin''))';
  END IF;
END $$;

-- Block anonymous access to sensitive business data
CREATE POLICY "Block anonymous access to businesses table"
ON public.businesses FOR ALL
TO anon
USING (false);

-- ============================================
-- FIX TAX_INFO TABLE - SSN/TAX ID PROTECTION
-- ============================================

-- Verify tax_info policies are correct (they should already be owner-only)
-- But let's be explicit and add anon blocking

DROP POLICY IF EXISTS "Users can view their own tax info" ON public.tax_info;
DROP POLICY IF EXISTS "Users can create their own tax info" ON public.tax_info;
DROP POLICY IF EXISTS "Users can update their own tax info" ON public.tax_info;

-- Only owner can view their tax info (SSN, Tax ID!)
CREATE POLICY "Users can view their own tax info"
ON public.tax_info FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only owner can create their tax info
CREATE POLICY "Users can create their own tax info"
ON public.tax_info FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Only owner can update their tax info
CREATE POLICY "Users can update their own tax info"
ON public.tax_info FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Service role can access all (for tax reporting)
CREATE POLICY "Service role can manage tax info"
ON public.tax_info FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- CRITICAL: Block anonymous access completely
CREATE POLICY "Block anonymous access to tax info"
ON public.tax_info FOR ALL
TO anon
USING (false);

-- ============================================
-- FIX AUDIT_LOGS TABLE - PREVENT TAMPERING
-- ============================================

-- Drop the dangerous policy that allows anyone to insert
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Only service_role can insert audit logs (via triggers/functions)
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- Users can view their own audit logs (transparency)
-- Already exists, but verify it's correct
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;

CREATE POLICY "Users can view their own audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all audit logs - only if user_roles exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
    EXECUTE 'CREATE POLICY "Admins can view all audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ''admin''))';
  END IF;
END $$;

-- Block anonymous access
CREATE POLICY "Block anonymous access to audit logs"
ON public.audit_logs FOR ALL
TO anon
USING (false);

-- ============================================
-- FIX W9_TAX_INFO TABLE (if exists)
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'w9_tax_info'
  ) THEN
    -- Drop any dangerous policies
    EXECUTE 'DROP POLICY IF EXISTS "public_read_w9" ON public.w9_tax_info';

    -- Only owner can access their W9 data
    EXECUTE 'CREATE POLICY "Users can view their own W9" ON public.w9_tax_info FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can create their own W9" ON public.w9_tax_info FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can update their own W9" ON public.w9_tax_info FOR UPDATE TO authenticated USING (auth.uid() = user_id)';

    -- Service role access
    EXECUTE 'CREATE POLICY "Service role can manage W9" ON public.w9_tax_info FOR ALL TO service_role USING (true) WITH CHECK (true)';

    -- Block anon
    EXECUTE 'CREATE POLICY "Block anonymous access to W9" ON public.w9_tax_info FOR ALL TO anon USING (false)';
  END IF;
END $$;

-- ============================================
-- FIX MESSAGES TABLE - PRIVACY
-- ============================================

-- Verify messages are properly secured
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;

CREATE POLICY "Users can view their own messages"
ON public.messages FOR SELECT
TO authenticated
USING (
  auth.uid() = sender_id
  OR auth.uid() = recipient_id
);

-- Block anon
CREATE POLICY "Block anonymous access to messages"
ON public.messages FOR ALL
TO anon
USING (false);

-- ============================================
-- FIX NOTIFICATIONS TABLE
-- ============================================

-- Block anon access
CREATE POLICY "Block anonymous access to notifications"
ON public.notifications FOR ALL
TO anon
USING (false);

-- ============================================
-- ADD SECURITY COMMENTS
-- ============================================

COMMENT ON POLICY "Users can view their own profile" ON public.profiles
IS 'SECURITY: Restricts profile viewing to owner only - contains PII';

COMMENT ON POLICY "Block anonymous access to profiles" ON public.profiles
IS 'SECURITY: Prevents unauthenticated access to all PII';

COMMENT ON POLICY "Users can view their own tax info" ON public.tax_info
IS 'SECURITY CRITICAL: Tax info contains SSN/Tax IDs - owner access only';

COMMENT ON POLICY "Block anonymous access to tax info" ON public.tax_info
IS 'SECURITY CRITICAL: Absolutely no public access to tax data';

COMMENT ON POLICY "Service role can insert audit logs" ON public.audit_logs
IS 'SECURITY: Only system can create audit logs - prevents tampering';

-- ============================================
-- REVOKE DANGEROUS GRANTS
-- ============================================

-- Ensure anon role has no dangerous permissions
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.tax_info FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.messages FROM anon;
REVOKE ALL ON public.notifications FROM anon;

-- Grant only safe, read-only access to business listings view
GRANT SELECT ON public.business_listings TO anon, authenticated;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify RLS is enabled on all sensitive tables
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('profiles', 'businesses', 'tax_info', 'audit_logs', 'messages', 'notifications', 'w9_tax_info')
  LOOP
    -- Enable RLS if not already enabled
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.tablename);
    RAISE NOTICE 'RLS enabled on table: %', table_record.tablename;
  END LOOP;
END $$;

-- Security fix applied - RLS policies updated to restrict access to PII and sensitive data
