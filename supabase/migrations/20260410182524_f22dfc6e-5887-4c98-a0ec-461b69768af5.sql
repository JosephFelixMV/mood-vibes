-- Add slug column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text;

-- Populate slugs from existing product names
UPDATE public.products
SET slug = lower(
  regexp_replace(
    regexp_replace(
      regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  )
)
WHERE slug IS NULL;

-- Handle duplicates by appending a suffix
DO $$
DECLARE
  r RECORD;
  counter INT;
BEGIN
  FOR r IN
    SELECT slug, array_agg(id ORDER BY created_at) AS ids
    FROM public.products
    GROUP BY slug
    HAVING count(*) > 1
  LOOP
    counter := 1;
    FOR i IN 2..array_length(r.ids, 1) LOOP
      UPDATE public.products SET slug = r.slug || '-' || counter WHERE id = r.ids[i];
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Now make it NOT NULL and UNIQUE
ALTER TABLE public.products ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON public.products (slug);