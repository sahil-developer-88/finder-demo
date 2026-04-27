-- Fix RLS policies on profiles table to allow merchants to see each other
-- This is required for merchant-to-merchant payment requests

-- Drop the old restrictive policy that only allowed users to view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a new policy that allows all authenticated users to view all profiles
-- This is necessary for the merchant-to-merchant barter system where merchants need to:
-- 1. Select other merchants when creating payment requests
-- 2. View merchant details in the marketplace
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Ensure users can only update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure users can only insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON POLICY "Authenticated users can view all profiles" ON public.profiles IS
'Allows all authenticated merchants to view each other for payment requests and marketplace browsing';
