## Plan: Local Image Uploads via Supabase Storage

Enable uploading images from your local drive directly in the admin panel. Files land in a public `product-images` bucket on the live Supabase project (`fqccttthuzvltbyzmvid`) and the resulting public URL is written into `image_url` / `product_images.image_url` — same string field used today, fully compatible with the existing image-proxy and frontend.

### What you get
- "Upload image" button (with drag/drop) next to every image URL field in **ProductForm** (main image + up to 4 gallery images).
- "Upload image" support in **BulkUpload** — JSON files can reference local files in the same drop, OR you can leave URLs as-is.
- Client-side resize + WebP conversion before upload (max 1600px long edge, ~85% quality) → small files, fast pages.
- Delete-from-storage when an admin replaces or removes an image that was originally uploaded (URLs from external CDNs are left untouched).

### SQL to run manually in `fqccttthuzvltbyzmvid` SQL Editor
(Migration tool targets the wrong project — see dual-supabase memory.)

```sql
-- 1. Create public bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB
  array['image/webp','image/jpeg','image/png','image/avif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. RLS: public read, authenticated write/update/delete
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
```

(I'll also run the same migration on the Lovable Cloud project so generated types stay aligned.)

### Code changes

**New: `src/components/admin/ImageUploader.tsx`**
- Reusable component: takes `value` (URL string) + `onChange(url)`.
- Renders preview, "Upload" button, "Paste URL" fallback, drag/drop zone.
- On file select:
  1. Resize via `<canvas>` (longest edge ≤ 1600px).
  2. Encode as WebP (~0.85 quality) — fallback to original if browser lacks support.
  3. Upload to `product-images/{yyyy}/{mm}/{uuid}.webp` via `supabase.storage.from('product-images').upload()`.
  4. Get public URL, call `onChange(publicUrl)`.
- Shows progress + error state via `sonner`.

**New: `src/lib/image-upload.ts`**
- Pure helpers: `resizeImage(file, maxEdge)`, `uploadProductImage(file)`, `deleteProductImageIfOwned(url)` (only deletes when URL starts with the bucket public prefix).

**Edit: `src/components/admin/ProductForm.tsx`**
- Replace plain `<Input>` for `image_url` and the 4 `additional_images[i]` slots with `<ImageUploader>`.
- Keep manual URL paste as fallback (toggle inside ImageUploader).
- On save, if a previously-uploaded image was replaced/removed, call `deleteProductImageIfOwned` for the old URL.

**Edit: `src/components/admin/BulkUpload.tsx`**
- Accept image files alongside JSON in the same multi-select.
- If a JSON `image_url` value matches an uploaded filename (e.g. `"./hero.jpg"` or just `"hero.jpg"`), upload the matching file first and substitute its public URL before insert. Same for `additional_images[]`.
- Untouched if JSON only has remote URLs (current behavior preserved).

**No changes needed to:** image-proxy edge function, ProductCard, ProductDetail — they already accept any URL string.

### Notes / trade-offs
- **5 MB hard cap** at the bucket level; client-side resize means most photos land well under 500 KB.
- Files are **never deleted automatically** when a product row is deleted — only when explicitly replaced in the form. (Can add a cleanup cron later if needed.)
- Bucket is **public read** — anyone with the URL sees the image (same posture as your current external CDN URLs). Required for the existing image proxy + frontend `<img>` tags.
- Path scheme `{yyyy}/{mm}/{uuid}.webp` keeps directory listings small and avoids name collisions.

### Out of scope (can do later)
- Migrating the ~350 existing external images into the bucket.
- Storage usage dashboard in admin.
- Per-image alt text storage.
