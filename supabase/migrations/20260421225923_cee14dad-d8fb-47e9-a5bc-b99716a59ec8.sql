CREATE OR REPLACE FUNCTION public.get_categories_with_counts(
  category_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  type text,
  description text,
  icon text,
  icon_url text,
  parent_slug text,
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
    COUNT(DISTINCT p.id) as product_count
  FROM public.categories c
  LEFT JOIN public.products p
    ON p.is_active = true
    AND (
      (c.type = 'core' AND (
        p.category = c.name
        OR p.category LIKE c.name || ',%'
        OR p.category LIKE '%, ' || c.name
        OR p.category LIKE '%,' || c.name
        OR p.category LIKE '%, ' || c.name || ',%'
        OR p.category LIKE '%,' || c.name || ',%'
      ))
      OR (c.type = 'vibe' AND (
        p.vibe_category = c.name
        OR p.vibe_category LIKE c.name || ',%'
        OR p.vibe_category LIKE '%, ' || c.name
        OR p.vibe_category LIKE '%,' || c.name
        OR p.vibe_category LIKE '%, ' || c.name || ',%'
        OR p.vibe_category LIKE '%,' || c.name || ',%'
      ))
      OR (c.type = 'mood' AND (
        p.mood = c.name
        OR p.mood LIKE c.name || ',%'
        OR p.mood LIKE '%, ' || c.name
        OR p.mood LIKE '%,' || c.name
        OR p.mood LIKE '%, ' || c.name || ',%'
        OR p.mood LIKE '%,' || c.name || ',%'
      ))
    )
  WHERE (category_type IS NULL OR c.type = category_type)
  GROUP BY c.id, c.name, c.slug, c.type, c.description,
           c.icon, c.icon_url, c.parent_slug
  HAVING COUNT(DISTINCT p.id) >= 15
  ORDER BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_categories_with_counts(text) TO anon, authenticated;