
-- Step 1: Normalize whitespace in comma-separated tag fields (trim spaces around commas)
UPDATE products SET vibe_category = regexp_replace(trim(vibe_category), '\s*,\s*', ', ', 'g') WHERE vibe_category IS NOT NULL;
UPDATE products SET category = regexp_replace(trim(category), '\s*,\s*', ', ', 'g') WHERE category IS NOT NULL;
UPDATE products SET mood = regexp_replace(trim(mood), '\s*,\s*', ', ', 'g') WHERE mood IS NOT NULL;

-- Step 2: Remove stale vibe tags that no longer exist in the categories table
-- Removing: Main Character Energy, Sunday Reset, That Girl / That Guy, Clean Girl / Clean Guy, Icy Minimal
UPDATE products
SET vibe_category = trim(both ', ' from regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(vibe_category, '(^|, *)Main Character Energy(, *|$)', '\1', 'g'),
        '(^|, *)Sunday Reset(, *|$)', '\1', 'g'),
      '(^|, *)That Girl / That Guy(, *|$)', '\1', 'g'),
    '(^|, *)Clean Girl / Clean Guy(, *|$)', '\1', 'g'),
  '(^|, *)Icy Minimal(, *|$)', '\1', 'g'))
WHERE vibe_category IS NOT NULL
  AND (vibe_category ILIKE '%Main Character Energy%'
    OR vibe_category ILIKE '%Sunday Reset%'
    OR vibe_category ILIKE '%That Girl / That Guy%'
    OR vibe_category ILIKE '%Clean Girl / Clean Guy%'
    OR vibe_category ILIKE '%Icy Minimal%');

-- Step 3: Clean up any resulting empty vibe_category fields
UPDATE products SET vibe_category = NULL WHERE vibe_category = '' OR vibe_category = ', ';

-- Step 4: Final pass to normalize remaining commas (remove leading/trailing commas and double commas)
UPDATE products SET vibe_category = trim(both ', ' from regexp_replace(vibe_category, ',\s*,', ',', 'g')) WHERE vibe_category IS NOT NULL;
