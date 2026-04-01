
CREATE TABLE public.product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view', 'click')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_events_lookup ON public.product_events (product_id, event_type, created_at);

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert events" ON public.product_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can read events" ON public.product_events
  FOR SELECT TO anon, authenticated USING (true);
