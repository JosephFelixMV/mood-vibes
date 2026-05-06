-- Replaces the N+1 COUNT queries in the sitemap Edge Function with a
-- single aggregation. Uses LATERAL unnest to split the comma-separated
-- category/vibe_category/mood fields, then groups and counts.
--
-- Returns one row per (primary_type, primary_slug, mood_slug) pair that
-- has >= 3 active products, ready for direct sitemap URL generation.

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
  -- Unnest comma-separated category + mood per product (core combos)
  product_core_moods AS (
    SELECT
      trim(cat) AS cat_name,
      trim(moo) AS mood_name
    FROM products,
      LATERAL unnest(string_to_array(COALESCE(category, ''), ','))    AS cat,
      LATERAL unnest(string_to_array(COALESCE(mood, ''), ','))        AS moo
    WHERE is_active = true
      AND category   IS NOT NULL AND category   <> ''
      AND mood       IS NOT NULL AND mood       <> ''
  ),
  -- Unnest comma-separated vibe_category + mood per product (vibe combos)
  product_vibe_moods AS (
    SELECT
      trim(vib) AS vibe_name,
      trim(moo) AS mood_name
    FROM products,
      LATERAL unnest(string_to_array(COALESCE(vibe_category, ''), ',')) AS vib,
      LATERAL unnest(string_to_array(COALESCE(mood, ''), ','))          AS moo
    WHERE is_active = true
      AND vibe_category IS NOT NULL AND vibe_category <> ''
      AND mood          IS NOT NULL AND mood          <> ''
  ),
  -- Core + Mood combos
  core_combos AS (
    SELECT
      'core'::text AS primary_type,
      c.slug       AS primary_slug,
      m.slug       AS mood_slug,
      COUNT(*)     AS cnt
    FROM categories c
    JOIN categories m ON m.type = 'mood'
    JOIN product_core_moods p
      ON lower(p.cat_name)  = lower(c.name)
     AND lower(p.mood_name) = lower(m.name)
    WHERE c.type = 'core'
    GROUP BY c.slug, m.slug
    HAVING COUNT(*) >= 3
  ),
  -- Vibe + Mood combos
  vibe_combos AS (
    SELECT
      'vibe'::text AS primary_type,
      v.slug       AS primary_slug,
      m.slug       AS mood_slug,
      COUNT(*)     AS cnt
    FROM categories v
    JOIN categories m ON m.type = 'mood'
    JOIN product_vibe_moods p
      ON lower(p.vibe_name) = lower(v.name)
     AND lower(p.mood_name) = lower(m.name)
    WHERE v.type = 'vibe'
    GROUP BY v.slug, m.slug
    HAVING COUNT(*) >= 3
  )
  SELECT primary_type, primary_slug, mood_slug, cnt FROM core_combos
  UNION ALL
  SELECT primary_type, primary_slug, mood_slug, cnt FROM vibe_combos;
$$;

-- Grant anon/authenticated read access (sitemap is public)
GRANT EXECUTE ON FUNCTION public.get_sitemap_combo_counts() TO anon, authenticated;
