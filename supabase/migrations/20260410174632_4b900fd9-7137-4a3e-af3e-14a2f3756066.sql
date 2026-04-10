
-- Add regions column as text array with default ['US']
ALTER TABLE public.products
ADD COLUMN regions text[] NOT NULL DEFAULT ARRAY['US'];

-- Backfill all existing products to ['US']
UPDATE public.products SET regions = ARRAY['US'] WHERE regions IS NULL OR regions = '{}';
