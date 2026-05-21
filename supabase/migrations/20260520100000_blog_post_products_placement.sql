-- Add placement column to blog_post_products.
-- 'footer' = product grid at bottom of post (existing behaviour).
-- 'inline' = product tile embedded mid-article via <!-- product-embed: {uuid} --> marker.
-- All existing rows default to 'footer'.

ALTER TABLE public.blog_post_products
  ADD COLUMN placement text NOT NULL DEFAULT 'footer'
  CONSTRAINT blog_post_products_placement_check CHECK (placement IN ('footer', 'inline'));
