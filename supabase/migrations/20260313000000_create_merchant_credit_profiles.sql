-- Merchant credit profiles for underwriting / credit risk tracking
CREATE TABLE IF NOT EXISTS public.merchant_credit_profiles (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_line               NUMERIC NOT NULL DEFAULT 500,
  risk_score                TEXT NOT NULL DEFAULT 'low' CHECK (risk_score IN ('low','medium','high','critical')),
  security_deposit_amount   NUMERIC NOT NULL DEFAULT 0,
  personal_guarantee_on_file BOOLEAN NOT NULL DEFAULT false,
  auto_suspend_threshold    NUMERIC NOT NULL DEFAULT 500,
  notes                     TEXT,
  updated_by                UUID REFERENCES auth.users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_credit_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own credit profile"
  ON public.merchant_credit_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all credit profiles"
  ON public.merchant_credit_profiles FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Admins can insert credit profiles
CREATE POLICY "Admins can insert credit profiles"
  ON public.merchant_credit_profiles FOR INSERT
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Admins can update credit profiles
CREATE POLICY "Admins can update credit profiles"
  ON public.merchant_credit_profiles FOR UPDATE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_merchant_credit_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER merchant_credit_profiles_updated_at
  BEFORE UPDATE ON public.merchant_credit_profiles
  FOR EACH ROW EXECUTE FUNCTION update_merchant_credit_profiles_updated_at();
