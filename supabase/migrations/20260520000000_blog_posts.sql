-- Blog Posts feature
-- Tables: blog_posts, blog_post_products
-- RLS mirrors the inline EXISTS pattern used on products and other tables.

CREATE TABLE public.blog_posts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text        NOT NULL,
  slug                text        NOT NULL UNIQUE,
  subtitle            text,
  content             text,
  cover_image_url     text,
  vibe_category       text,
  category            text,
  tags                text[]      DEFAULT '{}',
  cta_label           text        DEFAULT 'Explore the Vibe',
  cta_url             text,
  author              text        DEFAULT 'Mood & Vibes Editorial',
  read_time           text,
  has_affiliate_links boolean     DEFAULT true,
  is_active           boolean     DEFAULT false,
  published_at        timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE public.blog_post_products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  display_order int  DEFAULT 0,
  UNIQUE(post_id, product_id)
);

-- Reuse the existing update_updated_at_column() function (defined in products migration)
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_products ENABLE ROW LEVEL SECURITY;

-- blog_posts: public can read only published posts
CREATE POLICY "blog_posts_public_select"
  ON public.blog_posts FOR SELECT
  USING (is_active = true);

-- blog_posts: admin can read all (including drafts)
CREATE POLICY "blog_posts_admin_select"
  ON public.blog_posts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "blog_posts_admin_insert"
  ON public.blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "blog_posts_admin_update"
  ON public.blog_posts FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "blog_posts_admin_delete"
  ON public.blog_posts FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- blog_post_products: public can read (needed to render product grids on post pages)
CREATE POLICY "blog_post_products_public_select"
  ON public.blog_post_products FOR SELECT
  USING (true);

CREATE POLICY "blog_post_products_admin_insert"
  ON public.blog_post_products FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "blog_post_products_admin_delete"
  ON public.blog_post_products FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));
