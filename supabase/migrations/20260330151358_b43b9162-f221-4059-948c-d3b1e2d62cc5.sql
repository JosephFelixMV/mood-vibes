
CREATE TABLE public.product_specifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  item_detail text NOT NULL,
  specification text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_specifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product specifications" ON public.product_specifications FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert product specifications" ON public.product_specifications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update product specifications" ON public.product_specifications FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Anyone can delete product specifications" ON public.product_specifications FOR DELETE TO anon, authenticated USING (true);
