-- Documents the user_roles table created via Supabase dashboard.
-- Uses IF NOT EXISTS so it is safe to run against a DB where the table
-- already exists.

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'content')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users may only read their own role row.
-- No INSERT/UPDATE/DELETE policies — only service_role (SQL editor /
-- Edge Functions with service key) may write to this table.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'Users can read own role'
  ) THEN
    CREATE POLICY "Users can read own role" ON public.user_roles
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
