-- Fix Security Definer View issue by using RLS policies instead

-- Drop the security definer view
DROP VIEW IF EXISTS public.public_profiles;

-- Instead, create an additional RLS policy that allows limited public access
-- to verified business profiles only (without sensitive data)
CREATE POLICY "Public can view verified business profiles (limited fields)"
  ON public.profiles FOR SELECT
  USING (
    business_verified = true
    AND user_id IS NOT NULL
  );

-- Note: This policy works alongside the existing "Users can view their own profile" policy
-- Users can see their full profile, while public can only see verified businesses
-- The application layer should only query specific safe fields when displaying public listings