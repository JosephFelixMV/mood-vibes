-- Phase 1c: Dual-write trigger on products
--
-- Fires BEFORE INSERT OR UPDATE on products.
-- Strategy: DELETE all existing junction rows for the product, then
-- INSERT fresh rows resolved from the new CSV column values.
--
-- This handles removals correctly: if category changes from
-- "Skin Care, Bath" to "Skin Care", the DELETE removes the stale
-- "bath" row before the INSERT writes only "skin-care".
--
-- Categories are resolved by name → slug JOIN against the categories
-- table (case-insensitive). Values with no matching category are
-- silently skipped (orphan diagnostic in Step 1a ensures zero orphans).

CREATE OR REPLACE FUNCTION public.sync_taxonomy_junction_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── Clear existing junction rows for this product ─────────────────
  DELETE FROM public.product_categories WHERE product_id = NEW.id;
  DELETE FROM public.product_vibes      WHERE product_id = NEW.id;
  DELETE FROM public.product_moods      WHERE product_id = NEW.id;

  -- ── Re-populate from category (core) ─────────────────────────────
  IF NEW.category IS NOT NULL AND NEW.category <> '' THEN
    INSERT INTO public.product_categories (product_id, category_slug, is_primary, display_order)
    SELECT
      NEW.id,
      c.slug,
      (row_number() OVER () = 1) AS is_primary,
      (row_number() OVER () - 1) AS display_order
    FROM
      unnest(string_to_array(NEW.category, ',')) WITH ORDINALITY AS t(raw_name, ord)
      JOIN public.categories c
        ON lower(trim(t.raw_name)) = lower(c.name)
        AND c.type = 'core'
    ORDER BY t.ord
    ON CONFLICT (product_id, category_slug) DO NOTHING;
  END IF;

  -- ── Re-populate from vibe_category ───────────────────────────────
  IF NEW.vibe_category IS NOT NULL AND NEW.vibe_category <> '' THEN
    INSERT INTO public.product_vibes (product_id, vibe_slug, is_primary, display_order)
    SELECT
      NEW.id,
      c.slug,
      (row_number() OVER () = 1) AS is_primary,
      (row_number() OVER () - 1) AS display_order
    FROM
      unnest(string_to_array(NEW.vibe_category, ',')) WITH ORDINALITY AS t(raw_name, ord)
      JOIN public.categories c
        ON lower(trim(t.raw_name)) = lower(c.name)
        AND c.type = 'vibe'
    ORDER BY t.ord
    ON CONFLICT (product_id, vibe_slug) DO NOTHING;
  END IF;

  -- ── Re-populate from mood ─────────────────────────────────────────
  IF NEW.mood IS NOT NULL AND NEW.mood <> '' THEN
    INSERT INTO public.product_moods (product_id, mood_slug, is_primary, display_order)
    SELECT
      NEW.id,
      c.slug,
      (row_number() OVER () = 1) AS is_primary,
      (row_number() OVER () - 1) AS display_order
    FROM
      unnest(string_to_array(NEW.mood, ',')) WITH ORDINALITY AS t(raw_name, ord)
      JOIN public.categories c
        ON lower(trim(t.raw_name)) = lower(c.name)
        AND c.type = 'mood'
    ORDER BY t.ord
    ON CONFLICT (product_id, mood_slug) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_taxonomy_junction_tables
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_taxonomy_junction_tables();
