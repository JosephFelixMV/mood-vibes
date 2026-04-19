
-- The existing update_products_updated_at trigger always sets updated_at = now()
-- and runs alphabetically AFTER preserve_updated_at_on_tracking_changes,
-- which means it was overwriting the preserved timestamp. Rename our trigger
-- to z_preserve_... so it runs LAST in BEFORE UPDATE order.
DROP TRIGGER IF EXISTS preserve_updated_at_on_tracking_changes ON public.products;
DROP TRIGGER IF EXISTS z_preserve_updated_at_on_tracking_changes ON public.products;

CREATE TRIGGER z_preserve_updated_at_on_tracking_changes
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.preserve_updated_at_on_tracking_changes();
