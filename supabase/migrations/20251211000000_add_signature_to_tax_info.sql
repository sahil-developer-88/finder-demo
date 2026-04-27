-- Add signature columns to tax_info table
ALTER TABLE public.tax_info
ADD COLUMN signature TEXT,
ADD COLUMN signature_date TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.tax_info.signature IS 'Base64 encoded signature image (PNG)';
COMMENT ON COLUMN public.tax_info.signature_date IS 'Date when the form was signed';
