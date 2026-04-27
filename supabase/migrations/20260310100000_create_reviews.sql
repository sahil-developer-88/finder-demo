-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  service_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One review per transaction per reviewer
  UNIQUE(reviewer_id, transaction_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS reviews_reviewee_id_idx ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS reviews_reviewer_id_idx ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS reviews_transaction_id_idx ON public.reviews(transaction_id);

-- RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read reviews
CREATE POLICY "reviews_select" ON public.reviews
  FOR SELECT TO authenticated USING (true);

-- Reviewer can insert their own review
CREATE POLICY "reviews_insert" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

-- Reviewer can update their own review
CREATE POLICY "reviews_update" ON public.reviews
  FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- Add average_rating to businesses table for quick reads
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Function to update business average rating after a review
CREATE OR REPLACE FUNCTION update_business_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg NUMERIC;
  v_count INTEGER;
  v_user_id UUID;
BEGIN
  -- Get the reviewee's user_id
  v_user_id := COALESCE(NEW.reviewee_id, OLD.reviewee_id);

  SELECT AVG(rating)::NUMERIC(3,2), COUNT(*)
    INTO v_avg, v_count
    FROM public.reviews
   WHERE reviewee_id = v_user_id;

  UPDATE public.businesses
     SET average_rating = COALESCE(v_avg, 0),
         review_count   = COALESCE(v_count, 0)
   WHERE user_id = v_user_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_update_business_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION update_business_rating();
