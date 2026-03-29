
CREATE TABLE public.product_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  clicked_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert clicks" ON public.product_clicks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read clicks" ON public.product_clicks FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX idx_product_clicks_product_id ON public.product_clicks(product_id);
