-- Allow 'both' as a valid business_type in profiles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_business_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_business_type_check
    CHECK (business_type IN ('product', 'service', 'both'));
