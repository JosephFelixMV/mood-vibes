
-- Add type column to categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'core';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_slug text;

-- Add vibe_category to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vibe_category text;

-- Create product_images table
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product images" ON public.product_images FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert product images" ON public.product_images FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update product images" ON public.product_images FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Anyone can delete product images" ON public.product_images FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX idx_product_images_product_id ON public.product_images(product_id);

-- Insert Core Lifestyle Categories
INSERT INTO public.categories (name, slug, icon, type, description) VALUES
  ('The Edit: Fashion', 'fashion', '👗', 'core', 'Womenswear, Menswear, Accessories, Footwear'),
  ('The Sanctuary: Home & Living', 'home-living', '🏠', 'core', 'Furniture, Lighting, Textiles & Rugs, Wall Decor'),
  ('The Vanity: Beauty & Wellness', 'beauty-wellness', '💄', 'core', 'Skincare, Viral Makeup, Fragrance, Self-Care Rituals'),
  ('The Setup: Tech & Gadgets', 'tech-gadgets', '⚡', 'core', 'Desk Essentials, Smart Home, Audio/Visual, Portable Tech'),
  ('The Pantry: Kitchen & Dining', 'kitchen-dining', '🍳', 'core', 'Coffee & Tea, Barware, Cookware, Tabletop Decor'),
  ('The Voyage: Travel & Leisure', 'travel-leisure', '✈️', 'core', 'Luggage, Travel-Size Beauty, Outdoor Gear, Road Trip Essentials'),
  ('The Hobbyist: Recreation', 'recreation', '🎮', 'core', 'Gaming, Crafting & DIY, Fitness Gear, Pet Essentials')
ON CONFLICT DO NOTHING;

-- Insert Vibe-Based Collections
INSERT INTO public.categories (name, slug, icon, type, description) VALUES
  ('Quiet Luxury', 'quiet-luxury', '🤍', 'vibe', 'Minimalist, high-end pieces with neutral tones and "old money" silhouettes'),
  ('Soft Academia', 'soft-academia', '📚', 'vibe', 'Cozy knits, pleated skirts, messenger bags, and vintage-style stationery'),
  ('Sporty Clean Girl', 'sporty-clean-girl', '🏃‍♀️', 'vibe', 'Sleek monochrome activewear, gold minimalist jewelry, and "glass skin" beauty products'),
  ('Sustainable Futurism', 'sustainable-futurism', '♻️', 'vibe', 'Eco-conscious tech, 3D-printed accessories, and recycled metallic fabrics'),
  ('Eclectic Maximalist', 'eclectic-maximalist', '🎨', 'vibe', 'Bold colors, funky patterns, "chaos-coord" outfits, and statement home decor'),
  ('Whimsigoth', 'whimsigoth', '🌙', 'vibe', 'Celestial jewelry, velvet textures, lace-up boots, and mystical home accents'),
  ('Urban Tech-Wear', 'urban-tech-wear', '🧥', 'vibe', 'High-utility cargo pants, waterproof trench coats, and multi-pocket tactical bags'),
  ('The Wellness Era', 'wellness-era', '🧘', 'vibe', 'Aesthetic yoga mats, sunrise alarm clocks, journals, and organic supplements'),
  ('Work-From-Anywhere', 'work-from-anywhere', '💻', 'vibe', 'Laptop stands, noise-canceling headphones, and "professional-from-the-waist-up" tops')
ON CONFLICT DO NOTHING;
