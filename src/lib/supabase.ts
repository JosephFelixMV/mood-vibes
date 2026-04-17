import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = "https://fqccttthuzvltbyzmvid.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxY2N0dHRodXp2bHRieXptdmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODU5NzMsImV4cCI6MjA5MTk2MTk3M30.w9EYTg7PXjIvFZycZRzAvjfG4aemOnbWxWjve0BxbTg";

// Import the supabase client like this:
// import { supabase } from "@/lib/supabase";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
