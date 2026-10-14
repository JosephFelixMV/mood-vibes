-- Phase 5 Stage 2a (additive, safe, fully reversible): FK the junction
-- table slug columns to categories.slug so PostgREST can embed
-- categories(name) via nested select instead of client-side slug→name
-- mapping. categories.slug already has a UNIQUE constraint, so this is
-- a safe FK target.
--
-- Run this manually in the Supabase SQL Editor. Not applied automatically.

DO $$
DECLARE orphan_cat int; orphan_vibe int; orphan_mood int;
BEGIN
  SELECT count(*) INTO orphan_cat  FROM product_categories pc WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = pc.category_slug);
  SELECT count(*) INTO orphan_vibe FROM product_vibes pv       WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = pv.vibe_slug);
  SELECT count(*) INTO orphan_mood FROM product_moods pm       WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = pm.mood_slug);
  IF orphan_cat <> 0 OR orphan_vibe <> 0 OR orphan_mood <> 0 THEN
    RAISE EXCEPTION 'Orphan slugs found (category=%, vibe=%, mood=%) — resolve before adding FK', orphan_cat, orphan_vibe, orphan_mood;
  END IF;
END $$;

ALTER TABLE public.product_categories
  ADD CONSTRAINT product_categories_category_slug_fkey
  FOREIGN KEY (category_slug) REFERENCES public.categories(slug)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.product_vibes
  ADD CONSTRAINT product_vibes_vibe_slug_fkey
  FOREIGN KEY (vibe_slug) REFERENCES public.categories(slug)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.product_moods
  ADD CONSTRAINT product_moods_mood_slug_fkey
  FOREIGN KEY (mood_slug) REFERENCES public.categories(slug)
  ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE fk_count int;
BEGIN
  SELECT count(*) INTO fk_count FROM pg_constraint
  WHERE conname IN ('product_categories_category_slug_fkey','product_vibes_vibe_slug_fkey','product_moods_mood_slug_fkey');
  IF fk_count <> 3 THEN RAISE EXCEPTION 'Stage 2a self-check failed: expected 3 FKs, found %', fk_count; END IF;
END $$;

-- Rollback:
-- ALTER TABLE public.product_categories DROP CONSTRAINT IF EXISTS product_categories_category_slug_fkey;
-- ALTER TABLE public.product_vibes       DROP CONSTRAINT IF EXISTS product_vibes_vibe_slug_fkey;
-- ALTER TABLE public.product_moods       DROP CONSTRAINT IF EXISTS product_moods_mood_slug_fkey;
