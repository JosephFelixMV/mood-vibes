import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Feature flag hook backed by `site_config` rows of the form
 *   { key: 'feature_xxx', value: 'true' | 'false' }
 *
 * Returns `true` when:
 *   - the flag value is exactly the string 'true', OR
 *   - the current Supabase Auth user has the 'admin' role in `user_roles`.
 *
 * While either query is loading we return `false` to avoid a flash of
 * gated UI for unauthenticated visitors.
 */
export function useFeatureFlag(key: string): { enabled: boolean; loading: boolean; isAdmin: boolean } {
  const flagQuery = useQuery({
    queryKey: ["feature-flag", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data?.value === "true";
    },
    staleTime: 1000 * 30,
  });

  const adminQuery = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const loading = flagQuery.isLoading || adminQuery.isLoading;
  const isAdmin = adminQuery.data === true;
  const flagOn = flagQuery.data === true;

  return {
    enabled: !loading && (flagOn || isAdmin),
    loading,
    isAdmin,
  };
}
