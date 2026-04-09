CREATE OR REPLACE FUNCTION public.enable_cron_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  target_job_id bigint;
BEGIN
  SELECT jobid INTO target_job_id
  FROM cron.job
  WHERE jobname = 'check-affiliate-links-batch'
  LIMIT 1;

  IF target_job_id IS NULL THEN
    RAISE EXCEPTION 'Cron job check-affiliate-links-batch not found';
  END IF;

  PERFORM cron.alter_job(target_job_id, NULL, NULL, NULL, NULL, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_cron_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  target_job_id bigint;
BEGIN
  SELECT jobid INTO target_job_id
  FROM cron.job
  WHERE jobname = 'check-affiliate-links-batch'
  LIMIT 1;

  IF target_job_id IS NULL THEN
    RAISE EXCEPTION 'Cron job check-affiliate-links-batch not found';
  END IF;

  PERFORM cron.alter_job(target_job_id, NULL, NULL, NULL, NULL, false);
END;
$$;

REVOKE ALL ON FUNCTION public.enable_cron_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.disable_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enable_cron_job() TO service_role;
GRANT EXECUTE ON FUNCTION public.disable_cron_job() TO service_role;