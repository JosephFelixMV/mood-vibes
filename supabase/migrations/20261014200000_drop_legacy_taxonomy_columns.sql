-- Phase 5 Stage 4: drop legacy CSV taxonomy columns. Each DROP COLUMN is
-- plain (never CASCADE) — if something still depends on a column
-- (a view, another function, a check constraint), Postgres will error
-- out naturally and that dependency gets reported/fixed, not silently
-- destroyed.
--
-- GATE: do not run until Stage 3 Part B (all read-path rewrites) is fully
-- deployed and the soak window has shown continuous 0 mismatches.
-- IRREVERSIBLE at the schema level — take the Stage 1.1 backups first.
-- Run this manually in the Supabase SQL Editor, with explicit go-ahead
-- at this exact moment. Not applied automatically.

ALTER TABLE public.products DROP COLUMN category;
ALTER TABLE public.products DROP COLUMN vibe_category;
ALTER TABLE public.products DROP COLUMN mood;

DO $$
DECLARE remaining int;
BEGIN
  SELECT count(*) INTO remaining FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products' AND column_name IN ('category', 'vibe_category', 'mood');
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'Stage 4 self-check failed: % legacy taxonomy column(s) still present', remaining;
  END IF;
END $$;

-- Defensive no-op in case Stage 2b somehow didn't already run:
DROP FUNCTION IF EXISTS public.sync_taxonomy_junction_tables();

-- Rollback: schema-level only via the Stage 1.1 data-only backup
-- (supabase/migrations backup dump) — re-add the columns and restore
-- data from the backup. There is no in-place rollback for this step.
