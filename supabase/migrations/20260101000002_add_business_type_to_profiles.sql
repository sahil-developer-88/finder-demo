-- Add business_type field to profiles table to differentiate between product and service businesses

-- Add business_type column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_type TEXT CHECK (business_type IN ('product', 'service'));

-- Set default to 'product' for existing merchants who have products
UPDATE public.profiles
SET business_type = 'product'
WHERE business_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.business_type IS
'Type of business: product (retail, food, physical goods) or service (electricians, plumbers, consultants)';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_profiles_business_type ON public.profiles(business_type);
