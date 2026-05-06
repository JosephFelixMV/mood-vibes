-- Phase 1d: Backfill junction tables from existing products
--
-- Run AFTER:
--   1. products_snapshot_phase1 table has been created
--   2. Junction tables exist (20260504010000)
--   3. Trigger exists (20260504010100)
--
-- The trigger handles future writes; this one-time script backfills all
-- existing products. Uses the same name→slug JOIN logic as the trigger.
--
-- Wrapped in a transaction with validation counts before COMMIT.
-- If validation fails, ROLLBACK and investigate.

BEGIN;

-- ── Backfill product_categories ───────────────────────────────────

INSERT INTO public.product_categories (product_id, category_slug, is_primary, display_order)
SELECT
  p.id,
  c.slug,
  (row_number() OVER (PARTITION BY p.id ORDER BY t.ord) = 1) AS is_primary,
  (row_number() OVER (PARTITION BY p.id ORDER BY t.ord) - 1) AS display_order
FROM public.products p,
  unnest(string_to_array(COALESCE(p.category, ''), ',')) WITH ORDINALITY AS t(raw_name, ord)
  JOIN public.categories c
    ON lower(trim(t.raw_name)) = lower(c.name)
    AND c.type = 'core'
WHERE p.category IS NOT NULL AND p.category <> ''
ON CONFLICT (product_id, category_slug) DO NOTHING;

-- ── Backfill product_vibes ────────────────────────────────────────

INSERT INTO public.product_vibes (product_id, vibe_slug, is_primary, display_order)
SELECT
  p.id,
  c.slug,
  (row_number() OVER (PARTITION BY p.id ORDER BY t.ord) = 1) AS is_primary,
  (row_number() OVER (PARTITION BY p.id ORDER BY t.ord) - 1) AS display_order
FROM public.products p,
  unnest(string_to_array(COALESCE(p.vibe_category, ''), ',')) WITH ORDINALITY AS t(raw_name, ord)
  JOIN public.categories c
    ON lower(trim(t.raw_name)) = lower(c.name)
    AND c.type = 'vibe'
WHERE p.vibe_category IS NOT NULL AND p.vibe_category <> ''
ON CONFLICT (product_id, vibe_slug) DO NOTHING;

-- ── Backfill product_moods ────────────────────────────────────────

INSERT INTO public.product_moods (product_id, mood_slug, is_primary, display_order)
SELECT
  p.id,
  c.slug,
  (row_number() OVER (PARTITION BY p.id ORDER BY t.ord) = 1) AS is_primary,
  (row_number() OVER (PARTITION BY p.id ORDER BY t.ord) - 1) AS display_order
FROM public.products p,
  unnest(string_to_array(COALESCE(p.mood, ''), ',')) WITH ORDINALITY AS t(raw_name, ord)
  JOIN public.categories c
    ON lower(trim(t.raw_name)) = lower(c.name)
    AND c.type = 'mood'
WHERE p.mood IS NOT NULL AND p.mood <> ''
ON CONFLICT (product_id, mood_slug) DO NOTHING;

-- ── Validation ────────────────────────────────────────────────────
-- These queries must return non-zero counts and reasonable distributions.
-- Review the output before running COMMIT.

-- How many products got at least one category junction row?
SELECT 'product_categories' AS table_name,
  COUNT(DISTINCT product_id) AS products_covered,
  COUNT(*)                   AS total_rows
FROM public.product_categories;

-- How many products got at least one vibe junction row?
SELECT 'product_vibes' AS table_name,
  COUNT(DISTINCT product_id) AS products_covered,
  COUNT(*)                   AS total_rows
FROM public.product_vibes;

-- How many products got at least one mood junction row?
SELECT 'product_moods' AS table_name,
  COUNT(DISTINCT product_id) AS products_covered,
  COUNT(*)                   AS total_rows
FROM public.product_moods;

-- Products with category set but no junction row (should be 0 after orphan fix)
SELECT COUNT(*) AS unmatched_category_products
FROM public.products
WHERE category IS NOT NULL AND category <> ''
  AND id NOT IN (SELECT DISTINCT product_id FROM public.product_categories);

-- COMMIT when all counts look correct; ROLLBACK if unmatched > 0
-- COMMIT;
-- ROLLBACK;
