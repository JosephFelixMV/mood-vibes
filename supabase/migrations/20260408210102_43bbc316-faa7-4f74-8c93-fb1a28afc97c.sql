
-- Keywords master table
CREATE TABLE public.keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  term TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view keywords" ON public.keywords FOR SELECT USING (true);
CREATE POLICY "Anyone can insert keywords" ON public.keywords FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update keywords" ON public.keywords FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete keywords" ON public.keywords FOR DELETE USING (true);

-- Product-keyword join table
CREATE TABLE public.product_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (product_id, keyword_id)
);

ALTER TABLE public.product_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product_keywords" ON public.product_keywords FOR SELECT USING (true);
CREATE POLICY "Anyone can insert product_keywords" ON public.product_keywords FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete product_keywords" ON public.product_keywords FOR DELETE USING (true);

-- Index for fast lookups
CREATE INDEX idx_product_keywords_product ON public.product_keywords(product_id);
CREATE INDEX idx_product_keywords_keyword ON public.product_keywords(keyword_id);
CREATE INDEX idx_keywords_term ON public.keywords(term);

-- Pre-seed curated keywords
INSERT INTO public.keywords (term) VALUES
-- Gifting
('gift for her'), ('gift for him'), ('gift for kids'), ('gift for teens'), ('gift for couples'),
('gift for dad'), ('gift for mom'), ('stocking stuffer'), ('birthday gift'), ('anniversary gift'),
('housewarming gift'), ('wedding gift'), ('graduation gift'), ('valentines day'),
-- Price ranges
('under 25'), ('under 50'), ('under 100'), ('splurge'), ('affordable'), ('luxury'), ('budget friendly'),
-- Occasions & seasons
('christmas'), ('holiday'), ('summer essentials'), ('back to school'), ('new year'),
('mothers day'), ('fathers day'), ('easter'), ('halloween'),
-- Lifestyle
('eco friendly'), ('sustainable'), ('handmade'), ('artisan'), ('minimalist'), ('boho'),
('vintage'), ('modern'), ('rustic'), ('industrial'), ('scandinavian'),
-- Product attributes
('wireless'), ('portable'), ('compact'), ('premium'), ('bestseller'), ('trending'),
('new arrival'), ('limited edition'), ('customizable'), ('personalized'),
('waterproof'), ('rechargeable'), ('smart'), ('organic'), ('vegan'), ('cruelty free'),
-- Use cases
('home office'), ('work from home'), ('travel essentials'), ('gym essentials'),
('outdoor adventure'), ('camping'), ('beach'), ('self care'), ('relaxation'),
('productivity'), ('organization'), ('meal prep'), ('entertaining'), ('date night'),
('pet lover'), ('bookworm'), ('gamer'), ('fitness'), ('wellness'),
-- Demographics
('for beginners'), ('for professionals'), ('unisex'), ('plus size'), ('petite');
