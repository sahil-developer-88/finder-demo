-- Add barter_percentage to business_listings table
ALTER TABLE public.business_listings 
ADD COLUMN barter_percentage numeric DEFAULT 20 CHECK (barter_percentage >= 0 AND barter_percentage <= 100);

COMMENT ON COLUMN public.business_listings.barter_percentage IS 'Percentage of transaction the merchant is willing to accept in barter (0-100)';

-- Add barter_percentage to profiles table for merchant default preference
ALTER TABLE public.profiles 
ADD COLUMN barter_percentage numeric DEFAULT 20 CHECK (barter_percentage >= 0 AND barter_percentage <= 100);

COMMENT ON COLUMN public.profiles.barter_percentage IS 'Default barter percentage preference for the merchant';

-- Update existing records to have default 20% barter
UPDATE public.business_listings SET barter_percentage = 20 WHERE barter_percentage IS NULL;
UPDATE public.profiles SET barter_percentage = 20 WHERE barter_percentage IS NULL;