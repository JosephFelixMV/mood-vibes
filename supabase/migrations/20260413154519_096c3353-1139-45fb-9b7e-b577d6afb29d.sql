
-- Deduplicate comma-separated values in vibe_category
UPDATE products SET vibe_category = (
  SELECT string_agg(DISTINCT trim(val), ', ')
  FROM unnest(string_to_array(vibe_category, ',')) AS val
  WHERE trim(val) != ''
)
WHERE vibe_category LIKE '%,%';

-- Deduplicate comma-separated values in mood
UPDATE products SET mood = (
  SELECT string_agg(DISTINCT trim(val), ', ')
  FROM unnest(string_to_array(mood, ',')) AS val
  WHERE trim(val) != ''
)
WHERE mood LIKE '%,%';

-- Deduplicate comma-separated values in category
UPDATE products SET category = (
  SELECT string_agg(DISTINCT trim(val), ', ')
  FROM unnest(string_to_array(category, ',')) AS val
  WHERE trim(val) != ''
)
WHERE category LIKE '%,%';
