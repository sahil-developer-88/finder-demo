-- ============================================================
-- Referral System
-- ============================================================

-- 1. Add referral_code column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Generate a unique 8-char code for existing profiles
UPDATE public.profiles
SET referral_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- Trigger to auto-generate referral_code on new profile insert
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_referral_code ON public.profiles;
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

-- 2. Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code  TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'completed')),
  points_awarded NUMERIC NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  CONSTRAINT referrals_referred_id_unique UNIQUE (referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status      ON public.referrals(status);

-- 3. RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrers can view their own referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id);

CREATE POLICY "No direct client insert"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 4. create_referral_link — called after signup to record the relationship
CREATE OR REPLACE FUNCTION public.create_referral_link(
  p_referred_user_id UUID,
  p_referral_code    TEXT
)
RETURNS VOID AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  SELECT user_id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = upper(trim(p_referral_code));

  IF NOT FOUND THEN RETURN; END IF;
  IF v_referrer_id = p_referred_user_id THEN RETURN; END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, referral_code)
  VALUES (v_referrer_id, p_referred_user_id, upper(trim(p_referral_code)))
  ON CONFLICT (referred_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. award_referral_points — called after onboarding completion
CREATE OR REPLACE FUNCTION public.award_referral_points(
  p_referred_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_referral          public.referrals%ROWTYPE;
  POINTS_PER_REFERRAL CONSTANT NUMERIC := 50;
BEGIN
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE referred_id = p_referred_user_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  -- Credit referrer
  INSERT INTO public.user_credits (user_id, available_credits, total_earned)
  VALUES (v_referral.referrer_id, POINTS_PER_REFERRAL, POINTS_PER_REFERRAL)
  ON CONFLICT (user_id) DO UPDATE
    SET available_credits = user_credits.available_credits + POINTS_PER_REFERRAL,
        total_earned      = user_credits.total_earned + POINTS_PER_REFERRAL,
        updated_at        = now();

  -- Mark completed
  UPDATE public.referrals
  SET status         = 'completed',
      points_awarded = POINTS_PER_REFERRAL,
      completed_at   = now()
  WHERE id = v_referral.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_referral_link(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_referral_points(UUID)       TO authenticated;

COMMENT ON TABLE public.referrals IS 'Tracks who referred who and reward status';
COMMENT ON COLUMN public.profiles.referral_code IS '8-char uppercase alphanumeric, auto-generated on insert';
