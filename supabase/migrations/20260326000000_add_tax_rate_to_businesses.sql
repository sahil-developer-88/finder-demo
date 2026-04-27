-- Add tax_rate to businesses table
-- Merchants can set their own sales tax rate (e.g. 0.08 = 8%)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.08
    CHECK (tax_rate >= 0 AND tax_rate <= 1);
