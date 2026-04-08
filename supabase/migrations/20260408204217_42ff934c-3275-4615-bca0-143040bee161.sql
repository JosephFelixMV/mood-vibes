
-- Function to get cron job active status
CREATE OR REPLACE FUNCTION public.get_cron_job_status()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT active FROM cron.job WHERE jobname = 'check-affiliate-links-batch' LIMIT 1;
$$;

-- Function to enable the cron job
CREATE OR REPLACE FUNCTION public.enable_cron_job()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE cron.job SET active = true WHERE jobname = 'check-affiliate-links-batch';
$$;

-- Function to disable the cron job
CREATE OR REPLACE FUNCTION public.disable_cron_job()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE cron.job SET active = false WHERE jobname = 'check-affiliate-links-batch';
$$;
