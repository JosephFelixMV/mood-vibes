INSERT INTO storage.buckets (id, name, public) VALUES ('category-icons', 'category-icons', true);

CREATE POLICY "Category icons are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'category-icons');

CREATE POLICY "Anyone can upload category icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'category-icons');

CREATE POLICY "Anyone can update category icons"
ON storage.objects FOR UPDATE
USING (bucket_id = 'category-icons');

CREATE POLICY "Anyone can delete category icons"
ON storage.objects FOR DELETE
USING (bucket_id = 'category-icons');