-- Fix trigger timing: BEFORE INSERT fires before the product row exists,
-- causing FK violation on product_categories.product_id.
-- AFTER INSERT fires after the row is written, so FK check passes.
-- Trigger function is unchanged — NEW is available in AFTER triggers too.

DROP TRIGGER IF EXISTS trg_sync_taxonomy_junction_tables ON public.products;

CREATE TRIGGER trg_sync_taxonomy_junction_tables
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_taxonomy_junction_tables();
