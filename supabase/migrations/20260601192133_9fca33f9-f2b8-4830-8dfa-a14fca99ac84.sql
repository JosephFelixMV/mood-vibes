
-- Lock down write access on all public tables. The app uses service_role
-- via edge functions for admin writes; the anon/authenticated public-write
-- policies were unintentionally permissive.

-- brand_lookup
DROP POLICY IF EXISTS "Anyone can insert brand_lookup" ON public.brand_lookup;
DROP POLICY IF EXISTS "Anyone can update brand_lookup" ON public.brand_lookup;
DROP POLICY IF EXISTS "Anyone can delete brand_lookup" ON public.brand_lookup;

-- brands
DROP POLICY IF EXISTS "Anyone can insert brands" ON public.brands;
DROP POLICY IF EXISTS "Anyone can update brands" ON public.brands;
DROP POLICY IF EXISTS "Anyone can delete brands" ON public.brands;

-- categories
DROP POLICY IF EXISTS "Anyone can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can update categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can delete categories" ON public.categories;

-- daily_picks
DROP POLICY IF EXISTS "Anyone can insert daily picks" ON public.daily_picks;

-- keywords
DROP POLICY IF EXISTS "Anyone can insert keywords" ON public.keywords;
DROP POLICY IF EXISTS "Anyone can update keywords" ON public.keywords;
DROP POLICY IF EXISTS "Anyone can delete keywords" ON public.keywords;

-- product_images
DROP POLICY IF EXISTS "Anyone can insert product images" ON public.product_images;
DROP POLICY IF EXISTS "Anyone can update product images" ON public.product_images;
DROP POLICY IF EXISTS "Anyone can delete product images" ON public.product_images;

-- product_keywords
DROP POLICY IF EXISTS "Anyone can insert product_keywords" ON public.product_keywords;
DROP POLICY IF EXISTS "Anyone can delete product_keywords" ON public.product_keywords;

-- product_specifications
DROP POLICY IF EXISTS "Anyone can insert product specifications" ON public.product_specifications;
DROP POLICY IF EXISTS "Anyone can update product specifications" ON public.product_specifications;
DROP POLICY IF EXISTS "Anyone can delete product specifications" ON public.product_specifications;

-- site_config
DROP POLICY IF EXISTS "Anyone can insert site config" ON public.site_config;
DROP POLICY IF EXISTS "Anyone can update site config" ON public.site_config;
DROP POLICY IF EXISTS "Anyone can delete site config" ON public.site_config;

-- product_reports: also lock down the public SELECT (exposes fingerprints)
DROP POLICY IF EXISTS "Anyone can read product reports" ON public.product_reports;

-- Restrict SECURITY DEFINER cron functions from anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.get_cron_job_status() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enable_cron_job() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.disable_cron_job() FROM anon, authenticated, PUBLIC;
-- get_or_create_daily_pick is intentionally callable to back the public Product of the Day feature,
-- but should not need anon execute either; the daily-pick edge function uses service_role.
REVOKE EXECUTE ON FUNCTION public.get_or_create_daily_pick() FROM anon, authenticated, PUBLIC;

-- Storage: lock down category-icons bucket writes (keep public read).
DROP POLICY IF EXISTS "Anyone can upload category icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update category icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete category icons" ON storage.objects;
