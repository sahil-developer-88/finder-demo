-- Add search_vector column (trigger-maintained, works around immutability requirement)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Function to update search_vector
CREATE OR REPLACE FUNCTION public.businesses_search_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector(
    'english',
    coalesce(NEW.business_name, '') || ' ' ||
    coalesce(NEW.category, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(array_to_string(NEW.services_offered, ' '), '') || ' ' ||
    coalesce(NEW.location, '')
  );
  RETURN NEW;
END;
$$;

-- Trigger fires on insert or update
DROP TRIGGER IF EXISTS businesses_search_vector_trigger ON public.businesses;
CREATE TRIGGER businesses_search_vector_trigger
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.businesses_search_vector_update();

-- Backfill existing rows
UPDATE public.businesses SET search_vector = to_tsvector(
  'english',
  coalesce(business_name, '') || ' ' ||
  coalesce(category, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(array_to_string(services_offered, ' '), '') || ' ' ||
  coalesce(location, '')
);

-- GIN index for fast full-text queries
CREATE INDEX IF NOT EXISTS idx_businesses_search_vector
  ON public.businesses USING GIN(search_vector);
