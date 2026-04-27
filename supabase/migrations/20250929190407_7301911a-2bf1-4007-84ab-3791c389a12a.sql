-- Fix profiles table RLS policy to prevent public data exposure
-- Drop the overly permissive policy that allows anyone to view all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create restrictive policy - users can only view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Create a view for verified business profiles (public-facing directory)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  user_id,
  full_name,
  business_name,
  avatar_url,
  bio,
  location,
  business_verified,
  created_at
FROM public.profiles
WHERE business_verified = true;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Create a secure function to get basic profile info for transactions
-- This allows merchants to see customer names without exposing sensitive data
CREATE OR REPLACE FUNCTION public.get_public_profile_info(profile_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  full_name TEXT,
  business_name TEXT,
  avatar_url TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    user_id,
    full_name,
    business_name,
    avatar_url
  FROM public.profiles
  WHERE user_id = profile_user_id
  LIMIT 1;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_public_profile_info(UUID) TO anon, authenticated;