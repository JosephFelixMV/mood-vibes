
CREATE TABLE public.brands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  affiliate_url text NOT NULL,
  regions text[] NOT NULL DEFAULT ARRAY['US'],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brands are viewable by everyone"
ON public.brands FOR SELECT
TO public
USING (true);

CREATE POLICY "Anyone can insert brands"
ON public.brands FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can update brands"
ON public.brands FOR UPDATE
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can delete brands"
ON public.brands FOR DELETE
TO anon, authenticated
USING (true);

CREATE TRIGGER update_brands_updated_at
BEFORE UPDATE ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
