ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS fashion_season text,
  ADD COLUMN IF NOT EXISTS fashion_warmth text,
  ADD COLUMN IF NOT EXISTS fashion_occasions text[] DEFAULT '{}';