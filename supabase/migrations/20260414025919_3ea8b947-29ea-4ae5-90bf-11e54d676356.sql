
CREATE TABLE public.brand_lookup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL UNIQUE,
  match_aliases text[] NOT NULL DEFAULT '{}',
  url_match text NOT NULL DEFAULT '',
  group_name text,
  source text,
  core text[],
  vibes text[],
  moods text[],
  hint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_lookup ENABLE ROW LEVEL SECURITY;
