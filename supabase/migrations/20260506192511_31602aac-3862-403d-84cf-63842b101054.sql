insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/webp','image/jpeg','image/png','image/avif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Public read product-images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Authenticated upload product-images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

create policy "Authenticated update product-images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images');

create policy "Authenticated delete product-images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');