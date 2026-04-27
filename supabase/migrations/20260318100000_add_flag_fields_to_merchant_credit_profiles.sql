-- Add flag tracking fields to merchant_credit_profiles
-- Allows admin-set flags to persist across page refreshes

ALTER TABLE public.merchant_credit_profiles
  ADD COLUMN IF NOT EXISTS flag_status  TEXT NOT NULL DEFAULT 'none'
    CHECK (flag_status IN ('none', 'soft', 'hard')),
  ADD COLUMN IF NOT EXISTS flag_reasons TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flagged_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flagged_by   UUID REFERENCES auth.users(id);
