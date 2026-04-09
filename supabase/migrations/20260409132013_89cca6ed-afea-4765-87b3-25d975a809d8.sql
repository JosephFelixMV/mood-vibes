CREATE OR REPLACE FUNCTION public.enable_cron_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  UPDATE cron.job
  SET active = true
  WHERE jobname = 'check-affiliate-links-batch';
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_cron_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  UPDATE cron.job
  SET active = false
  WHERE jobname = 'check-affiliate-links-batch';
END;
$$;

REVOKE ALL ON FUNCTION public.enable_cron_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.disable_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enable_cron_job() TO service_role;
GRANT EXECUTE ON FUNCTION public.disable_cron_job() TO service_role;