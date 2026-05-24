ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS external_url text;

CREATE UNIQUE INDEX IF NOT EXISTS products_external_id_unique
  ON public.products (external_id)
  WHERE external_id IS NOT NULL;
