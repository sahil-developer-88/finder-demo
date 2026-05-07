-- Create services table
-- Stores individual services that a merchant offers (e.g. Plumber → "Pipe Repair", "Drain Cleaning")

CREATE TABLE services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Merchants can manage their own services
CREATE POLICY "Merchants can insert their own services"
  ON services FOR INSERT
  WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Merchants can update their own services"
  ON services FOR UPDATE
  USING (auth.uid() = merchant_id);

CREATE POLICY "Merchants can delete their own services"
  ON services FOR DELETE
  USING (auth.uid() = merchant_id);

CREATE POLICY "Merchants can view their own services"
  ON services FOR SELECT
  USING (auth.uid() = merchant_id);

-- Customers can view active services
CREATE POLICY "Anyone can view active services"
  ON services FOR SELECT
  USING (status = 'active');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_services_updated_at();
