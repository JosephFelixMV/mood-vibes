-- Phase 1b: Create taxonomy junction tables
-- product_categories, product_vibes, product_moods
-- Stores slugs (not names); display names looked up via JOIN against categories.
-- RLS mirrors products table: public read for active products, admin-only writes.

-- ── product_categories ───────────────────────────────────────────────

CREATE TABLE public.product_categories (
  product_id    uuid    NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_slug text    NOT NULL,
  is_primary    boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_slug)
);

CREATE INDEX idx_product_categories_slug
  ON public.product_categories(category_slug);

CREATE UNIQUE INDEX idx_product_categories_primary
  ON public.product_categories(product_id)
  WHERE is_primary = true;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_categories_public_read"
  ON public.product_categories FOR SELECT
  TO public USING (true);

CREATE POLICY "product_categories_auth_insert"
  ON public.product_categories FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "product_categories_admin_update"
  ON public.product_categories FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "product_categories_admin_delete"
  ON public.product_categories FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ── product_vibes ────────────────────────────────────────────────────

CREATE TABLE public.product_vibes (
  product_id    uuid    NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  vibe_slug     text    NOT NULL,
  is_primary    boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, vibe_slug)
);

CREATE INDEX idx_product_vibes_slug
  ON public.product_vibes(vibe_slug);

CREATE UNIQUE INDEX idx_product_vibes_primary
  ON public.product_vibes(product_id)
  WHERE is_primary = true;

ALTER TABLE public.product_vibes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_vibes_public_read"
  ON public.product_vibes FOR SELECT
  TO public USING (true);

CREATE POLICY "product_vibes_auth_insert"
  ON public.product_vibes FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "product_vibes_admin_update"
  ON public.product_vibes FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "product_vibes_admin_delete"
  ON public.product_vibes FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ── product_moods ────────────────────────────────────────────────────

CREATE TABLE public.product_moods (
  product_id    uuid    NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  mood_slug     text    NOT NULL,
  is_primary    boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, mood_slug)
);

CREATE INDEX idx_product_moods_slug
  ON public.product_moods(mood_slug);

CREATE UNIQUE INDEX idx_product_moods_primary
  ON public.product_moods(product_id)
  WHERE is_primary = true;

ALTER TABLE public.product_moods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_moods_public_read"
  ON public.product_moods FOR SELECT
  TO public USING (true);

CREATE POLICY "product_moods_auth_insert"
  ON public.product_moods FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "product_moods_admin_update"
  ON public.product_moods FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "product_moods_admin_delete"
  ON public.product_moods FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ── GRANT anon/authenticated read (public storefront) ────────────────

GRANT SELECT ON public.product_categories TO anon, authenticated;
GRANT SELECT ON public.product_vibes      TO anon, authenticated;
GRANT SELECT ON public.product_moods      TO anon, authenticated;
