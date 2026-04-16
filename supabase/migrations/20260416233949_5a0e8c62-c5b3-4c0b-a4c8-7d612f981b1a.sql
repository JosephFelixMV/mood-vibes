CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);
CREATE INDEX IF NOT EXISTS idx_products_vibe_category ON public.products (vibe_category);
CREATE INDEX IF NOT EXISTS idx_products_mood ON public.products (mood);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_regions ON public.products USING GIN (regions);
CREATE INDEX IF NOT EXISTS idx_products_fashion_season ON public.products (fashion_season);
CREATE INDEX IF NOT EXISTS idx_products_fashion_warmth ON public.products (fashion_warmth);
CREATE INDEX IF NOT EXISTS idx_products_active_category ON public.products (is_active, category);