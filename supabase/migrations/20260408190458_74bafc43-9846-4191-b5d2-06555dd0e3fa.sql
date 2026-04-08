
-- Add failure tracking columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_failure_count integer NOT NULL DEFAULT 0;

-- Update daily pick function to exclude broken products
CREATE OR REPLACE FUNCTION public.get_or_create_daily_pick()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_product_id uuid;
BEGIN
  SELECT product_id INTO v_product_id
  FROM daily_picks
  WHERE pick_date = CURRENT_DATE;

  IF v_product_id IS NOT NULL THEN
    -- Verify the picked product is still valid
    PERFORM 1 FROM products WHERE id = v_product_id AND is_active = true AND page_error = false;
    IF FOUND THEN
      RETURN v_product_id;
    END IF;
    -- Invalid pick — delete and re-pick
    DELETE FROM daily_picks WHERE pick_date = CURRENT_DATE;
  END IF;

  -- Select a random active, non-error product avoiding yesterday's pick
  SELECT p.id INTO v_product_id
  FROM products p
  WHERE p.is_active = true
    AND p.page_error = false
    AND p.id NOT IN (
      SELECT dp.product_id FROM daily_picks dp
      WHERE dp.pick_date = CURRENT_DATE - INTERVAL '1 day'
    )
  ORDER BY random()
  LIMIT 1;

  IF v_product_id IS NULL THEN
    SELECT p.id INTO v_product_id
    FROM products p
    WHERE p.is_active = true AND p.page_error = false
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF v_product_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO daily_picks (product_id, pick_date)
  VALUES (v_product_id, CURRENT_DATE)
  ON CONFLICT (pick_date) DO NOTHING;

  SELECT product_id INTO v_product_id
  FROM daily_picks
  WHERE pick_date = CURRENT_DATE;

  RETURN v_product_id;
END;
$function$;
