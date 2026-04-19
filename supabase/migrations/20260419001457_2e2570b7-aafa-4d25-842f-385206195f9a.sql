CREATE OR REPLACE FUNCTION public.preserve_updated_at_on_tracking_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  tracking_only boolean := true;
BEGIN
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    RETURN NEW;
  END IF;

  IF NEW.name              IS DISTINCT FROM OLD.name              THEN tracking_only := false; END IF;
  IF NEW.slug              IS DISTINCT FROM OLD.slug              THEN tracking_only := false; END IF;
  IF NEW.description       IS DISTINCT FROM OLD.description       THEN tracking_only := false; END IF;
  IF NEW.price             IS DISTINCT FROM OLD.price             THEN tracking_only := false; END IF;
  IF NEW.price_below_msrp  IS DISTINCT FROM OLD.price_below_msrp  THEN tracking_only := false; END IF;
  IF NEW.image_url         IS DISTINCT FROM OLD.image_url         THEN tracking_only := false; END IF;
  IF NEW.video_url         IS DISTINCT FROM OLD.video_url         THEN tracking_only := false; END IF;
  IF NEW.affiliate_url     IS DISTINCT FROM OLD.affiliate_url     THEN tracking_only := false; END IF;
  IF NEW.source_url        IS DISTINCT FROM OLD.source_url        THEN tracking_only := false; END IF;
  IF NEW.category          IS DISTINCT FROM OLD.category          THEN tracking_only := false; END IF;
  IF NEW.vibe_category     IS DISTINCT FROM OLD.vibe_category     THEN tracking_only := false; END IF;
  IF NEW.mood              IS DISTINCT FROM OLD.mood              THEN tracking_only := false; END IF;
  IF NEW.fashion_season    IS DISTINCT FROM OLD.fashion_season    THEN tracking_only := false; END IF;
  IF NEW.fashion_warmth    IS DISTINCT FROM OLD.fashion_warmth    THEN tracking_only := false; END IF;
  IF NEW.fashion_occasions IS DISTINCT FROM OLD.fashion_occasions THEN tracking_only := false; END IF;
  IF NEW.regions           IS DISTINCT FROM OLD.regions           THEN tracking_only := false; END IF;
  IF NEW.vendor_id         IS DISTINCT FROM OLD.vendor_id         THEN tracking_only := false; END IF;
  IF NEW.company_name      IS DISTINCT FROM OLD.company_name      THEN tracking_only := false; END IF;

  IF tracking_only THEN
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;