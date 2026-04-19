-- Decode HTML entities in stored brand names (e.g. &amp; -> &)
UPDATE public.brands
SET name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name,
  '&amp;', '&'),
  '&#39;', ''''),
  '&quot;', '"'),
  '&lt;', '<'),
  '&gt;', '>')
WHERE name ~ '&(amp|#39|quot|lt|gt);';

-- Same cleanup for brand_lookup table
UPDATE public.brand_lookup
SET brand = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(brand,
  '&amp;', '&'),
  '&#39;', ''''),
  '&quot;', '"'),
  '&lt;', '<'),
  '&gt;', '>')
WHERE brand ~ '&(amp|#39|quot|lt|gt);';

-- Same cleanup for company_name on products (vendor display fallback)
UPDATE public.products
SET company_name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(company_name,
  '&amp;', '&'),
  '&#39;', ''''),
  '&quot;', '"'),
  '&lt;', '<'),
  '&gt;', '>')
WHERE company_name ~ '&(amp|#39|quot|lt|gt);';