
-- Preserve products.updated_at when an UPDATE only touches tracking/health columns.
-- These columns are written by background processes (click validation, link checker,
-- report counter trigger, etc.) and should NOT bump the admin "Last Updated" sort.
CREATE OR REPLACE FUNCTION public.preserve_updated_at_on_tracking_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  tracking_only boolean := true;
BEGIN
  -- If updated_at was not changed by this UPDATE, nothing to do.
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    RETURN NEW;
  END IF;

  -- Check every "real" product detail column. If any of them changed,
  -- this is a genuine edit and we let updated_at bump normally.
  IF NEW.name             IS DISTINCT FROM OLD.name             THEN tracking_only := false; END IF;
  IF NEW.slug             IS DISTINCT FROM OLD.slug             THEN tracking_only := false; END IF;
  IF NEW.description      IS DISTINCT FROM OLD.description      THEN tracking_only := false; END IF;
  IF NEW.price            IS DISTINCT FROM OLD.price            THEN tracking_only := false; END IF;
  IF NEW.price_below_msrp IS DISTINCT FROM OLD.price_below_msrp THEN tracking_only := false; END IF;
  IF NEW.image_url        IS DISTINCT FROM OLD.image_url        THEN tracking_only := false; END IF;
  IF NEW.video_url        IS DISTINCT FROM OLD.video_url        THEN tracking_only := false; END IF;
  IF NEW.affiliate_url    IS DISTINCT FROM OLD.affiliate_url    THEN tracking_only := false; END IF;
  IF NEW.source_url       IS DISTINCT FROM OLD.source_url       THEN tracking_only := false; END IF;
  IF NEW.category         IS DISTINCT FROM OLD.category         THEN tracking_only := false; END IF;
  IF NEW.vibe_category    IS DISTINCT FROM OLD.vibe_category    THEN tracking_only := false; END IF;
  IF NEW.mood             IS DISTINCT FROM OLD.mood             THEN tracking_only := false; END IF;
  IF NEW.fashion_season   IS DISTINCT FROM OLD.fashion_season   THEN tracking_only := false; END IF;
  IF NEW.fashion_warmth   IS DISTINCT FROM OLD.fashion_warmth   THEN tracking_only := false; END IF;
  IF NEW.fashion_occasions IS DISTINCT FROM OLD.fashion_occasions THEN tracking_only := false; END IF;
  IF NEW.regions          IS DISTINCT FROM OLD.regions          THEN tracking_only := false; END IF;
  IF NEW.vendor_id        IS DISTINCT FROM OLD.vendor_id        THEN tracking_only := false; END IF;
  IF NEW.company_name     IS DISTINCT FROM OLD.company_name     THEN tracking_only := false; END IF;
  IF NEW.is_active        IS DISTINCT FROM OLD.is_active        THEN tracking_only := false; END IF;
  IF NEW.status           IS DISTINCT FROM OLD.status           THEN tracking_only := false; END IF;

  -- Only tracking/health fields changed → preserve the previous updated_at
  -- so the admin "Last Updated" column reflects real edits only.
  IF tracking_only THEN
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preserve_updated_at_on_tracking_changes ON public.products;
CREATE TRIGGER preserve_updated_at_on_tracking_changes
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.preserve_updated_at_on_tracking_changes();
