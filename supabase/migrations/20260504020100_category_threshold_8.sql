-- Lower visibility threshold from 15 → 8 products per category.
-- Applies to all public-facing category lists, sitemap, and SEO pages.

CREATE OR REPLACE FUNCTION public.get_categories_with_counts(
  category_type text DEFAULT NULL
)
RETURNS TABLE (
  id            uuid,
  name          text,
  slug          text,
  type          text,
  description   text,
  icon          text,
  icon_url      text,
  parent_slug   text,
  product_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.slug,
    c.type,
    c.description,
    c.icon,
    c.icon_url,
    c.parent_slug,
    COUNT(DISTINCT jt.product_id) AS product_count
  FROM public.categories c
  LEFT JOIN (
    SELECT pc.product_id, 'core'::text AS cat_type, pc.category_slug AS cat_slug
      FROM public.product_categories pc
      JOIN public.products p ON p.id = pc.product_id AND p.is_active = true
    UNION ALL
    SELECT pv.product_id, 'vibe'::text, pv.vibe_slug
      FROM public.product_vibes pv
      JOIN public.products p ON p.id = pv.product_id AND p.is_active = true
    UNION ALL
    SELECT pm.product_id, 'mood'::text, pm.mood_slug
      FROM public.product_moods pm
      JOIN public.products p ON p.id = pm.product_id AND p.is_active = true
  ) jt ON jt.cat_slug = c.slug AND jt.cat_type = c.type
  WHERE (category_type IS NULL OR c.type = category_type)
  GROUP BY c.id, c.name, c.slug, c.type, c.description,
           c.icon, c.icon_url, c.parent_slug
  HAVING COUNT(DISTINCT jt.product_id) >= 8
  ORDER BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_categories_with_counts(text) TO anon, authenticated;
