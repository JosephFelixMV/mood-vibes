
CREATE POLICY "Anyone can view brand_lookup" ON public.brand_lookup FOR SELECT USING (true);
CREATE POLICY "Anyone can insert brand_lookup" ON public.brand_lookup FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update brand_lookup" ON public.brand_lookup FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Anyone can delete brand_lookup" ON public.brand_lookup FOR DELETE TO anon, authenticated USING (true);
