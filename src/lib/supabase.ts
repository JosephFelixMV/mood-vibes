import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fqccttthuzvltbyzmvid.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxY2N0dHRodXp2bHRieXptdmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODU5NzMsImV4cCI6MjA5MTk2MTk3M30.w9EYTg7PXjIvFZycZRzAvjfG4aemOnbWxWjve0BxbTg";

// Import the supabase client like this:
// import { supabase } from "@/lib/supabase";

// NOTE: This client points at the live prod project (fqccttthuzvltbyzmvid).
// The generated `Database` types in src/integrations/supabase/types.ts come
// from the Lovable Cloud sandbox project (ztztujccujrigexfhdjj) and do not
// reflect prod tables (user_roles, blog_posts, blog_post_products,
// product_categories, product_vibes, etc.), so we intentionally leave this
// client untyped to avoid false `never` errors.
const _client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Cast to `any` so query results aren't narrowed against the sandbox-generated
// `Database` types (which omit prod-only tables like user_roles, blog_posts,
// blog_post_products, product_categories, product_vibes).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = _client;
