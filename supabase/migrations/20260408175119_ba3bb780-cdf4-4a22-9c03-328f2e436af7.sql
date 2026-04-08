
CREATE TABLE public.site_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site config" ON public.site_config FOR SELECT USING (true);
CREATE POLICY "Anyone can insert site config" ON public.site_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update site config" ON public.site_config FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete site config" ON public.site_config FOR DELETE USING (true);

CREATE TRIGGER update_site_config_updated_at
  BEFORE UPDATE ON public.site_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default config keys
INSERT INTO public.site_config (key, value, label) VALUES
  ('google_analytics_id', '', 'Google Analytics Measurement ID'),
  ('hotjar_id', '', 'Hotjar Site ID'),
  ('meta_title', '', 'Default Meta Title'),
  ('meta_description', '', 'Default Meta Description'),
  ('meta_keywords', '', 'Default Meta Keywords'),
  ('og_image', '', 'Default Open Graph Image URL'),
  ('robots_txt_custom', '', 'Custom Robots.txt Rules'),
  ('canonical_base_url', '', 'Canonical Base URL');
