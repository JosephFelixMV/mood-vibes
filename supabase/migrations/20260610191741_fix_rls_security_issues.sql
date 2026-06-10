-- ============================================================
-- Fix RLS security issues flagged in database schema review
-- ============================================================

-- -------------------------------------------------------
-- 1. products: restrict INSERT/UPDATE to admin+content only
--    (DELETE already admin-only from prior migration)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
-- Legacy open-to-all policies (safety net in case they still exist)
DROP POLICY IF EXISTS "Anyone can insert products" ON public.products;
DROP POLICY IF EXISTS "Anyone can update products" ON public.products;
DROP POLICY IF EXISTS "Anyone can delete products" ON public.products;

CREATE POLICY "Admins and content can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role IN ('admin', 'content')
    )
  );

CREATE POLICY "Admins and content can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role IN ('admin', 'content')
    )
  );

-- -------------------------------------------------------
-- 2. ai_requests: remove public read and insert access
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read ai_requests" ON public.ai_requests;
DROP POLICY IF EXISTS "Anyone can insert ai_requests" ON public.ai_requests;

CREATE POLICY "Admins can read ai_requests"
  ON public.ai_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- -------------------------------------------------------
-- 3. product_reports: add admin SELECT (public read removed
--    by prior migration but no replacement was created)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read product reports" ON public.product_reports;

CREATE POLICY "Admins can read product reports"
  ON public.product_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- -------------------------------------------------------
-- 4. site_config: remove remaining public SELECT policy;
--    restrict all operations to admin only
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view site config" ON public.site_config;
-- Write policies dropped by prior migration — safety net
DROP POLICY IF EXISTS "Anyone can insert site config" ON public.site_config;
DROP POLICY IF EXISTS "Anyone can update site config" ON public.site_config;
DROP POLICY IF EXISTS "Anyone can delete site config" ON public.site_config;

CREATE POLICY "Admins can read site config"
  ON public.site_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert site config"
  ON public.site_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update site config"
  ON public.site_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete site config"
  ON public.site_config FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- -------------------------------------------------------
-- 5. storage.objects (product-images bucket):
--    restrict to admin+content; delete to admin only
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated upload product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete product-images" ON storage.objects;

CREATE POLICY "Admins and content can upload product-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role IN ('admin', 'content')
    )
  );

CREATE POLICY "Admins and content can update product-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role IN ('admin', 'content')
    )
  );

CREATE POLICY "Admins can delete product-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- -------------------------------------------------------
-- 6. product_images table: replacement write policies
--    (prior migration dropped open-write policies but
--    never created role-gated replacements)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert product images" ON public.product_images;
DROP POLICY IF EXISTS "Anyone can update product images" ON public.product_images;
DROP POLICY IF EXISTS "Anyone can delete product images" ON public.product_images;

CREATE POLICY "Admins and content can insert product images"
  ON public.product_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role IN ('admin', 'content')
    )
  );

CREATE POLICY "Admins and content can update product images"
  ON public.product_images FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role IN ('admin', 'content')
    )
  );

CREATE POLICY "Admins can delete product images"
  ON public.product_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
