
-- 1. Product reports table
CREATE TABLE public.product_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reporter_fingerprint TEXT NOT NULL,
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  honeypot_triggered BOOLEAN NOT NULL DEFAULT false,
  turnstile_passed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (product_id, reporter_fingerprint)
);

ALTER TABLE public.product_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert product reports"
  ON public.product_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read product reports"
  ON public.product_reports FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. Add new columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS report_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_click_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_status_code INTEGER;

-- Initialize status from existing data
UPDATE public.products SET status = CASE
  WHEN is_active = false THEN 'unpublished'
  WHEN page_error = true THEN 'flagged'
  ELSE 'active'
END;

-- Copy last_checked_at to last_verified_at for existing data
UPDATE public.products SET last_verified_at = last_checked_at WHERE last_checked_at IS NOT NULL;

-- 3. Sync trigger: status -> is_active/page_error
CREATE OR REPLACE FUNCTION public.sync_product_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'active' THEN
        NEW.is_active := true;
        NEW.page_error := false;
      WHEN 'flagged' THEN
        NEW.is_active := false;
        NEW.page_error := true;
        NEW.page_error_detail := COALESCE(NEW.page_error_detail, 'flagged_by_system');
      WHEN 'unpublished' THEN
        NEW.is_active := false;
        NEW.page_error := true;
        NEW.page_error_detail := COALESCE(NEW.page_error_detail, 'unpublished');
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_product_status
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_status();

-- 4. Auto-flag trigger: increment report_count and flag when threshold reached
CREATE OR REPLACE FUNCTION public.handle_new_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  v_count INTEGER;
  v_threshold INTEGER := 3;
  v_cfg TEXT;
BEGIN
  -- Skip honeypot-triggered reports
  IF NEW.honeypot_triggered THEN
    RETURN NEW;
  END IF;

  -- Get configurable threshold
  SELECT value INTO v_cfg FROM public.site_config WHERE key = 'report_flag_threshold';
  IF v_cfg IS NOT NULL AND v_cfg ~ '^\d+$' THEN
    v_threshold := v_cfg::integer;
  END IF;

  -- Count valid reports for this product
  SELECT COUNT(*) INTO v_count
  FROM public.product_reports
  WHERE product_id = NEW.product_id AND honeypot_triggered = false;

  -- Update the product report_count
  UPDATE public.products
  SET report_count = v_count
  WHERE id = NEW.product_id;

  -- Auto-flag if threshold reached
  IF v_count >= v_threshold THEN
    UPDATE public.products
    SET status = 'flagged',
        page_error_detail = 'user_reports_threshold'
    WHERE id = NEW.product_id AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_new_report
  AFTER INSERT ON public.product_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_report();

-- 5. Index for fast lookups
CREATE INDEX idx_product_reports_product_id ON public.product_reports(product_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_last_verified_at ON public.products(last_verified_at NULLS FIRST);
