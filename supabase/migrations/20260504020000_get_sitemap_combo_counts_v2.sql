-- Phase 2: Replace get_sitemap_combo_counts RPC
--
-- Previous implementation unnested CSV columns and joined by name (case-insensitive).
-- New implementation joins directly against junction tables using slug keys —
-- no string splitting, no name resolution, exact matches only.

CREATE OR REPLACE FUNCTION public.get_sitemap_combo_counts()
RETURNS TABLE(
  primary_type text,
  primary_slug text,
  mood_slug    text,
  cnt          bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  core_combos AS (
    SELECT
      'core'::text     AS primary_type,
      pc.category_slug AS primary_slug,
      pm.mood_slug     AS mood_slug,
      COUNT(DISTINCT pc.product_id) AS cnt
    FROM public.product_categories pc
    JOIN public.product_moods pm ON pm.product_id = pc.product_id
    JOIN public.products p ON p.id = pc.product_id AND p.is_active = true
    GROUP BY pc.category_slug, pm.mood_slug
    HAVING COUNT(DISTINCT pc.product_id) >= 3
  ),
  vibe_combos AS (
    SELECT
      'vibe'::text     AS primary_type,
      pv.vibe_slug     AS primary_slug,
      pm.mood_slug     AS mood_slug,
      COUNT(DISTINCT pv.product_id) AS cnt
    FROM public.product_vibes pv
    JOIN public.product_moods pm ON pm.product_id = pv.product_id
    JOIN public.products p ON p.id = pv.product_id AND p.is_active = true
    GROUP BY pv.vibe_slug, pm.mood_slug
    HAVING COUNT(DISTINCT pv.product_id) >= 3
  )
  SELECT primary_type, primary_slug, mood_slug, cnt FROM core_combos
  UNION ALL
  SELECT primary_type, primary_slug, mood_slug, cnt FROM vibe_combos;
$$;

GRANT EXECUTE ON FUNCTION public.get_sitemap_combo_counts() TO anon, authenticated;
