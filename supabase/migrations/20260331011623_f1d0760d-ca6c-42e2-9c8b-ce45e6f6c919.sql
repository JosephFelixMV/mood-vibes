
-- Table to store the daily pick so all visitors see the same product
CREATE TABLE public.daily_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  pick_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pick_date)
);

ALTER TABLE public.daily_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily picks are viewable by everyone"
  ON public.daily_picks FOR SELECT TO public
  USING (true);

CREATE POLICY "Anyone can insert daily picks"
  ON public.daily_picks FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Function: get today's pick, or create one if none exists
CREATE OR REPLACE FUNCTION public.get_or_create_daily_pick()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
BEGIN
  -- Try to get existing pick for today
  SELECT product_id INTO v_product_id
  FROM daily_picks
  WHERE pick_date = CURRENT_DATE;

  IF v_product_id IS NOT NULL THEN
    RETURN v_product_id;
  END IF;

  -- No pick for today — select a random active product
  -- Avoid repeating yesterday's pick if possible
  SELECT p.id INTO v_product_id
  FROM products p
  WHERE p.is_active = true
    AND p.id NOT IN (
      SELECT dp.product_id FROM daily_picks dp
      WHERE dp.pick_date = CURRENT_DATE - INTERVAL '1 day'
    )
  ORDER BY random()
  LIMIT 1;

  -- Fallback: if all products were excluded, pick any active product
  IF v_product_id IS NULL THEN
    SELECT p.id INTO v_product_id
    FROM products p
    WHERE p.is_active = true
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF v_product_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Insert today's pick
  INSERT INTO daily_picks (product_id, pick_date)
  VALUES (v_product_id, CURRENT_DATE)
  ON CONFLICT (pick_date) DO NOTHING;

  -- Re-read in case of race condition
  SELECT product_id INTO v_product_id
  FROM daily_picks
  WHERE pick_date = CURRENT_DATE;

  RETURN v_product_id;
END;
$$;
