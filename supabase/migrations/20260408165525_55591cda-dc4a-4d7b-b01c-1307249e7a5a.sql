
-- Create storage bucket for cached product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-image-cache', 'product-image-cache', true);

-- Allow public read access to cached images
CREATE POLICY "Cached images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-image-cache');

-- Allow edge functions (service role) to insert cached images
CREATE POLICY "Service role can upload cached images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'product-image-cache');
