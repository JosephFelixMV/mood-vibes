
DROP POLICY "Authenticated users can insert products" ON public.products;
DROP POLICY "Authenticated users can update products" ON public.products;
DROP POLICY "Authenticated users can delete products" ON public.products;

CREATE POLICY "Anyone can insert products" ON public.products FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update products" ON public.products FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Anyone can delete products" ON public.products FOR DELETE TO anon, authenticated USING (true);

DROP POLICY "Authenticated users can insert categories" ON public.categories;
DROP POLICY "Authenticated users can update categories" ON public.categories;
DROP POLICY "Authenticated users can delete categories" ON public.categories;

CREATE POLICY "Anyone can insert categories" ON public.categories FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update categories" ON public.categories FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Anyone can delete categories" ON public.categories FOR DELETE TO anon, authenticated USING (true);
