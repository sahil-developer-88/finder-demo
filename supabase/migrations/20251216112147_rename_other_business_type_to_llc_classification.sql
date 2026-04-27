-- Rename other_business_type column to llc_classification in tax_info table
-- This aligns with the new W-9 form requirements where:
-- - SSN users can only be: Individual/sole proprietor or Single-member LLC
-- - EIN users can only be: LLC (multi-member), Corporation, or Partnership
-- - LLC users with EIN must specify classification: C (C corp), S (S corp), or P (Partnership)

ALTER TABLE public.tax_info
RENAME COLUMN other_business_type TO llc_classification;

-- Update column comment for documentation
COMMENT ON COLUMN public.tax_info.llc_classification IS 'LLC tax classification: C=C corporation, S=S corporation, P=Partnership. Only applicable when business_type is LLC and tax_id_type is EIN.';
