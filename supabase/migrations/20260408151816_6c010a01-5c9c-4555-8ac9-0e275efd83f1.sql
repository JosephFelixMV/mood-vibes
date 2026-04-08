
CREATE TABLE public.ai_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text NOT NULL,
  prompt_hash text NOT NULL,
  prompt_text text NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  product_ids uuid[] DEFAULT '{}',
  flagged boolean NOT NULL DEFAULT false,
  flag_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for rate limiting lookups by IP
CREATE INDEX idx_ai_requests_ip_hash_created ON public.ai_requests (ip_hash, created_at DESC);

-- Index for prompt caching lookups
CREATE INDEX idx_ai_requests_prompt_hash ON public.ai_requests (prompt_hash, created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

-- Allow reading (needed for admin dashboard and rate limit checks via service role)
CREATE POLICY "Anyone can read ai_requests"
ON public.ai_requests FOR SELECT
TO anon, authenticated
USING (true);

-- Allow inserting (edge function uses service role, but allow anon for flexibility)
CREATE POLICY "Anyone can insert ai_requests"
ON public.ai_requests FOR INSERT
TO anon, authenticated
WITH CHECK (true);
