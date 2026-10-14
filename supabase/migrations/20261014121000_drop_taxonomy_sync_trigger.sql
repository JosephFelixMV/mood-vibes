-- Phase 5 Stage 2b: retire sync_taxonomy_junction_tables() now that all
-- app write paths (ProductForm, ProductList, BulkUpload) write junction
-- tables directly. Legacy columns remain readable (not dropped yet) as
-- a safety net during the soak window.
--
-- GATE: do not run until Stage 3 Part A (ProductList.tsx + BulkUpload.tsx
-- junction-write fixes) is merged, deployed, and manually smoke-tested.
-- Run this manually in the Supabase SQL Editor. Not applied automatically.

DROP TRIGGER IF EXISTS trg_sync_taxonomy_junction_tables ON public.products;
DROP FUNCTION IF EXISTS public.sync_taxonomy_junction_tables();

ALTER TABLE public.products ALTER COLUMN category DROP NOT NULL;

DO $$
DECLARE trig_count int; fn_count int; notnull_check boolean;
BEGIN
  SELECT count(*) INTO trig_count FROM pg_trigger WHERE tgname = 'trg_sync_taxonomy_junction_tables';
  SELECT count(*) INTO fn_count   FROM pg_proc    WHERE proname = 'sync_taxonomy_junction_tables';
  SELECT attnotnull INTO notnull_check FROM pg_attribute WHERE attrelid = 'public.products'::regclass AND attname = 'category';
  IF trig_count <> 0 THEN RAISE EXCEPTION 'Stage 2b self-check failed: trigger still present'; END IF;
  IF fn_count   <> 0 THEN RAISE EXCEPTION 'Stage 2b self-check failed: function still present'; END IF;
  IF notnull_check    THEN RAISE EXCEPTION 'Stage 2b self-check failed: category still NOT NULL'; END IF;
END $$;

-- Rollback (only if no NULL `category` values were written since this ran —
-- check `SELECT count(*) FROM products WHERE category IS NULL` first):
--
-- ALTER TABLE public.products ALTER COLUMN category SET NOT NULL;
--
-- CREATE OR REPLACE FUNCTION public.sync_taxonomy_junction_tables()
-- RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
-- BEGIN
--   DELETE FROM public.product_categories WHERE product_id = NEW.id;
--   DELETE FROM public.product_vibes      WHERE product_id = NEW.id;
--   DELETE FROM public.product_moods      WHERE product_id = NEW.id;
--
--   IF NEW.category IS NOT NULL AND NEW.category <> '' THEN
--     INSERT INTO public.product_categories (product_id, category_slug, is_primary, display_order)
--     SELECT NEW.id, c.slug, (row_number() OVER () = 1), (row_number() OVER () - 1)
--     FROM unnest(string_to_array(NEW.category, ',')) WITH ORDINALITY AS t(raw_name, ord)
--       JOIN public.categories c ON lower(trim(t.raw_name)) = lower(c.name) AND c.type = 'core'
--     ORDER BY t.ord
--     ON CONFLICT (product_id, category_slug) DO NOTHING;
--   END IF;
--
--   IF NEW.vibe_category IS NOT NULL AND NEW.vibe_category <> '' THEN
--     INSERT INTO public.product_vibes (product_id, vibe_slug, is_primary, display_order)
--     SELECT NEW.id, c.slug, (row_number() OVER () = 1), (row_number() OVER () - 1)
--     FROM unnest(string_to_array(NEW.vibe_category, ',')) WITH ORDINALITY AS t(raw_name, ord)
--       JOIN public.categories c ON lower(trim(t.raw_name)) = lower(c.name) AND c.type = 'vibe'
--     ORDER BY t.ord
--     ON CONFLICT (product_id, vibe_slug) DO NOTHING;
--   END IF;
--
--   IF NEW.mood IS NOT NULL AND NEW.mood <> '' THEN
--     INSERT INTO public.product_moods (product_id, mood_slug, is_primary, display_order)
--     SELECT NEW.id, c.slug, (row_number() OVER () = 1), (row_number() OVER () - 1)
--     FROM unnest(string_to_array(NEW.mood, ',')) WITH ORDINALITY AS t(raw_name, ord)
--       JOIN public.categories c ON lower(trim(t.raw_name)) = lower(c.name) AND c.type = 'mood'
--     ORDER BY t.ord
--     ON CONFLICT (product_id, mood_slug) DO NOTHING;
--   END IF;
--
--   RETURN NEW;
-- END;
-- $function$;
--
-- CREATE TRIGGER trg_sync_taxonomy_junction_tables
--   AFTER INSERT OR UPDATE ON public.products
--   FOR EACH ROW EXECUTE FUNCTION public.sync_taxonomy_junction_tables();
